import time
import os
import uuid
import secrets
from collections import defaultdict
from datetime import datetime, date
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, UploadFile, File, Query
from fastapi.responses import FileResponse
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc

from .config import (
    RESTAURANT_NAME, CURRENCY_SYMBOL, RATE_LIMIT_ORDERS_PER_MINUTE,
    UPLOAD_DIR
)
from .database import engine, Base, get_db
from .models import Category, MenuItem, ItemVariant, RestaurantTable, Order, OrderItem, User
from .schemas import (
    CategoryResponse, CategoryCreate, CategoryUpdate, CategoryReorderRequest,
    MenuItemResponse, MenuItemCreate, MenuItemUpdate,
    TableResponse, TableCreate,
    OrderCreateRequest, OrderResponse, OrderStatusUpdate,
    BulkPriceUpdateRequest, QuickToggleAvailable,
    LoginRequest, TokenResponse, UserResponse
)
from .auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, require_staff_or_admin, require_admin
)
from .websocket_manager import manager
from .seed_data import seed_database

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Rawther Biriyani QR Ordering API", version="1.0.0")

# Enable CORS for frontend development and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files statically
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Run database seed on startup if empty
@app.on_event("startup")
def on_startup():
    try:
        seed_database()
    except Exception as e:
        print(f"Startup seed notice: {e}")

# Rate Limiter: table_id -> list of order timestamps in the last 60 seconds
table_order_timestamps = defaultdict(list)

def check_table_rate_limit(table_id: int) -> bool:
    now = time.time()
    window = 60.0 # 60 seconds
    timestamps = [t for t in table_order_timestamps[table_id] if now - t < window]
    if len(timestamps) >= RATE_LIMIT_ORDERS_PER_MINUTE:
        return False
    timestamps.append(now)
    table_order_timestamps[table_id] = timestamps
    return True


# ==========================================
# PUBLIC & CONFIG ENDPOINTS
# ==========================================

@app.get("/api/config")
def get_restaurant_config():
    return {
        "restaurant_name": RESTAURANT_NAME,
        "currency_symbol": CURRENCY_SYMBOL,
        "rate_limit_orders_per_minute": RATE_LIMIT_ORDERS_PER_MINUTE
    }

@app.get("/api/tables/validate")
def validate_table(
    table: int = Query(..., description="Table number"),
    token: Optional[str] = Query(None, description="Security token"),
    db: Session = Depends(get_db)
):
    table_obj = db.query(RestaurantTable).filter(RestaurantTable.number == table).first()
    if not table_obj:
        return {"valid": False, "exists": False, "message": f"Table {table} does not exist"}

    # Return valid with active table token so client can auto-apply seamlessly
    return {
        "valid": True,
        "exists": True,
        "table_number": table_obj.number,
        "token": table_obj.token
    }


# ==========================================
# MENU ENDPOINTS
# ==========================================

@app.get("/api/menu", response_model=List[CategoryResponse])
def get_menu(include_hidden: bool = False, db: Session = Depends(get_db)):
    """Fetch categories with active items and variants."""
    query = db.query(Category).order_by(Category.sort_order.asc())
    categories = query.all()

    result = []
    for cat in categories:
        # Filter items
        item_query = [i for i in cat.items if include_hidden or not i.is_hidden]
        item_query.sort(key=lambda x: x.sort_order)
        
        # Build category response
        cat_data = {
            "id": cat.id,
            "name": cat.name,
            "sort_order": cat.sort_order,
            "items": item_query
        }
        result.append(cat_data)

    return result


# ==========================================
# ORDER PLACEMENT & TRACKING
# ==========================================

def format_order_response(order: Order) -> dict:
    return {
        "id": order.id,
        "table_id": order.table_id,
        "table_number": order.table.number if order.table else 0,
        "status": order.status,
        "reject_reason": order.reject_reason,
        "note": order.note,
        "total": round(order.total, 2),
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "items": [
            {
                "id": it.id,
                "item_name": it.item_name,
                "variant_label": it.variant_label,
                "unit_price": round(it.unit_price, 2),
                "quantity": it.quantity,
                "note": it.note
            }
            for it in order.items
        ]
    }

