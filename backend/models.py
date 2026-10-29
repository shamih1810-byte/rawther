from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
)
from sqlalchemy.orm import relationship
from .database import Base

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    sort_order = Column(Integer, default=0)

    items = relationship("MenuItem", back_populates="category", cascade="all, delete-orphan", order_by="MenuItem.sort_order")


class MenuItem(Base):
    __tablename__ = "menu_items"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(150), nullable=False, index=True)
    description = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    is_veg = Column(Boolean, default=False)
    base_price = Column(Float, nullable=True) # nullable for "Ask staff" items
    is_available = Column(Boolean, default=True) # Sold out toggle
    is_hidden = Column(Boolean, default=False) # Hide/show toggle
    sort_order = Column(Integer, default=0)

    category = relationship("Category", back_populates="items")
    variants = relationship("ItemVariant", back_populates="item", cascade="all, delete-orphan")


class ItemVariant(Base):
    __tablename__ = "item_variants"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("menu_items.id", ondelete="CASCADE"), nullable=False)
    label = Column(String(50), nullable=False) # e.g. Quarter, Half, Full
    price = Column(Float, nullable=False)

    item = relationship("MenuItem", back_populates="variants")


class RestaurantTable(Base):
    __tablename__ = "tables"

    id = Column(Integer, primary_key=True, index=True)
    number = Column(Integer, unique=True, nullable=False, index=True)
    token = Column(String(64), nullable=False, index=True)

    orders = relationship("Order", back_populates="table", cascade="all, delete-orphan")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    table_id = Column(Integer, ForeignKey("tables.id"), nullable=False)
    status = Column(String(30), default="received") # received, accepted, preparing, served, completed, rejected
    reject_reason = Column(String(255), nullable=True)
    note = Column(Text, nullable=True) # Overall order note
    total = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    table = relationship("RestaurantTable", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    item_name = Column(String(150), nullable=False) # Snapshot of name at order time
    variant_label = Column(String(50), nullable=True) # Snapshot of variant label (Quarter/Half/Full)
    unit_price = Column(Float, nullable=False) # Snapshot of price at order time
    quantity = Column(Integer, nullable=False, default=1)
    note = Column(String(255), nullable=True) # Item specific note e.g. "less spicy"

    order = relationship("Order", back_populates="items")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="staff") # "admin" or "staff"
