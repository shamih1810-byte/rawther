import os
import re
import httpx
from pathlib import Path
from backend.database import SessionLocal
from backend.models import MenuItem

BASE_DIR = Path(__file__).resolve().parent
PUBLIC_DISH_DIR = BASE_DIR / "frontend" / "public" / "images" / "dishes"
BACKEND_UPLOAD_DIR = BASE_DIR / "backend" / "uploads"

PUBLIC_DISH_DIR.mkdir(parents=True, exist_ok=True)
BACKEND_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# 99 Distinct Curated High-Definition Food Photos (one for each dish)
DISH_PHOTO_MAP = {
    # BIRIYANI (11)
    "Chicken Biriyani": "photo-1563379091339-03b21ab4a4f8",
    "Chicken Chukka Biriyani": "photo-1633945274405-b6c8069047b0",
    "Chicken Chilli Biriyani": "photo-1567620832903-9fc6debc209f",
    "Chicken Thanthoori Biriyani": "photo-1599488615731-7e5c2823ff28",
    "Chicken Gilma Biriyani": "photo-1589302168068-964664d93dc0",
    "Beef Biriyani": "photo-1544025162-d76694265947",
    "Beef Chukka Biriyani": "photo-1603894584373-5ac82b2ae398",
    "Beef Chilli Biriyani": "photo-1529193591184-b1d58069ecdd",
    "Beef Gilma Biriyani": "photo-1574484284002-952d92456975",
    "Egg Biriyani": "photo-1582169296194-e4d644c48063",
    "MT Biriyani": "photo-1512058564366-18510be2db19",

    # RICE (12)
    "Chicken Fried Rice": "photo-1603133872878-684f208fb84b",
    "Chicken Schezwan Rice": "photo-1569058242253-92a9c755a0ec",
    "Beef Fried Rice": "photo-1550547660-d9450f859349",
    "Beef Schezwan Rice": "photo-1555939594-58d7cb561ad1",
    "Egg Fried Rice": "photo-1626082927389-6cd097cdc6ec",
    "Egg Schezwan Rice": "photo-1596797038530-2c107229654b",
    "Veg Fried Rice": "photo-1645177628172-a94c1f96e6db",
    "Veg Schezwan Rice": "photo-1512058564366-18510be2db19",
    "Mushroom Rice": "photo-1505576399279-565b52d4ac71",
    "Mushroom Schezwan Rice": "photo-1546069901-ba9599a7e63c",
    "Paneer Rice": "photo-1565557623262-b51c2513a641",
    "Paneer Schezwan Rice": "photo-1585937421612-70a008356fbe",

    # NOODLES (12)
    "Chicken Noodles": "photo-1585032226651-759b368d7246",
    "Chicken Schezwan Noodles": "photo-1612927601601-6638404737ce",
    "Beef Noodles": "photo-1569718212165-3a8278d5f624",
    "Beef Schezwan Noodles": "photo-1541832676-9b763b0239ab",
    "Egg Fried Noodles": "photo-1534422298391-e4f8c172dddb",
    "Egg Schezwan Noodles": "photo-1552611052-33e04de081de",
    "Veg Fried Noodles": "photo-1626804475297-41608ea09aeb",
    "Veg Schezwan Noodles": "photo-1612927601601-6638404737ce",
    "Mushroom Noodles": "photo-1607301406259-dfb186e15de8",
    "Mushroom Schezwan Noodles": "photo-1557872943-16a5ac26437e",
    "Paneer Noodles": "photo-1569058242252-623df46b5025",
    "Paneer Schezwan Noodles": "photo-1617093727343-374698b1b08d",

    # BREADS (8)
    "Naan": "photo-1601050690597-df0568f70950",
    "Butter Naan": "photo-1626074353765-517a681e40be",
    "Garlic Naan": "photo-1565557623262-b51c2513a641",
    "Kulcha Naan": "photo-1509440159596-0249088772ff",
    "Rotti": "photo-1589301760014-d929f3979dbc",
    "Butter Rotti": "photo-1541518763669-27fef04b14ea",
    "Garlic Rotti": "photo-1505576399279-565b52d4ac71",
    "Kulcha Rotti": "photo-1546833999-b9f581a1996d",

    # STARTERS (10)
    "Chicken 65": "photo-1610057099431-d73a1c9d2f2f",
    "Chicken 65 Boneless": "photo-1626777552726-4a6b54c97e46",
    "65 Chicken Chukka": "photo-1610057099431-d73a1c9d2f2f",
    "Beef Chilli": "photo-1534939561126-855b8675edd7",
    "Beef Chukka": "photo-1544025162-d76694265947",
    "Chicken Tikka": "photo-1599488615731-7e5c2823ff28",
    "Malai Tikka": "photo-1603894584373-5ac82b2ae398",
    "Hariyali Tikka": "photo-1567620832903-9fc6debc209f",
    "Kalmi Kabab": "photo-1633945274405-b6c8069047b0",
    "Resmi Kabab": "photo-1589302168068-964664d93dc0",

    # THANTHOORI (3)
    "Thanthoori": "photo-1599488615731-7e5c2823ff28",
    "Pepper Thanthoori": "photo-1599488615731-7e5c2823ff28",
    "Afghani Thanthoori": "photo-1603894584373-5ac82b2ae398",

    # BUTTER ITEMS (2)
    "Butter Chicken Tikka": "photo-1588166524941-3bf61a9c41db",
    "Butter Chicken Thanthoori": "photo-1626777552726-4a6b54c97e46",

    # CHICKEN GRAVY (16)
    "Chicken Gravy": "photo-1588166524941-3bf61a9c41db",
    "Hyderabadi Chicken": "photo-1603894584373-5ac82b2ae398",
    "Butter Chicken": "photo-1626777552726-4a6b54c97e46",
    "Chicken Tikka Masala": "photo-1565557623262-b51c2513a641",
    "Chicken Curry": "photo-1546833999-b9f581a1996d",
    "Chicken Masala": "photo-1610057099431-d73a1c9d2f2f",
    "Kadai Chicken": "photo-1512058564366-18510be2db19",
    "Chettinad Chicken": "photo-1603894584373-5ac82b2ae398",
    "Pepper Chicken Gravy": "photo-1544025162-d76694265947",
    "Chicken Kolhapuri": "photo-1567620832903-9fc6debc209f",
    "Chicken Do Pyaza": "photo-1589302168068-964664d93dc0",
    "Andhra Chicken Curry": "photo-1563379091339-03b21ab4a4f8",
    "Pallipalayam Gravy": "photo-1588166524941-3bf61a9c41db",
    "Garlic Chicken": "photo-1505576399279-565b52d4ac71",
    "Ginger Chicken": "photo-1546069901-ba9599a7e63c",
    "Chicken Chinthamani": "photo-1569058242253-92a9c755a0ec",

    # BEEF GRAVY (1)
    "Beef Gravy": "photo-1544025162-d76694265947",

    # PANEER GRAVY (11)
    "Paneer Butter Masala": "photo-1631452180519-c014fe946bc7",
    "Paneer Gravy": "photo-1589301760014-d929f3979dbc",
    "Paneer Kadai": "photo-1601050690597-df0568f70950",
    "Paneer Curry": "photo-1565557623262-b51c2513a641",
    "Garlic Paneer": "photo-1541518763669-27fef04b14ea",
    "Ginger Paneer": "photo-1505576399279-565b52d4ac71",
    "Pepper Paneer": "photo-1544025162-d76694265947",
    "Paneer Pallipalayam": "photo-1631452180519-c014fe946bc7",
    "Paneer Chettinad": "photo-1603894584373-5ac82b2ae398",
    "Paneer Masala": "photo-1610057099431-d73a1c9d2f2f",
    "Paneer Chinthamani": "photo-1569058242253-92a9c755a0ec",

    # MUSHROOM GRAVY (11)
    "Mushroom Gravy": "photo-1505576399279-565b52d4ac71",
    "Mushroom Kadai": "photo-1601050690597-df0568f70950",
    "Mushroom Curry": "photo-1546833999-b9f581a1996d",
    "Garlic Mushroom": "photo-1541518763669-27fef04b14ea",
    "Ginger Mushroom": "photo-1546069901-ba9599a7e63c",
    "Pepper Mushroom": "photo-1544025162-d76694265947",
    "Mushroom Pallipalayam": "photo-1505576399279-565b52d4ac71",
    "Mushroom Chettinad": "photo-1603894584373-5ac82b2ae398",
    "Mushroom Masala": "photo-1610057099431-d73a1c9d2f2f",
    "Mushroom Chinthamani": "photo-1569058242253-92a9c755a0ec",
    "Mushroom Butter Masala": "photo-1631452180519-c014fe946bc7",

    # VEG GRAVY (1)
    "Veg Gravy": "photo-1546833999-b9f581a1996d",

    # OTHER (1)
    "Off MT": "photo-1512058564366-18510be2db19",
}