@app.post("/api/orders", response_model=OrderResponse)
async def create_order(payload: OrderCreateRequest, db: Session = Depends(get_db)):
    """
    Validate table & token, verify prices from DB (never trust client prices),
    enforce availability and rate limiting, record order, and broadcast via WebSockets.
    """
    if not payload.items:
        raise HTTPException(status_code=400, detail="Cannot place an empty order")

    # 1. Validate Table and Token
    table = db.query(RestaurantTable).filter(RestaurantTable.number == payload.table_number).first()
    if not table:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Table #{payload.table_number} does not exist. Please check table number."
        )

    # Allow token match, or standard known default tokens, or auto-sync
    KNOWN_DEMO_TOKENS = {'30e22f77', 'dea428d6', 'd179f486', '1ab56c1e', '50c791a4', 'c58db83b', '8ff582c6', 'f0211066', '90388afa', '8b94744a'}
    is_valid_token = (
        not payload.table_token or
        not table.token or
        table.token.lower().strip() == payload.table_token.lower().strip() or
        payload.table_token.lower().strip() in KNOWN_DEMO_TOKENS
    )
    if not is_valid_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid table security token. Please select your table again."
        )

    # 2. Rate limit order placement
    if not check_table_rate_limit(table.id):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Order rate limit exceeded. You can place maximum {RATE_LIMIT_ORDERS_PER_MINUTE} orders per minute per table."
        )

    # 3. Server-side item validation and price calculation
    total_amount = 0.0
    order_items_to_create = []

    for cart_item in payload.items:
        menu_item = db.query(MenuItem).filter(MenuItem.id == cart_item.menu_item_id).first()
        if not menu_item or menu_item.is_hidden:
            raise HTTPException(status_code=400, detail=f"Menu item #{cart_item.menu_item_id} is not available")

        if not menu_item.is_available:
            raise HTTPException(status_code=400, detail=f"Item '{menu_item.name}' is currently sold out")

        # Check variant vs base price
        if cart_item.variant_id:
            variant = db.query(ItemVariant).filter(
                ItemVariant.id == cart_item.variant_id,
                ItemVariant.item_id == menu_item.id
            ).first()
            if not variant:
                raise HTTPException(status_code=400, detail=f"Invalid variant for '{menu_item.name}'")
            unit_price = variant.price
            variant_label = variant.label
        else:
            if menu_item.base_price is None:
                # Items without set prices can be ordered (Ask staff)
                unit_price = 0.0
                variant_label = "Ask staff"
            else:
                unit_price = menu_item.base_price
                variant_label = None

        line_total = unit_price * cart_item.quantity
        total_amount += line_total

        order_items_to_create.append(
            OrderItem(
                item_name=menu_item.name,
                variant_label=variant_label,
                unit_price=unit_price,
                quantity=cart_item.quantity,
                note=cart_item.note.strip() if cart_item.note else None
            )
        )

    # 4. Create Order
    new_order = Order(
        table_id=table.id,
        status="received",
        note=payload.note.strip() if payload.note else None,
        total=round(total_amount, 2),
        created_at=datetime.utcnow()
    )
    new_order.items = order_items_to_create
    db.add(new_order)
    db.commit()
    db.refresh(new_order)

    # 5. Broadcast to kitchen live dashboard
    order_dict = format_order_response(new_order)
    await manager.broadcast_order_created(order_dict)

    return order_dict

@app.get("/api/orders/{order_id}", response_model=OrderResponse)
def get_order_by_id(order_id: int, db: Session = Depends(get_db)):
    """Customer live tracking endpoint."""
    order = db.query(Order).options(joinedload(Order.items), joinedload(Order.table)).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return format_order_response(order)


# ==========================================
# KITCHEN & STAFF ENDPOINTS
# ==========================================

@app.get("/api/orders", response_model=List[OrderResponse])
def get_orders(
    status_filter: Optional[str] = None,
    table_number: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff_or_admin)
):
    """Staff dashboard list of orders with optional filtering."""
    query = db.query(Order).options(joinedload(Order.items), joinedload(Order.table))

    if status_filter and status_filter.lower() != "all":
        query = query.filter(Order.status == status_filter.lower())

    if table_number:
        query = query.join(RestaurantTable).filter(RestaurantTable.number == table_number)

    orders = query.order_by(desc(Order.created_at)).all()
    return [format_order_response(o) for o in orders]

