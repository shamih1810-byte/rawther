import secrets
from sqlalchemy.orm import Session
from .database import engine, Base, SessionLocal
from .models import Category, MenuItem, ItemVariant, RestaurantTable, User
from .auth import hash_password
from .config import ADMIN_USERNAME, ADMIN_PASSWORD, STAFF_USERNAME, STAFF_PASSWORD

DEFAULT_TABLE_TOKENS = {
    1: '30e22f77',
    2: 'dea428d6',
    3: 'd179f486',
    4: '1ab56c1e',
    5: '50c791a4',
    6: 'c58db83b',
    7: '8ff582c6',
    8: 'f0211066',
    9: '90388afa',
    10: '8b94744a'
}

def seed_database():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        # 1. Ensure default tables 1-10 exist and have stable tokens
        print("Synchronizing restaurant tables 1-10...")
        for table_num in range(1, 11):
            tok = DEFAULT_TABLE_TOKENS.get(table_num, secrets.token_hex(4))
            existing_table = db.query(RestaurantTable).filter(RestaurantTable.number == table_num).first()
            if not existing_table:
                db.add(RestaurantTable(number=table_num, token=tok))
            elif not existing_table.token or existing_table.token != tok:
                existing_table.token = tok
        db.commit()

        # 2. Ensure initial users exist
        if db.query(User).count() == 0:
            print("Seeding initial users...")
            admin_user = User(
                username=ADMIN_USERNAME,
                password_hash=hash_password(ADMIN_PASSWORD),
                role="admin"
            )
            staff_user = User(
                username=STAFF_USERNAME,
                password_hash=hash_password(STAFF_PASSWORD),
                role="staff"
            )
            db.add_all([admin_user, staff_user])
            db.commit()

        # 3. Check if categories and menu items already exist
        if db.query(Category).count() > 0:
            print("Database already contains categories and menu items.")
            return

        print("Seeding categories and menu items...")
        menu_data = [
            {
                "category": "BIRIYANI",
                "items": [
                    {"name": "Chicken Biriyani", "price": 150.0, "is_veg": False, "desc": "Fragrant seeraga samba rice cooked with tender chicken cuts, rich spices, and fresh herbs."},
                    {"name": "Chicken Chukka Biriyani", "price": 180.0, "is_veg": False, "desc": "Flavorful aromatic biriyani topped with dry-roasted spicy chicken chukka."},
                    {"name": "Chicken Chilli Biriyani", "price": 170.0, "is_veg": False, "desc": "Zesty spicy biriyani infused with crispy stir-fried chili chicken pieces."},
                    {"name": "Chicken Thanthoori Biriyani", "price": 240.0, "is_veg": False, "desc": "Dum biriyani crowned with charcoal-grilled smoky tandoori chicken leg."},
                    {"name": "Chicken Gilma Biriyani", "price": 180.0, "is_veg": False, "desc": "Special house-blend juicy gravy-tossed chicken over piping hot biriyani."},
                    {"name": "Beef Biriyani", "price": 150.0, "is_veg": False, "desc": "Slow-cooked succulent beef chunks layered with fragrant spiced rice."},
                    {"name": "Beef Chukka Biriyani", "price": 160.0, "is_veg": False, "desc": "Aromatic biriyani served with tender pan-roasted pepper beef chukka."},
                    {"name": "Beef Chilli Biriyani", "price": None, "is_veg": False, "desc": "Tossed chili beef over seasoned dum biriyani."},
                    {"name": "Beef Gilma Biriyani", "price": 200.0, "is_veg": False, "desc": "Rich, spicy masala infused tender beef over aromatic rice."},
                    {"name": "Egg Biriyani", "price": 130.0, "is_veg": False, "desc": "Fragrant spiced rice layered with two seasoned, pan-seared boiled eggs."},
                    {"name": "MT Biriyani", "price": 110.0, "is_veg": False, "desc": "Kuska biriyani rice cooked in rich aromatic meat broth."}
                ]
            },
            {
                "category": "RICE",
                "items": [
                    {"name": "Chicken Fried Rice", "price": 150.0, "is_veg": False, "desc": "Wok-tossed basmati rice with diced chicken, crisp greens, and soy aroma."},
                    {"name": "Chicken Schezwan Rice", "price": None, "is_veg": False, "desc": "Spicy wok-tossed rice with chicken in fiery Schezwan chili sauce."},
                    {"name": "Beef Fried Rice", "price": 170.0, "is_veg": False, "desc": "Wok-fried rice with tender shredded beef and scallions."},
                    {"name": "Beef Schezwan Rice", "price": None, "is_veg": False, "desc": "Spicy Schezwan rice loaded with stir-fried beef."},
                    {"name": "Egg Fried Rice", "price": None, "is_veg": False, "desc": "Fluffy fried rice tossed with scrambled farm-fresh eggs and scallions."},
                    {"name": "Egg Schezwan Rice", "price": None, "is_veg": False, "desc": "Spicy Schezwan sauce tossed with eggs and basmati rice."},
                    {"name": "Veg Fried Rice", "price": None, "is_veg": True, "desc": "Aromatic wok rice tossed with fresh carrots, beans, and cabbage."},
                    {"name": "Veg Schezwan Rice", "price": None, "is_veg": True, "desc": "Spicy garden vegetables stir-fried in zesty Schezwan sauce."},
                    {"name": "Mushroom Rice", "price": None, "is_veg": True, "desc": "Button mushrooms stir-fried with fragrant basmati and mild pepper."},
                    {"name": "Mushroom Schezwan Rice", "price": None, "is_veg": True, "desc": "Juicy mushrooms tossed in spicy garlic Schezwan chili sauce."},
                    {"name": "Paneer Rice", "price": None, "is_veg": True, "desc": "Golden fried cottage cheese cubes tossed with fluffy seasoned rice."},
                    {"name": "Paneer Schezwan Rice", "price": None, "is_veg": True, "desc": "Fresh cottage cheese wok-tossed in robust spicy Schezwan sauce."}
                ]
            },
            {
                "category": "NOODLES",
                "items": [
                    {"name": "Chicken Noodles", "price": None, "is_veg": False, "desc": "Wok-tossed noodles with shredded chicken and crunchy julienned veggies."},
                    {"name": "Chicken Schezwan Noodles", "price": None, "is_veg": False, "desc": "Fiery Schezwan noodles with sliced chicken and scallions."},
                    {"name": "Beef Noodles", "price": None, "is_veg": False, "desc": "Classic wok noodles with stir-fried marinated beef slices."},
                    {"name": "Beef Schezwan Noodles", "price": None, "is_veg": False, "desc": "Spicy Sichuan noodles with beef and crunchy greens."},
                    {"name": "Egg Fried Noodles", "price": None, "is_veg": False, "desc": "Tender noodles tossed with seasoned scrambled eggs."},
                    {"name": "Egg Schezwan Noodles", "price": None, "is_veg": False, "desc": "Eggs and noodles stir-fried in rich chili-garlic paste."},
                    {"name": "Veg Fried Noodles", "price": None, "is_veg": True, "desc": "Stir-fried noodles with crisp fresh vegetables."},
                    {"name": "Veg Schezwan Noodles", "price": None, "is_veg": True, "desc": "Spicy street-style vegetable noodles with Schezwan heat."},
                    {"name": "Mushroom Noodles", "price": None, "is_veg": True, "desc": "Sliced button mushrooms with savory noodles."},
                    {"name": "Mushroom Schezwan Noodles", "price": None, "is_veg": True, "desc": "Spicy noodles loaded with mushrooms."},
                    {"name": "Paneer Noodles", "price": None, "is_veg": True, "desc": "Soft paneer cubes tossed with garden noodles."},
                    {"name": "Paneer Schezwan Noodles", "price": None, "is_veg": True, "desc": "Paneer and noodles coated in fiery red Schezwan sauce."}
                ]
            },
            {
                "category": "BREADS",
                "items": [
                    {"name": "Naan", "price": 30.0, "is_veg": True, "desc": "Traditional tandoor-baked soft leavened Indian flatbread."},
                    {"name": "Butter Naan", "price": 40.0, "is_veg": True, "desc": "Warm freshly baked tandoori naan brushed with rich butter."},
                    {"name": "Garlic Naan", "price": 45.0, "is_veg": True, "desc": "Tandoor naan topped with minced roasted garlic and fresh coriander."},
                    {"name": "Kulcha Naan", "price": None, "is_veg": True, "desc": "Soft textured kulcha baked inside the clay oven."},
                    {"name": "Rotti", "price": 20.0, "is_veg": True, "desc": "Wholesome whole wheat tandoori roti."},
                    {"name": "Butter Rotti", "price": 30.0, "is_veg": True, "desc": "Crispy yet soft whole wheat roti topped with melted butter."},
                    {"name": "Garlic Rotti", "price": 35.0, "is_veg": True, "desc": "Whole wheat roti infused with garlic aroma."},
                    {"name": "Kulcha Rotti", "price": None, "is_veg": True, "desc": "Thick layered clay oven flatbread."}
                ]
            },
            {
                "category": "STARTERS",
                "items": [
                    {"name": "Chicken 65", "price": 150.0, "is_veg": False, "desc": "Deep-fried crispy chicken bites marinated in South Indian red spices and curry leaves."},
                    {"name": "Chicken 65 Boneless", "price": 200.0, "is_veg": False, "desc": "Tender boneless chicken morsels spiced and fried to golden perfection."},
                    {"name": "65 Chicken Chukka", "price": 180.0, "is_veg": False, "desc": "Crisp Chicken 65 tossed with shallots and coarse crushed black pepper."},
                    {"name": "Beef Chilli", "price": 170.0, "is_veg": False, "desc": "Tender beef slices stir-fried with green chilies, onions, and dark soy."},
                    {"name": "Beef Chukka", "price": 140.0, "is_veg": False, "desc": "Traditional pan-roasted dry beef tossed with coconut slices and crushed pepper."},
                    {"name": "Chicken Tikka", "price": 250.0, "is_veg": False, "desc": "Char-grilled boneless chicken chunks marinated in hung curd and tandoori spices."},
                    {"name": "Malai Tikka", "price": 280.0, "is_veg": False, "desc": "Melt-in-mouth chicken pieces marinated in heavy cream, cashew paste, and mild spices."},
                    {"name": "Hariyali Tikka", "price": 280.0, "is_veg": False, "desc": "Chicken skewers coated in fresh mint, coriander, and green chili marinade."},
                    {"name": "Kalmi Kabab", "price": None, "is_veg": False, "desc": "Juicy chicken drumsticks marinated in rich Mughlai spices."},
                    {"name": "Resmi Kabab", "price": None, "is_veg": False, "desc": "Silky smooth tandoori kebabs finished with egg glaze."}
                ]
            },
            {
                "category": "THANTHOORI (TANDOORI)",
                "items": [
                    {
                        "name": "Thanthoori",
                        "price": None,
                        "is_veg": False,
                        "desc": "Classic clay-oven roasted chicken marinated in yogurt, Kashmiri chili, and garam masala.",
                        "variants": [
                            {"label": "Quarter", "price": 140.0},
                            {"label": "Half", "price": 250.0},
                            {"label": "Full", "price": 450.0}
                        ]
                    },
                    {
                        "name": "Pepper Thanthoori",
                        "price": None,
                        "is_veg": False,
                        "desc": "Smoky tandoori chicken coated with freshly crushed black peppercorns and lime.",
                        "variants": [
                            {"label": "Quarter", "price": 200.0},
                            {"label": "Half", "price": 300.0},
                            {"label": "Full", "price": 500.0}
                        ]
                    },
                    {
                        "name": "Afghani Thanthoori",
                        "price": None,
                        "is_veg": False,
                        "desc": "Creamy rich tandoori chicken marinated in cashew paste, saffron, and cream.",
                        "variants": [
                            {"label": "Half", "price": 350.0},
                            {"label": "Full", "price": 700.0}
                        ]
                    }
                ]
            },
            {
                "category": "BUTTER ITEMS",
                "items": [
                    {"name": "Butter Chicken Tikka", "price": 350.0, "is_veg": False, "desc": "Smoky chicken tikka pieces served in a luscious velvety butter sauce."},
                    {"name": "Butter Chicken Thanthoori", "price": 250.0, "is_veg": False, "desc": "Char-grilled tandoori chicken smothered in seasoned golden butter."}
                ]
            },
            {
                "category": "CHICKEN GRAVY",
                "items": [
                    {"name": "Chicken Gravy", "price": 220.0, "is_veg": False, "desc": "Homestyle slow-simmered chicken curry with traditional spices."},
                    {"name": "Hyderabadi Chicken", "price": 250.0, "is_veg": False, "desc": "Rich Nizami chicken gravy prepared with fried onions, yogurt, and nuts."},
                    {"name": "Butter Chicken", "price": None, "is_veg": False, "desc": "Tender chicken cooked in creamy tomato, butter, and fenugreek gravy."},
                    {"name": "Chicken Tikka Masala", "price": None, "is_veg": False, "desc": "Roasted chicken tikka chunks simmered in a spiced tomato-cream curry."},
                    {"name": "Chicken Curry", "price": None, "is_veg": False, "desc": "Traditional country-style spiced chicken curry."},
                    {"name": "Chicken Masala", "price": None, "is_veg": False, "desc": "Thick semi-dry chicken masala gravy."},
                    {"name": "Kadai Chicken", "price": None, "is_veg": False, "desc": "Chicken cooked with crunchy bell peppers and roasted coriander seeds in an iron kadai."},
                    {"name": "Chettinad Chicken", "price": None, "is_veg": False, "desc": "Spicy Tamil Nadu style chicken cooked with roasted coconut, fennel, and kalpasi."},
                    {"name": "Pepper Chicken Gravy", "price": None, "is_veg": False, "desc": "Rich dark gravy flavored with intense Malabar black pepper."},
                    {"name": "Chicken Kolhapuri", "price": None, "is_veg": False, "desc": "Spicy Maharashtra special gravy made with roasted red chilies."},
                    {"name": "Chicken Do Pyaza", "price": None, "is_veg": False, "desc": "Tender chicken cooked with double the quantity of caramelized onions."},
                    {"name": "Andhra Chicken Curry", "price": None, "is_veg": False, "desc": "Fiery Andhra style chicken curry with Guntur chilies."},
                    {"name": "Pallipalayam Gravy", "price": None, "is_veg": False, "desc": "Authentic Kongunadu chicken cooked with shallots, garlic, and dried red chilies."},
                    {"name": "Garlic Chicken", "price": None, "is_veg": False, "desc": "Chicken simmered in an aromatic roasted garlic masala."},
                    {"name": "Ginger Chicken", "price": None, "is_veg": False, "desc": "Zesty ginger infused thick savory curry."},
                    {"name": "Chicken Chinthamani", "price": None, "is_veg": False, "desc": "Rustic chicken delicacy prepared with rustic dry chili seeds and shallots."}
                ]
            },
            {
                "category": "BEEF GRAVY",
                "items": [
                    {"name": "Beef Gravy", "price": 250.0, "is_veg": False, "desc": "Slow-cooked tender beef simmered in thick roasted spice gravy."}
                ]
            },
            {
                "category": "PANEER GRAVY",
                "items": [
                    {"name": "Paneer Butter Masala", "price": 250.0, "is_veg": True, "desc": "Fresh cottage cheese cubes in silky smooth tomato and cashew butter gravy."},
                    {"name": "Paneer Gravy", "price": None, "is_veg": True, "desc": "Classic homestyle paneer curry."},
                    {"name": "Paneer Kadai", "price": None, "is_veg": True, "desc": "Paneer cubes tossed with crisp bell peppers in crushed spice gravy."},
                    {"name": "Paneer Curry", "price": None, "is_veg": True, "desc": "Mild spiced yellow cottage cheese curry."},
                    {"name": "Garlic Paneer", "price": None, "is_veg": True, "desc": "Paneer cubes in robust roasted garlic gravy."},
                    {"name": "Ginger Paneer", "price": None, "is_veg": True, "desc": "Fresh ginger flavored paneer masala."},
                    {"name": "Pepper Paneer", "price": None, "is_veg": True, "desc": "Paneer tossed in spicy crushed pepper sauce."},
                    {"name": "Paneer Pallipalayam", "price": None, "is_veg": True, "desc": "Kongunadu style paneer cooked with shallots and dried red chilies."},
                    {"name": "Paneer Chettinad", "price": None, "is_veg": True, "desc": "Paneer simmered in aromatic Chettinad roasted spice paste."},
                    {"name": "Paneer Masala", "price": None, "is_veg": True, "desc": "Thick spiced tomato onion masala with paneer."},
                    {"name": "Paneer Chinthamani", "price": None, "is_veg": True, "desc": "Spicy country-style paneer cooked with round red chilies."}
                ]
            },
            {
                "category": "MUSHROOM GRAVY",
                "items": [
                    {"name": "Mushroom Gravy", "price": None, "is_veg": True, "desc": "Juicy button mushrooms cooked in homestyle spiced onion gravy."},
                    {"name": "Mushroom Kadai", "price": None, "is_veg": True, "desc": "Kadai-cooked mushrooms with capsicum and fresh ground spices."},
                    {"name": "Mushroom Curry", "price": None, "is_veg": True, "desc": "Savory mushroom curry in coconut onion base."},
                    {"name": "Garlic Mushroom", "price": None, "is_veg": True, "desc": "Roasted garlic flavored mushroom sauce."},
                    {"name": "Ginger Mushroom", "price": None, "is_veg": True, "desc": "Fresh ginger and mushroom masala."},
                    {"name": "Pepper Mushroom", "price": None, "is_veg": True, "desc": "Spicy black pepper tossed mushroom gravy."},
                    {"name": "Mushroom Pallipalayam", "price": None, "is_veg": True, "desc": "Kongunadu country style mushroom curry."},
                    {"name": "Mushroom Chettinad", "price": None, "is_veg": True, "desc": "Spicy Chettinad roasted spices with tender mushrooms."},
                    {"name": "Mushroom Masala", "price": None, "is_veg": True, "desc": "Rich onion tomato gravy packed with button mushrooms."},
                    {"name": "Mushroom Chinthamani", "price": None, "is_veg": True, "desc": "Dry chili and shallot seasoned mushroom preparation."},
                    {"name": "Mushroom Butter Masala", "price": None, "is_veg": True, "desc": "Creamy butter and tomato gravy with sautéed mushrooms."}
                ]
            },
            {
                "category": "VEG GRAVY",
                "items": [
                    {"name": "Veg Gravy", "price": 180.0, "is_veg": True, "desc": "Mixed fresh seasonal vegetables cooked in an aromatic rich spiced gravy."}
                ]
            },
            {
                "category": "OTHER",
                "items": [
                    {"name": "Off MT", "price": 20.0, "is_veg": False, "desc": "Single portion of rich meat-infused kuska gravy."}
                ]
            }
        ]

        print("Seeding categories and menu items...")
        for cat_order, cat_data in enumerate(menu_data, start=1):
            category = Category(
                name=cat_data["category"],
                sort_order=cat_order
            )
            db.add(category)
            db.flush() # obtain category.id

            for item_order, item_dict in enumerate(cat_data["items"], start=1):
                menu_item = MenuItem(
                    category_id=category.id,
                    name=item_dict["name"],
                    description=item_dict.get("desc"),
                    is_veg=item_dict.get("is_veg", False),
                    base_price=item_dict.get("price"),
                    is_available=True,
                    is_hidden=False,
                    sort_order=item_order
                )
                db.add(menu_item)
                db.flush()

                # Add variants if any
                variants = item_dict.get("variants", [])
                for var_data in variants:
                    variant = ItemVariant(
                        item_id=menu_item.id,
                        label=var_data["label"],
                        price=var_data["price"]
                    )
                    db.add(variant)

        db.commit()
        print("Database seeded successfully with all categories, items, variants, tables, and users!")
    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