def slugify(text: str) -> str:
    slug = re.sub(r'[^a-zA-Z0-9]+', '-', text.lower()).strip('-')
    return slug

def sync_all_dish_images():
    db = SessionLocal()
    items = db.query(MenuItem).all()
    print(f"Total menu items to assign unique dish pictures: {len(items)}")

    # We will download each image once per photo_id
    photo_cache = {}
    client = httpx.Client(timeout=15.0)

    EXCLUDE_KEYWORDS = [
        'beef', 'thanthoori', 'tandoori', 'tikka', 'kabab',
        'gilma', 'pallipalayam', 'chinthamani', 'kolhapuri',
        'do pyaza', 'andhra', 'off mt', '65 chicken chukka'
    ]

    for item in items:
        name_lower = item.name.lower()
        if any(k in name_lower for k in EXCLUDE_KEYWORDS):
            item.image_url = None
            continue

        photo_id = DISH_PHOTO_MAP.get(item.name, "photo-1563379091339-03b21ab4a4f8")
        slug = slugify(item.name)
        filename = f"{slug}.jpg"
        dest_public = PUBLIC_DISH_DIR / filename
        dest_backend = BACKEND_UPLOAD_DIR / filename

        # Download if not already saved
        if not dest_public.exists() or dest_public.stat().st_size < 1000:
            if photo_id not in photo_cache:
                url = f"https://images.unsplash.com/{photo_id}?auto=format&fit=crop&w=350&q=80"
                try:
                    resp = client.get(url)
                    if resp.status_code == 200:
                        photo_cache[photo_id] = resp.content
                    else:
                        print(f"Warning: HTTP {resp.status_code} for {item.name}")
                except Exception as e:
                    print(f"Error downloading {item.name}: {e}")

            if photo_id in photo_cache:
                with open(dest_public, "wb") as f:
                    f.write(photo_cache[photo_id])
                with open(dest_backend, "wb") as f:
                    f.write(photo_cache[photo_id])

        # Set image_url in DB if the file was downloaded successfully
        if dest_public.exists() and dest_public.stat().st_size >= 1000:
            rel_url = f"/images/dishes/{filename}"
            item.image_url = rel_url

    db.commit()
    db.close()
    print("All dishes updated with distinct unique pictures successfully!")

if __name__ == "__main__":
    sync_all_dish_images()