@app.patch("/api/orders/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: int,
    payload: OrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff_or_admin)
):
    """Update order status (accepted, preparing, served, completed, rejected)."""
    valid_statuses = ["received", "accepted", "preparing", "served", "completed", "rejected"]
    if payload.status.lower() not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")

    order = db.query(Order).options(joinedload(Order.items), joinedload(Order.table)).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status = payload.status.lower()
    if payload.reject_reason:
        order.reject_reason = payload.reject_reason

    db.commit()
    db.refresh(order)

    # Broadcast status change to both kitchen and tracking customer
    order_dict = format_order_response(order)
    await manager.broadcast_order_status_updated(
        order_id=order.id,
        status=order.status,
        reject_reason=order.reject_reason,
        order_dict=order_dict
    )

    return order_dict

@app.get("/api/tables/{table_number}/bill")
def get_table_bill(
    table_number: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff_or_admin)
):
    """
    Generate printable bill for a table combining all non-rejected orders.
    """
    table = db.query(RestaurantTable).filter(RestaurantTable.number == table_number).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    # Get active / non-rejected orders for this table
    orders = db.query(Order).options(joinedload(Order.items)).filter(
        Order.table_id == table.id,
        Order.status != "rejected"
    ).order_by(Order.created_at.asc()).all()

    # Consolidate items
    consolidated_items = {}
    grand_total = 0.0

    for order in orders:
        for it in order.items:
            key = f"{it.item_name}___{it.variant_label or ''}___{it.unit_price}"
            if key not in consolidated_items:
                consolidated_items[key] = {
                    "item_name": it.item_name,
                    "variant_label": it.variant_label,
                    "unit_price": it.unit_price,
                    "quantity": 0,
                    "subtotal": 0.0
                }
            consolidated_items[key]["quantity"] += it.quantity
            consolidated_items[key]["subtotal"] += it.unit_price * it.quantity
            grand_total += it.unit_price * it.quantity

    return {
        "restaurant_name": RESTAURANT_NAME,
        "currency_symbol": CURRENCY_SYMBOL,
        "table_number": table.number,
        "bill_time": datetime.utcnow().isoformat(),
        "order_ids": [o.id for o in orders],
        "items": list(consolidated_items.values()),
        "grand_total": round(grand_total, 2)
    }


# ==========================================
# ADMIN & MANAGEMENT ENDPOINTS
# ==========================================

