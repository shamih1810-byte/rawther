import sys
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_api():
    print("1. Testing /api/config...")
    res = client.get("/api/config")
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["restaurant_name"] == "Rawther Biriyani"
    assert data["currency_symbol"] == "₹"
    print(" -> Config OK:", data)

    print("2. Testing /api/menu...")
    res = client.get("/api/menu")
    assert res.status_code == 200, res.text
    menu = res.json()
    assert len(menu) > 0
    print(f" -> Menu OK: {len(menu)} categories loaded.")
    # Check Biriyani category
    biriyani_cat = next(c for c in menu if c["name"] == "BIRIYANI")
    chicken_biri = next(i for i in biriyani_cat["items"] if i["name"] == "Chicken Biriyani")
    assert chicken_biri["base_price"] in (150.0, 160.0)
    print(f" -> Found '{chicken_biri['name']}' at ₹{chicken_biri['base_price']}")

    # Check variant item
    thanthoori_cat = next(c for c in menu if c["name"] == "THANTHOORI (TANDOORI)")
    thanthoori_item = next(i for i in thanthoori_cat["items"] if i["name"] == "Thanthoori")
    assert len(thanthoori_item["variants"]) == 3
    print(f" -> Found '{thanthoori_item['name']}' with variants: {[v['label'] + ': ₹' + str(v['price']) for v in thanthoori_item['variants']]}")

    print("3. Testing /api/login...")
    res = client.post("/api/login", json={"username": "admin", "password": "admin123"})
    assert res.status_code == 200, res.text
    admin_token = res.json()["access_token"]
    assert res.json()["role"] == "admin"
    print(" -> Admin login OK")

    res = client.post("/api/login", json={"username": "staff", "password": "staff123"})
    assert res.status_code == 200, res.text
    staff_token = res.json()["access_token"]
    assert res.json()["role"] == "staff"
    print(" -> Staff login OK")

    print("4. Testing /api/tables (staff auth)...")
    res = client.get("/api/tables", headers={"Authorization": f"Bearer {staff_token}"})
    assert res.status_code == 200, res.text
    tables = res.json()
    assert len(tables) == 10
    table1 = tables[0]
    print(f" -> Table 1: number={table1['number']}, token={table1['token']}")

    print("5. Testing /api/orders (placing customer order)...")
    order_payload = {
        "table_number": table1["number"],
        "table_token": table1["token"],
        "note": "Extra spicy please",
        "items": [
            {
                "menu_item_id": chicken_biri["id"],
                "quantity": 2,
                "note": "Less oil"
            },
            {
                "menu_item_id": thanthoori_item["id"],
                "variant_id": thanthoori_item["variants"][0]["id"], # Quarter = 140
                "quantity": 1,
                "note": None
            }
        ]
    }
    expected_total = 2 * chicken_biri["base_price"] + 140.0
    res = client.post("/api/orders", json=order_payload)
    assert res.status_code == 200, res.text
    order = res.json()
    assert order["total"] == expected_total
    assert order["status"] == "received"
    print(f" -> Order #{order['id']} placed successfully! Total: ₹{order['total']}")

    print("6. Testing invalid token rejection...")
    bad_payload = dict(order_payload)
    bad_payload["table_token"] = "wrong_token_123"
    res = client.post("/api/orders", json=bad_payload)
    assert res.status_code == 400
    print(" -> Invalid token correctly rejected with 400 Bad Request!")

    print("7. Testing staff order status update...")
    order_id = order["id"]
    res = client.patch(
        f"/api/orders/{order_id}/status",
        json={"status": "preparing"},
        headers={"Authorization": f"Bearer {staff_token}"}
    )
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "preparing"
    print(f" -> Order #{order_id} status updated to 'preparing'")

    print("8. Testing table bill generation...")
    res = client.get(
        f"/api/tables/{table1['number']}/bill",
        headers={"Authorization": f"Bearer {staff_token}"}
    )
    assert res.status_code == 200, res.text
    bill = res.json()
    assert bill["grand_total"] > 0
    assert bill["grand_total"] == sum(it["subtotal"] for it in bill["items"])
    print(f" -> Table {table1['number']} bill verified: ₹{bill['grand_total']}, {len(bill['items'])} distinct items")

    print("9. Testing placing order with unpriced item (Ask staff)...")
    beef_chilli = next(i for i in biriyani_cat["items"] if i["name"] == "Beef Chilli Biriyani")
    unpriced_order_payload = {
        "table_number": table1["number"],
        "table_token": table1["token"],
        "note": "Unpriced item test",
        "items": [
            {
                "menu_item_id": beef_chilli["id"],
                "quantity": 1,
                "note": "Please check price with waiter"
            }
        ]
    }
    res = client.post("/api/orders", json=unpriced_order_payload)
    assert res.status_code == 200, res.text
    order_unpriced = res.json()
    assert order_unpriced["items"][0]["variant_label"] == "Ask staff"
    assert order_unpriced["items"][0]["unit_price"] == 0.0
    print(f" -> Order #{order_unpriced['id']} with unpriced item '{beef_chilli['name']}' placed successfully without error!")

    print("\nALL BACKEND API TESTS PASSED PERFECTLY!")

if __name__ == "__main__":
    test_api()
