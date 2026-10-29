# 👑 Biriyani House - Production-Ready Table QR Ordering Platform

A complete, high-performance table QR-code ordering and kitchen management system built for high-volume dining. Customers scan a table QR code on their phone, explore the menu, customize portions, and place orders directly to the kitchen display in real time. Kitchen staff manage incoming tickets with instant audio-visual alerts and print consolidated table bills, while restaurant owners manage menu pricing, quick sold-out toggles, categories, and printable table QR stands.

---

## 🌟 Architecture & Features

### 1. Customer Mobile Experience (`/menu?table=7&token=...`)
- **Table QR Access**: Reads `table` and `token` query parameters directly from the scanned QR stand. Shows "Table 7" in the header.
- **Manual Table Entry**: If a customer navigates directly to `/menu` without a QR code, an interactive modal allows entering the table number and token.
- **Security & Integrity**: Backend strictly verifies table tokens and recalculates all prices on the server. Client-submitted prices are never trusted.
- **Rate-Limiting**: Enforces a sliding-window rate limit (e.g. max 3 orders/minute per table) with friendly error notices.
- **Sticky Category Bar**: Smooth scroll spy highlights active categories and jumps smoothly to sections on tap.
- **Dietary Indicators**: Standard Indian Veg (green) and Non-Veg (red) dots beside every item.
- **Portion & Size Variants**: Chip selector for items with sizes (e.g. *Thanthoori: Quarter ₹140 / Half ₹250 / Full ₹450*).
- **"Ask Staff" & Sold-Out States**: Items without set prices display "Ask staff" and cannot be added. Sold-out items are greyed out with a clear badge.
- **Cart Drawer & Cooking Notes**: Quantity steppers (`- / qty / +`), item-specific cooking notes (e.g. *"less spicy"*, *"no onion"*), and overall kitchen instructions.
- **Live Order Tracker**: Real-time status stepper (**Received → Preparing → Served**) powered by WebSockets with a 5-second polling fallback.
- **Order More**: Customers can add items to their table anytime, creating sequential orders consolidated under the same table.

### 2. Kitchen Live Dashboard (`/kitchen`)
- **Live Ticket Cards**: Table number, elapsed time, item quantities, portion variants, item notes, and overall order instructions.
- **Instant Audio-Visual Alerts**: Plays a chime via the Web Audio API on new incoming orders and highlights tickets with a golden glow.
- **Status Workflow**: `Accept` → `Start Cooking (Preparing)` → `Mark as Served` → `Complete`. Includes a `Reject` option with custom reasons.
- **Filter Tabs**: *New & Accepted*, *Preparing*, *Served*, and *All Orders*.
- **Group by Table**: Consolidates multiple orders placed by the same table so staff can view everything a table has ordered.
- **Thermal Printable Bill**: Generates a clean, thermal-receipt style bill per table with itemized quantities, unit prices, and grand total.

### 3. Owner & Admin Management Panel (`/admin`)
- **Items & Categories**: Add, edit, delete categories, upload photos, manage size variants, toggle veg/non-veg, and hide/show items.
- **Quick Sold-Out Toggles**: One-tap toggle list for fast stock control when items run out during rush hours.
- **Bulk Price Editor**: Interactive spreadsheet-like view of all menu items and variants to set or adjust prices quickly.
- **Table QR Generator & Print Sheets**: View and manage dining tables, regenerate security tokens, and print QR code standees formatted with restaurant branding and table numbers.
- **Sales History & Analytics**: Filter order history by date with total revenue, ticket counts, and fulfilled orders metrics.

---

## 🎨 Design System & Theme Customization

The application is styled with a deep royal green and gold aesthetic:
- **Background**: Deep Forest Green (`#0B3D2E`)
- **Cards & Surfaces**: Darker Regal Green (`#062619`)
- **Accent**: Royal Metallic Gold (`#D4AF37`)
- **Typography**: *Playfair Display* (headings) + *Inter* (body text)
- **Primary Text**: Warm Cream (`#F5EFD9`)