@app.post("/api/categories", response_model=CategoryResponse)
async def create_category(cat: CategoryCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    existing = db.query(Category).filter(Category.name.ilike(cat.name)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category name already exists")
    new_cat = Category(name=cat.name, sort_order=cat.sort_order)
    db.add(new_cat)
    db.commit()
    db.refresh(new_cat)
    await manager.broadcast_menu_updated("CATEGORY_CREATED", {"category_id": new_cat.id})
    return new_cat

@app.put("/api/categories/{category_id}", response_model=CategoryResponse)
async def update_category(category_id: int, cat: CategoryUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    if cat.name is not None:
        category.name = cat.name
    if cat.sort_order is not None:
        category.sort_order = cat.sort_order
    db.commit()
    db.refresh(category)
    await manager.broadcast_menu_updated("CATEGORY_UPDATED", {"category_id": category.id})
    return category

@app.delete("/api/categories/{category_id}")
async def delete_category(category_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(category)
    db.commit()
    await manager.broadcast_menu_updated("CATEGORY_DELETED", {"category_id": category_id})
    return {"message": "Category deleted"}

@app.patch("/api/categories/reorder")
async def reorder_categories(payload: CategoryReorderRequest, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    for item in payload.categories:
        db.query(Category).filter(Category.id == item.id).update({"sort_order": item.sort_order})
    db.commit()
    await manager.broadcast_menu_updated("CATEGORIES_REORDERED")
    return {"message": "Categories reordered successfully"}

# Menu Items CRUD
@app.post("/api/items", response_model=MenuItemResponse)
async def create_menu_item(item_data: MenuItemCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    new_item = MenuItem(
        category_id=item_data.category_id,
        name=item_data.name,
        description=item_data.description,
        image_url=item_data.image_url,
        is_veg=item_data.is_veg,
        base_price=item_data.base_price,
        is_available=item_data.is_available,
        is_hidden=item_data.is_hidden,
        sort_order=item_data.sort_order
    )
    db.add(new_item)
    db.flush()

    if item_data.variants:
        for v in item_data.variants:
            db.add(ItemVariant(item_id=new_item.id, label=v.label, price=v.price))

    db.commit()
    db.refresh(new_item)
    await manager.broadcast_menu_updated("ITEM_CREATED", {"item_id": new_item.id})
    return new_item

@app.put("/api/items/{item_id}", response_model=MenuItemResponse)
async def update_menu_item(item_id: int, item_data: MenuItemUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    if item_data.name is not None:
        item.name = item_data.name
    if item_data.category_id is not None:
        item.category_id = item_data.category_id
    if item_data.description is not None:
        item.description = item_data.description
    if item_data.image_url is not None:
        item.image_url = item_data.image_url
    if item_data.is_veg is not None:
        item.is_veg = item_data.is_veg
    if item_data.base_price is not None:
        item.base_price = item_data.base_price
    if item_data.is_available is not None:
        item.is_available = item_data.is_available
    if item_data.is_hidden is not None:
        item.is_hidden = item_data.is_hidden
    if item_data.sort_order is not None:
        item.sort_order = item_data.sort_order

    if item_data.variants is not None:
        # replace variants
        db.query(ItemVariant).filter(ItemVariant.item_id == item.id).delete()
        for v in item_data.variants:
            db.add(ItemVariant(item_id=item.id, label=v.label, price=v.price))

    db.commit()
    db.refresh(item)
    await manager.broadcast_menu_updated("ITEM_UPDATED", {"item_id": item.id})
    return item

@app.delete("/api/items/{item_id}")
async def delete_menu_item(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    await manager.broadcast_menu_updated("ITEM_DELETED", {"item_id": item_id})
    return {"message": "Item deleted"}

@app.patch("/api/items/{item_id}/toggle-availability")
async def toggle_availability(
    item_id: int,
    payload: QuickToggleAvailable,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff_or_admin)
):
    """Quick one-tap sold-out toggle for staff and owner."""
    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.is_available = payload.is_available
    db.commit()
    await manager.broadcast_menu_updated("ITEM_AVAILABILITY_TOGGLED", {"item_id": item.id, "is_available": item.is_available})
    return {"item_id": item.id, "is_available": item.is_available}

@app.patch("/api/items/{item_id}/toggle-hidden")
async def toggle_hidden(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.is_hidden = not item.is_hidden
    db.commit()
    await manager.broadcast_menu_updated("ITEM_HIDDEN_TOGGLED", {"item_id": item.id, "is_hidden": item.is_hidden})
    return {"item_id": item.id, "is_hidden": item.is_hidden}

@app.post("/api/menu/bulk-prices")
async def bulk_update_prices(
    payload: BulkPriceUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Bulk update prices for items and variants."""
    updated_count = 0
    for update in payload.updates:
        if update.variant_id:
            variant = db.query(ItemVariant).filter(ItemVariant.id == update.variant_id).first()
            if variant and update.variant_price is not None:
                variant.price = update.variant_price
                updated_count += 1
        else:
            item = db.query(MenuItem).filter(MenuItem.id == update.item_id).first()
            if item:
                item.base_price = update.base_price
                updated_count += 1

    db.commit()
    await manager.broadcast_menu_updated("BULK_PRICES_UPDATED", {"updated_count": updated_count})
    return {"message": f"Successfully updated {updated_count} price entries"}

# Photo upload
@app.post("/api/upload")
async def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(require_admin)
):
    """Upload photo for menu items."""
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in [".jpg", ".jpeg", ".png", ".webp", ".avif"]:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, WEBP, and AVIF images are allowed")

    unique_filename = f"{uuid.uuid4().hex}{file_ext}"
    dest_path = UPLOAD_DIR / unique_filename

    contents = await file.read()
    with open(dest_path, "wb") as f:
        f.write(contents)

    return {"image_url": f"/uploads/{unique_filename}"}

# Table management
@app.get("/api/tables", response_model=List[TableResponse])
def get_tables(db: Session = Depends(get_db), current_user: User = Depends(require_staff_or_admin)):
    return db.query(RestaurantTable).order_by(RestaurantTable.number.asc()).all()

@app.post("/api/tables", response_model=TableResponse)
def create_table(payload: TableCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    existing = db.query(RestaurantTable).filter(RestaurantTable.number == payload.number).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Table {payload.number} already exists")

    new_token = payload.token or secrets.token_hex(4)
    table = RestaurantTable(number=payload.number, token=new_token)
    db.add(table)
    db.commit()
    db.refresh(table)
    return table

@app.delete("/api/tables/{table_id}")
def delete_table(table_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    table = db.query(RestaurantTable).filter(RestaurantTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    db.delete(table)
    db.commit()
    return {"message": f"Table {table.number} deleted"}

@app.post("/api/tables/{table_id}/regenerate-token", response_model=TableResponse)
def regenerate_table_token(table_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    table = db.query(RestaurantTable).filter(RestaurantTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    table.token = secrets.token_hex(4)
    db.commit()
    db.refresh(table)
    return table

# Order History & Reports
@app.get("/api/admin/reports/sales")
def get_sales_report(
    date_str: Optional[str] = None, # YYYY-MM-DD
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Order history, total revenue, daily breakdown."""
    query = db.query(Order).options(joinedload(Order.items), joinedload(Order.table))

    if date_str:
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            start_dt = datetime.combine(target_date, datetime.min.time())
            end_dt = datetime.combine(target_date, datetime.max.time())
            query = query.filter(Order.created_at >= start_dt, Order.created_at <= end_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    orders = query.order_by(desc(Order.created_at)).all()

    total_revenue = sum(o.total for o in orders if o.status != "rejected")
    served_completed_count = sum(1 for o in orders if o.status in ["served", "completed"])
    total_orders = len(orders)

    return {
        "date": date_str or "all_time",
        "total_revenue": round(total_revenue, 2),
        "total_orders": total_orders,
        "completed_or_served": served_completed_count,
        "orders": [format_order_response(o) for o in orders]
    }


# ==========================================
# AUTHENTICATION
# ==========================================

@app.post("/api/login", response_model=TokenResponse)
@app.post("/api/auth/login", response_model=TokenResponse)
def login(creds: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == creds.username).first()
    if not user or not verify_password(creds.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    access_token = create_access_token(data={"sub": user.username, "role": user.role})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "username": user.username
    }

@app.get("/api/auth/me", response_model=UserResponse)
def get_my_profile(current_user: User = Depends(get_current_user)):
    return current_user


# ==========================================
# WEBSOCKET CHANNELS
# ==========================================

@app.websocket("/ws/orders")
async def websocket_kitchen_orders(websocket: WebSocket):
    """Kitchen staff WebSocket connection for instant order alerts."""
    await manager.connect_kitchen(websocket)
    try:
        while True:
            # Keep connection alive, listen for ping/pong or client messages
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_kitchen(websocket)
    except Exception:
        manager.disconnect_kitchen(websocket)

@app.websocket("/ws/orders/{order_id}")
async def websocket_customer_order(websocket: WebSocket, order_id: int):
    """Customer table WebSocket connection for instant status updates on placed order."""
    await manager.connect_customer(websocket, order_id)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_customer(websocket, order_id)
    except Exception:
        manager.disconnect_customer(websocket, order_id)

@app.websocket("/ws/menu")
async def websocket_menu(websocket: WebSocket):
    """Live WebSocket channel for real-time menu updates across customer devices, admin, and kitchen."""
    await manager.connect_menu(websocket)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_menu(websocket)
    except Exception:
        manager.disconnect_menu(websocket)


# ==========================================
# PRODUCTION SPA FRONTEND SERVING
# ==========================================
frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if frontend_dist.exists() and (frontend_dist / "index.html").exists():
    if (frontend_dist / "assets").exists():
        app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="spa-assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("ws/") or full_path.startswith("uploads/"):
            raise HTTPException(status_code=404, detail="Not Found")
        
        target_file = frontend_dist / full_path
        if full_path and target_file.exists() and target_file.is_file():
            return FileResponse(str(target_file))
        
        return FileResponse(str(frontend_dist / "index.html"))

