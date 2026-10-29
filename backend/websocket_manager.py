from typing import List, Dict, Any
from fastapi import WebSocket
import json
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # List of active kitchen / staff sockets
        self.active_kitchen_connections: List[WebSocket] = []
        # List of active menu / customer sockets for live menu synchronization
        self.active_menu_connections: List[WebSocket] = []
        # Map of order_id -> list of customer WebSockets
        self.active_customer_connections: Dict[int, List[WebSocket]] = {}

    async def connect_kitchen(self, websocket: WebSocket):
        await websocket.accept()
        self.active_kitchen_connections.append(websocket)
        logger.info(f"Kitchen client connected. Total: {len(self.active_kitchen_connections)}")

    def disconnect_kitchen(self, websocket: WebSocket):
        if websocket in self.active_kitchen_connections:
            self.active_kitchen_connections.remove(websocket)
            logger.info(f"Kitchen client disconnected. Total: {len(self.active_kitchen_connections)}")

    async def connect_menu(self, websocket: WebSocket):
        await websocket.accept()
        self.active_menu_connections.append(websocket)
        logger.info(f"Menu client connected. Total: {len(self.active_menu_connections)}")

    def disconnect_menu(self, websocket: WebSocket):
        if websocket in self.active_menu_connections:
            self.active_menu_connections.remove(websocket)
            logger.info(f"Menu client disconnected. Total: {len(self.active_menu_connections)}")

    async def connect_customer(self, websocket: WebSocket, order_id: int):
        await websocket.accept()
        if order_id not in self.active_customer_connections:
            self.active_customer_connections[order_id] = []
        self.active_customer_connections[order_id].append(websocket)

    def disconnect_customer(self, websocket: WebSocket, order_id: int):
        if order_id in self.active_customer_connections:
            if websocket in self.active_customer_connections[order_id]:
                self.active_customer_connections[order_id].remove(websocket)
            if not self.active_customer_connections[order_id]:
                del self.active_customer_connections[order_id]

    async def broadcast_kitchen(self, message: Dict[str, Any]):
        dead_connections = []
        msg_text = json.dumps(message)
        for connection in self.active_kitchen_connections:
            try:
                await connection.send_text(msg_text)
            except Exception as e:
                logger.warning(f"Failed to send to kitchen socket: {e}")
                dead_connections.append(connection)
        for dead in dead_connections:
            self.disconnect_kitchen(dead)

    async def broadcast_customer_order(self, order_id: int, message: Dict[str, Any]):
        msg_text = json.dumps(message)
        if order_id in self.active_customer_connections:
            dead_connections = []
            for connection in self.active_customer_connections[order_id]:
                try:
                    await connection.send_text(msg_text)
                except Exception as e:
                    logger.warning(f"Failed to send to customer socket: {e}")
                    dead_connections.append(connection)
            for dead in dead_connections:
                self.disconnect_customer(dead, order_id)

    async def broadcast_order_created(self, order_dict: Dict[str, Any]):
        payload = {
            "type": "ORDER_CREATED",
            "data": order_dict
        }
        await self.broadcast_kitchen(payload)

    async def broadcast_order_status_updated(self, order_id: int, status: str, reject_reason: str = None, order_dict: Dict[str, Any] = None):
        payload = {
            "type": "ORDER_STATUS_UPDATED",
            "order_id": order_id,
            "status": status,
            "reject_reason": reject_reason,
            "data": order_dict
        }
        # Notify kitchen
        await self.broadcast_kitchen(payload)
        # Notify customer tracking this order
        await self.broadcast_customer_order(order_id, payload)

    async def broadcast_menu_updated(self, action: str = "MENU_UPDATED", extra_data: Dict[str, Any] = None):
        """Broadcast live menu modification to all customer devices and kitchen displays."""
        payload = {
            "type": "MENU_UPDATED",
            "action": action,
            "data": extra_data or {}
        }
        msg_text = json.dumps(payload)

        # 1. Send to all connected customer / menu devices
        dead_menu = []
        for connection in self.active_menu_connections:
            try:
                await connection.send_text(msg_text)
            except Exception as e:
                logger.warning(f"Failed to send to menu socket: {e}")
                dead_menu.append(connection)
        for dead in dead_menu:
            self.disconnect_menu(dead)

        # 2. Also notify kitchen connections
        await self.broadcast_kitchen(payload)

manager = ConnectionManager()