### Single Config File Customization
- **Frontend Branding & Theme**: Edit [`frontend/src/config.js`](file:///c:/Users/shami%20ahamed/Desktop/New%20folder/frontend/src/config.js):
  ```javascript
  export const RESTAURANT_CONFIG = {
    restaurantName: "Biriyani House",
    tagline: "Royal Dum Biriyani & Tandoori Charcoal Grill",
    currencySymbol: "₹",
    rateLimitPerMinute: 3,
    theme: {
      bgDeep: "#0B3D2E",
      bgCard: "#062619",
      gold: "#D4AF37",
      cream: "#F5EFD9"
    }
  };
  ```
- **Backend Configuration**: Edit [`backend/.env`](file:///c:/Users/shami%20ahamed/Desktop/New%20folder/backend/.env):
  ```env
  DATABASE_URL=sqlite:///./biriyani.db
  SECRET_KEY=biriyani_secret_key_change_in_production_jwt_2026
  RESTAURANT_NAME=Biriyani House
  CURRENCY_SYMBOL=₹
  RATE_LIMIT_ORDERS_PER_MINUTE=3
  ```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Python**: 3.10+
- **Node.js**: v18+ (tested on v22)
- **npm**: v9+

---

### Step 1: Backend Setup & Seed Data

1. Open a terminal in the root folder:
   ```bash
   # Create and activate Python virtual environment
   python -m venv venv
   
   # Windows PowerShell:
   .\venv\Scripts\Activate.ps1
   # macOS / Linux:
   # source venv/bin/activate
   ```

2. Install backend dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```

3. Seed the database (populates all 13 categories, 60+ menu items, 10 tables with secure tokens, and default admin/staff credentials):
   ```bash
   python -m backend.seed_data
   ```

4. Start the FastAPI backend server:
   ```bash
   uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
   ```
   *The API will be live at `http://127.0.0.1:8000` with Swagger docs at `http://127.0.0.1:8000/docs`.*

---

### Step 2: Frontend Setup & Dev Server

1. In a second terminal, navigate to `frontend`:
   ```bash
   cd frontend
   npm install
   ```

2. Launch Vite development server:
   ```bash
   npm run dev
   ```
   *The frontend will run at `http://127.0.0.1:5173`.*

---

## 🔑 Default Credentials

| Portal | URL | Username | Password | Role |
| :--- | :--- | :--- | :--- | :--- |
| **Kitchen Dashboard** | `/kitchen` | `staff` | `staff123` | Staff / Kitchen Display |
| **Admin Panel** | `/admin` | `admin` | `admin123` | Owner / Administrator |
| **Login Portal** | `/login` | `staff` or `admin` | (see above) | Authentication |

> Quick Demo buttons on `/login` allow logging in as Chef or Owner in one click.

---

## 📱 Testing Table QR Codes

You can access any table directly with its unique security token:

| Table | Sample URL |
| :--- | :--- |
| **Table 1** | `http://127.0.0.1:5173/menu?table=1&token=30e22f77` |
| **Table 2** | `http://127.0.0.1:5173/menu?table=2&token=dea428d6` |
| **Table 7** | `http://127.0.0.1:5173/menu?table=7&token=8ff582c6` |
| **Table 10** | `http://127.0.0.1:5173/menu?table=10&token=8b94744a` |

To generate or print QR codes for all tables:
1. Go to `/admin` and sign in.
2. Click the **Table QR Codes** tab.
3. Click **Print All QR Codes Sheet** or individual **Print** on any table card.

---

## 🗄️ Database & PostgreSQL Migration

The project utilizes **SQLAlchemy 2.0 ORM** with clean model definitions.

### Switching to PostgreSQL in Production
To move from SQLite to PostgreSQL:
1. Install async or standard PostgreSQL driver:
   ```bash
   pip install psycopg2-binary
   ```
2. Update `DATABASE_URL` in `backend/.env`:
   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/biriyanidb
   ```
3. Restart the backend. SQLAlchemy automatically initializes the schema and tables.

---

## 🌐 Production Deployment

### Option A: Single-Server Deployment (Ubuntu / Nginx / Systemd)
1. **Build Frontend**:
   ```bash
   cd frontend
   npm run build
   ```
   The static files will be emitted to `frontend/dist`.
2. **Serve with Nginx**:
   Configure Nginx to serve `frontend/dist` for root `/` and reverse-proxy `/api` and `/ws` to `127.0.0.1:8000`:
   ```nginx
   server {
       listen 80;
       server_name your-restaurant.com;

       root /var/www/biriyani/frontend/dist;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }

       location /api/ {
           proxy_pass http://127.0.0.1:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }

       location /ws/ {
           proxy_pass http://127.0.0.1:8000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "Upgrade";
           proxy_set_header Host $host;
       }

       location /uploads/ {
           proxy_pass http://127.0.0.1:8000;
       }
   }
   ```
3. **Run Backend Service via Gunicorn / Uvicorn**:
   ```bash
   gunicorn backend.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 127.0.0.1:8000
   ```

---

## 🧪 Automated Tests

Run the comprehensive API test suite verifying pricing calculations, variant handling, token rejection, and table billing:
```bash
python test_backend.py
```
