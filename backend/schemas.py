from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict

# Variant Schemas
class ItemVariantBase(BaseModel):
    label: str
    price: float

class ItemVariantCreate(ItemVariantBase):
    pass

class ItemVariantResponse(ItemVariantBase):
    id: int
    item_id: int

    model_config = ConfigDict(from_attributes=True)


# Menu Item Schemas
class MenuItemBase(BaseModel):
    name: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    is_veg: bool = False
    base_price: Optional[float] = None
    is_available: bool = True
    is_hidden: bool = False
    sort_order: int = 0

class MenuItemCreate(MenuItemBase):
    category_id: int
    variants: Optional[List[ItemVariantCreate]] = None

class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    category_id: Optional[int] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    is_veg: Optional[bool] = None
    base_price: Optional[float] = None
    is_available: Optional[bool] = None
    is_hidden: Optional[bool] = None
    sort_order: Optional[int] = None
    variants: Optional[List[ItemVariantCreate]] = None

class MenuItemResponse(MenuItemBase):
    id: int
    category_id: int
    variants: List[ItemVariantResponse] = []

    model_config = ConfigDict(from_attributes=True)


# Category Schemas
class CategoryBase(BaseModel):
    name: str
    sort_order: int = 0

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    sort_order: Optional[int] = None

class CategoryResponse(CategoryBase):
    id: int
    items: List[MenuItemResponse] = []

    model_config = ConfigDict(from_attributes=True)

class CategoryReorderItem(BaseModel):
    id: int
    sort_order: int

class CategoryReorderRequest(BaseModel):
    categories: List[CategoryReorderItem]


# Table Schemas
class TableCreate(BaseModel):
    number: int
    token: Optional[str] = None

class TableResponse(BaseModel):
    id: int
    number: int
    token: str

    model_config = ConfigDict(from_attributes=True)


# Order Creation Schemas
class CartItemIn(BaseModel):
    menu_item_id: int
    variant_id: Optional[int] = None
    quantity: int = Field(..., ge=1)
    note: Optional[str] = None

class OrderCreateRequest(BaseModel):
    table_number: int
    table_token: str
    note: Optional[str] = None
    items: List[CartItemIn]


# Order Item & Order Responses
class OrderItemResponse(BaseModel):
    id: int
    item_name: str
    variant_label: Optional[str] = None
    unit_price: float
    quantity: int
    note: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class OrderResponse(BaseModel):
    id: int
    table_id: int
    table_number: int
    status: str
    reject_reason: Optional[str] = None
    note: Optional[str] = None
    total: float
    created_at: datetime
    items: List[OrderItemResponse] = []

    model_config = ConfigDict(from_attributes=True)

class OrderStatusUpdate(BaseModel):
    status: str # "received", "accepted", "preparing", "served", "completed", "rejected"
    reject_reason: Optional[str] = None


# Bulk Price Update
class BulkPriceItem(BaseModel):
    item_id: int
    base_price: Optional[float] = None
    variant_id: Optional[int] = None
    variant_price: Optional[float] = None

class BulkPriceUpdateRequest(BaseModel):
    updates: List[BulkPriceItem]


# Quick Toggle Available
class QuickToggleAvailable(BaseModel):
    is_available: bool


# Auth Schemas
class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str
    role: str = "staff" # "admin" or "staff"

class ChangePasswordRequest(BaseModel):
    username: str
    current_password: Optional[str] = None
    new_password: str

class AdminUpdatePasswordRequest(BaseModel):
    new_password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str

class UserResponse(BaseModel):
    id: int
    username: str
    role: str

    model_config = ConfigDict(from_attributes=True)
