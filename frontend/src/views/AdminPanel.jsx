import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  Shield, Utensils, QrCode, DollarSign, ToggleLeft, ToggleRight,
  Plus, Edit, Trash2, Save, Printer, Calendar, RefreshCw, Upload,
  AlertCircle, CheckCircle2, ChevronRight, LogOut, ArrowUpDown, Eye, EyeOff
} from 'lucide-react';
import {
  fetchMenu, fetchTablesApi, createTableApi, deleteTableApi, regenerateTableTokenApi,
  createCategoryApi, updateCategoryApi, deleteCategoryApi, reorderCategoriesApi,
  createMenuItemApi, updateMenuItemApi, deleteMenuItemApi,
  toggleItemAvailabilityApi, toggleItemHiddenApi, bulkUpdatePricesApi,
  uploadImageApi, fetchSalesReportApi,
  getAuthToken, getAuthRole, clearAuthSession
} from '../api';
import { RESTAURANT_CONFIG } from '../config';

export default function AdminPanel() {
  const navigate = useNavigate();

  // Tabs: 'menu', 'soldout', 'bulkprice', 'tables', 'history'
  const [activeTab, setActiveTab] = useState('menu');

  // Data states
  const [categories, setCategories] = useState([]);
  const [tables, setTables] = useState([]);
  const [salesReport, setSalesReport] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  // Edit / Modal States
  const [editingItem, setEditingItem] = useState(null); // null or item object
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Bulk Price changes buffer
  const [bulkPriceBuffer, setBulkPriceBuffer] = useState({});
  const [savingBulkPrices, setSavingBulkPrices] = useState(false);

  // QR Print Sheet View mode ('all-grid' or 'single-table')
  const [printTableTarget, setPrintTableTarget] = useState(null);

  // Check admin auth
  useEffect(() => {
    const token = getAuthToken();
    const role = getAuthRole();
    if (!token || role !== 'admin') {
      if (token && role !== 'admin') {
        clearAuthSession();
      }
      navigate('/login?portal=admin&redirect=/admin');
    }
  }, [navigate]);

  const showNotification = (msg, isError = false) => {
    setNotification({ msg, isError });
    setTimeout(() => setNotification(null), 4000);
  };

  // Load all initial data
  const loadAllData = async () => {
    setLoading(true);
    try {
      const [menuData, tablesData, salesData] = await Promise.all([
        fetchMenu(true), // include hidden
        fetchTablesApi(),
        fetchSalesReportApi(selectedDate)
      ]);
      setCategories(menuData);
      setTables(tablesData);
      setSalesReport(salesData);

      // Pre-fill bulk price buffer
      const buffer = {};
      menuData.forEach(cat => {
        cat.items.forEach(it => {
          if (it.variants && it.variants.length > 0) {
            it.variants.forEach(v => {
              buffer[`var_${v.id}`] = v.price;
            });
          } else {
            buffer[`item_${it.id}`] = it.base_price !== null ? it.base_price : '';
          }
        });
      });
      setBulkPriceBuffer(buffer);
    } catch (err) {
      showNotification(`Failed to load data: ${err.message}`, true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [selectedDate]);

  // Real-time multi-device sync for Admin Panel
  useEffect(() => {
    let wsUrl = '';
    const customWs = import.meta.env.VITE_WS_URL;
    const apiHost = import.meta.env.VITE_API_BASE_URL;

    if (customWs) {
      wsUrl = `${customWs.replace(/\/$/, '')}/ws/menu`;
    } else if (apiHost) {
      const wsProtocol = apiHost.startsWith('https') ? 'wss:' : 'ws:';
      const cleanHost = apiHost.replace(/^https?:\/\//, '').replace(/\/$/, '');
      wsUrl = `${wsProtocol}//${cleanHost}/ws/menu`;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}/ws/menu`;
    }

    let socket = null;
    let reconnectTimeout = null;

    const connectMenuSocket = () => {
      try {
        socket = new WebSocket(wsUrl);
        socket.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.type === 'MENU_UPDATED') {
              fetchMenu(true).then(menuData => {
                setCategories(menuData);
              });
            }
          } catch (e) {}
        };
        socket.onclose = () => {
          reconnectTimeout = setTimeout(connectMenuSocket, 5000);
        };
      } catch (e) {
        reconnectTimeout = setTimeout(connectMenuSocket, 5000);
      }
    };

    connectMenuSocket();

    let bc = null;
    try {
      bc = new BroadcastChannel('rawther_menu_sync');
      bc.onmessage = () => {
        fetchMenu(true).then(menuData => {
          setCategories(menuData);
        });
      };
    } catch (e) {}

    const handleStorage = (e) => {
      if (e.key === 'rawther_custom_menu' || e.key === 'rawther_menu_version') {
        fetchMenu(true).then(menuData => {
          setCategories(menuData);
        });
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      if (socket) socket.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const handleLogout = () => {
    clearAuthSession();
    navigate('/login');
  };

  // Quick Sold Out Toggle
  const handleToggleAvailability = async (itemId, currentVal) => {
    try {
      await toggleItemAvailabilityApi(itemId, !currentVal);
      setCategories(prev => prev.map(cat => ({
        ...cat,
        items: cat.items.map(it => it.id === itemId ? { ...it, is_available: !currentVal } : it)
      })));
      showNotification(`Availability updated`);
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  // Toggle Hidden
  const handleToggleHidden = async (itemId) => {
    try {
      await toggleItemHiddenApi(itemId);
      setCategories(prev => prev.map(cat => ({
        ...cat,
        items: cat.items.map(it => it.id === itemId ? { ...it, is_hidden: !it.is_hidden } : it)
      })));
      showNotification(`Visibility updated`);
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  // Save Bulk Prices
  const handleSaveBulkPrices = async () => {
    setSavingBulkPrices(true);
    try {
      const updates = [];
      categories.forEach(cat => {
        cat.items.forEach(it => {
          if (it.variants && it.variants.length > 0) {
            it.variants.forEach(v => {
              const val = bulkPriceBuffer[`var_${v.id}`];
              if (val !== undefined && val !== '') {
                updates.push({
                  item_id: it.id,
                  variant_id: v.id,
                  variant_price: parseFloat(val)
                });
              }
            });
          } else {
            const val = bulkPriceBuffer[`item_${it.id}`];
            updates.push({
              item_id: it.id,
              base_price: val !== '' && val !== undefined ? parseFloat(val) : null
            });
          }
        });
      });

      await bulkUpdatePricesApi(updates);
      showNotification("Bulk prices saved successfully!");
      await loadAllData();
    } catch (err) {
      showNotification(`Error saving prices: ${err.message}`, true);
    } finally {
      setSavingBulkPrices(false);
    }
  };

  // Tables operations
  const handleAddTable = async () => {
    const nextNumber = tables.length > 0 ? Math.max(...tables.map(t => t.number)) + 1 : 1;
    try {
      const newT = await createTableApi(nextNumber);
      setTables(prev => [...prev, newT]);
      showNotification(`Table ${newT.number} created with security token!`);
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  const handleRegenerateToken = async (tableId) => {
    if (!window.confirm("Regenerate table security token? Old QR codes will stop working.")) return;
    try {
      const updated = await regenerateTableTokenApi(tableId);
      setTables(prev => prev.map(t => t.id === tableId ? updated : t));
      showNotification(`Table ${updated.number} token regenerated`);
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  const handleDeleteTable = async (tableId, tableNum) => {
    if (!window.confirm(`Delete Table ${tableNum}?`)) return;
    try {
      await deleteTableApi(tableId);
      setTables(prev => prev.filter(t => t.id !== tableId));
      showNotification(`Table ${tableNum} deleted`);
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  return (
    <div className="min-h-screen bg-bg-deep text-cream">
      {/* Admin Navbar */}
      <header className="sticky top-0 z-40 bg-bg-card border-b border-gold/20 px-4 py-3 shadow-md no-print">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={RESTAURANT_CONFIG.logoUrl || "/rawther_logo.jpg"}
              alt={RESTAURANT_CONFIG.restaurantName}
              className="w-10 h-10 rounded-full object-cover border border-gold/50 shadow-gold-glow shrink-0"
            />
            <div>
              <h1 className="font-serif font-bold text-lg text-gold flex items-center gap-2">
                <span>Admin & Management</span>
              </h1>
              <p className="text-xs text-cream-muted">
                {RESTAURANT_CONFIG.restaurantName} • Owner Control Panel
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/menu"
              className="px-3 py-1.5 rounded-xl bg-bg-surface border border-gold/20 text-cream text-xs font-bold hover:text-gold transition-colors flex items-center gap-1.5"
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>Customer Menu</span>
            </Link>

            <button
              onClick={handleLogout}
              className="p-2 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 hover:bg-rose-950/70 transition-colors"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`fixed top-16 right-4 z-50 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-bold flex items-center gap-2 transition-all no-print ${
            notification.isError
              ? 'bg-rose-950 text-rose-200 border-rose-500'
              : 'bg-[#5A3E2B] text-[#87A96B] border-[#87A96B]/50'
          }`}
        >
          {notification.isError ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Admin Tabs Bar */}
      <div className="bg-bg-card/80 border-b border-gold/15 px-4 py-2.5 sticky top-[61px] z-30 backdrop-blur-md no-print">
        <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('menu')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
              activeTab === 'menu'
                ? 'bg-gold text-bg-card border-gold font-extrabold shadow-gold-glow'
                : 'bg-bg-surface text-cream-muted border-gold/15 hover:border-gold/30'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Items & Categories</span>
          </button>

          <button
            onClick={() => setActiveTab('soldout')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
              activeTab === 'soldout'
                ? 'bg-gold text-bg-card border-gold font-extrabold shadow-gold-glow'
                : 'bg-bg-surface text-cream-muted border-gold/15 hover:border-gold/30'
            }`}
          >
            <ToggleLeft className="w-3.5 h-3.5" />
            <span>Quick Sold-Out</span>
          </button>

          <button
            onClick={() => setActiveTab('bulkprice')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
              activeTab === 'bulkprice'
                ? 'bg-gold text-bg-card border-gold font-extrabold shadow-gold-glow'
                : 'bg-bg-surface text-cream-muted border-gold/15 hover:border-gold/30'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Bulk Price Editor</span>
          </button>

          <button
            onClick={() => setActiveTab('tables')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
              activeTab === 'tables'
                ? 'bg-gold text-bg-card border-gold font-extrabold shadow-gold-glow'
                : 'bg-bg-surface text-cream-muted border-gold/15 hover:border-gold/30'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Table QR Codes</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-gold text-bg-card border-gold font-extrabold shadow-gold-glow'
                : 'bg-bg-surface text-cream-muted border-gold/15 hover:border-gold/30'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Order History & Revenue</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <div className="w-10 h-10 border-3 border-gold border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-semibold text-gold">Loading administration dashboard...</p>
          </div>
        ) : (
          <>
            {/* 1. Menu Items & Categories Tab */}
            {activeTab === 'menu' && renderMenuTab()}

            {/* 2. Quick Sold Out Toggle List */}
            {activeTab === 'soldout' && renderSoldOutTab()}

            {/* 3. Bulk Price Editor */}
            {activeTab === 'bulkprice' && renderBulkPriceTab()}

            {/* 4. Table QR Codes & Print Sheet */}
            {activeTab === 'tables' && renderTablesTab()}

            {/* 5. Order History & Sales Reports */}
            {activeTab === 'history' && renderHistoryTab()}
          </>
        )}
      </main>

      {/* Category Modal */}
      {isCategoryModalOpen && renderCategoryModal()}

      {/* Menu Item Add / Edit Modal */}
      {isItemModalOpen && renderItemModal()}
    </div>
  );

  // --------------------------------------------------------------------------
  // TAB 1: MENU ITEMS & CATEGORIES
  // --------------------------------------------------------------------------
  function renderMenuTab() {
    return (
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif font-bold text-xl text-cream">Menu Management</h2>
            <p className="text-xs text-cream-muted">Add, edit, reorder categories and items.</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditingCategory(null);
                setIsCategoryModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-bg-surface border border-gold/30 text-gold text-xs font-bold hover:bg-gold hover:text-bg-card transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Category</span>
            </button>

            <button
              onClick={() => {
                setEditingItem(null);
                setIsItemModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-white via-slate-100 to-white hover:brightness-105 text-bg-deep text-xs font-bold shadow-gold-glow flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Menu Item</span>
            </button>
          </div>
        </div>

        {/* Categories Accordion / Grid */}
        <div className="space-y-6">
          {categories.map((cat) => (
            <div key={cat.id} className="bg-bg-card rounded-2xl border border-gold/20 p-5 shadow-premium">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-gold/15">
                <div className="flex items-center gap-2">
                  <h3 className="font-serif font-bold text-base text-gold tracking-wide">
                    {cat.name}
                  </h3>
                  <span className="text-xs text-cream-dim">
                    ({cat.items.length} items)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingCategory(cat);
                      setIsCategoryModalOpen(true);
                    }}
                    className="p-1.5 rounded-lg bg-bg-surface text-cream-muted hover:text-gold border border-gold/10"
                    title="Edit Category"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={async () => {
                      if (window.confirm(`Delete category "${cat.name}" and all its items?`)) {
                        await deleteCategoryApi(cat.id);
                        setCategories(prev => prev.filter(c => c.id !== cat.id));
                        showNotification(`Category "${cat.name}" deleted`);
                      }
                    }}
                    className="p-1.5 rounded-lg bg-rose-950/40 text-rose-300 hover:bg-rose-950/80 border border-rose-500/20"
                    title="Delete Category"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Items Table */}
              <div className="divide-y divide-gold/10">
                {cat.items.map((item) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className={`w-3 h-3 rounded-full shrink-0 ${item.is_veg ? 'bg-[#87A96B]' : 'bg-rose-500'}`} />
                      <div className="min-w-0">
                        <span className="font-semibold text-cream truncate block">
                          {item.name}
                        </span>
                        {item.variants && item.variants.length > 0 ? (
                          <span className="text-[11px] text-gold">
                            Variants: {item.variants.map(v => `${v.label} (₹${v.price})`).join(', ')}
                          </span>
                        ) : (
                          <span className="text-[11px] text-cream-dim">
                            {item.base_price !== null ? `₹${item.base_price}` : 'Ask staff (no price)'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Sold-out indicator pill */}
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${item.is_available ? 'bg-[#87A96B]/20 text-[#87A96B] border border-[#87A96B]/40' : 'bg-rose-950/70 text-rose-300 border border-rose-500/30'}`}>
                        {item.is_available ? 'In Stock' : 'Sold Out'}
                      </span>

                      {/* Hide/Show toggle button */}
                      <button
                        onClick={() => handleToggleHidden(item.id)}
                        className={`p-1.5 rounded-lg border text-xs ${item.is_hidden ? 'bg-white/15 text-white border-white/30' : 'bg-bg-surface text-cream-dim border-gold/10 hover:text-cream'}`}
                        title={item.is_hidden ? 'Item is hidden from customers. Click to show.' : 'Click to hide from customers'}
                      >
                        {item.is_hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => {
                          setEditingItem(item);
                          setIsItemModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg bg-bg-surface text-cream-muted hover:text-gold border border-gold/15"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={async () => {
                          if (window.confirm(`Delete "${item.name}"?`)) {
                            await deleteMenuItemApi(item.id);
                            setCategories(prev => prev.map(c => ({
                              ...c,
                              items: c.items.filter(i => i.id !== item.id)
                            })));
                            showNotification(`"${item.name}" deleted`);
                          }
                        }}
                        className="p-1.5 rounded-lg bg-rose-950/40 text-rose-300 hover:bg-rose-950 border border-rose-500/20"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // TAB 2: QUICK SOLD-OUT TOGGLE LIST
  // --------------------------------------------------------------------------
  function renderSoldOutTab() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-serif font-bold text-xl text-cream">Quick Sold-Out Toggles</h2>
          <p className="text-xs text-cream-muted">
            Instantly turn items on or off when they run out in the kitchen with one tap.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.flatMap(c => c.items).map((item) => (
            <div
              key={item.id}
              className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                item.is_available
                  ? 'bg-bg-card border-gold/20'
                  : 'bg-rose-950/20 border-rose-500/30'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${item.is_veg ? 'bg-[#87A96B]' : 'bg-rose-500'}`} />
                  <span className="font-semibold text-xs text-cream truncate">
                    {item.name}
                  </span>
                </div>
                <p className="text-[11px] text-cream-dim mt-0.5">
                  {item.is_available ? 'Available for ordering' : 'Marked as SOLD OUT'}
                </p>
              </div>

              <button
                onClick={() => handleToggleAvailability(item.id, item.is_available)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  item.is_available
                    ? 'bg-[#87A96B] hover:bg-[#729258] text-white border-[#87A96B]/60 shadow-sm'
                    : 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400 shadow-md'
                }`}
              >
                {item.is_available ? 'In Stock' : 'Sold Out'}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // TAB 3: BULK PRICE EDITOR
  // --------------------------------------------------------------------------
  function renderBulkPriceTab() {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif font-bold text-xl text-cream">Bulk Price Editor</h2>
            <p className="text-xs text-cream-muted">
              Quickly set prices for items marked "Ask staff" and update variant prices in one go.
            </p>
          </div>

          <button
            onClick={handleSaveBulkPrices}
            disabled={savingBulkPrices}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-white via-slate-100 to-white hover:brightness-105 text-bg-deep font-extrabold text-xs uppercase tracking-wider shadow-gold-glow flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{savingBulkPrices ? 'Saving Prices...' : 'Save All Prices'}</span>
          </button>
        </div>

        <div className="bg-bg-card rounded-2xl border border-gold/20 overflow-hidden shadow-premium">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-bg-surface text-gold border-b border-gold/20 font-serif">
                <tr>
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Price ({RESTAURANT_CONFIG.currencySymbol})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold/10">
                {categories.flatMap(cat =>
                  cat.items.flatMap(item => {
                    if (item.variants && item.variants.length > 0) {
                      return item.variants.map(v => ({
                        rowKey: `var_${v.id}`,
                        name: `${item.name} (${v.label})`,
                        category: cat.name,
                        type: 'Variant',
                        value: bulkPriceBuffer[`var_${v.id}`] ?? v.price
                      }));
                    }
                    return [{
                      rowKey: `item_${item.id}`,
                      name: item.name,
                      category: cat.name,
                      type: item.is_veg ? 'Veg Item' : 'Non-Veg',
                      value: bulkPriceBuffer[`item_${item.id}`] ?? (item.base_price ?? '')
                    }];
                  })
                ).map(row => (
                  <tr key={row.rowKey} className="hover:bg-bg-surface/50">
                    <td className="py-2.5 px-4 font-medium text-cream">{row.name}</td>
                    <td className="py-2.5 px-4 text-cream-dim">{row.category}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-bg-surface text-[10px] text-cream-muted border border-gold/10">
                        {row.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-1.5 w-32">
                        <span className="text-gold font-bold">{RESTAURANT_CONFIG.currencySymbol}</span>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={row.value}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBulkPriceBuffer(prev => ({ ...prev, [row.rowKey]: val }));
                          }}
                          placeholder="No price"
                          className="w-full bg-bg-surface border border-gold/25 rounded-lg px-2.5 py-1 text-xs text-cream font-bold focus:outline-none focus:border-gold"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // TAB 4: TABLE QR CODES & PRINT SHEETS
  // --------------------------------------------------------------------------
  function renderTablesTab() {
    const origin = window.location.origin;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 no-print">
          <div>
            <h2 className="font-serif font-bold text-xl text-cream">Dining Tables & QR Codes</h2>
            <p className="text-xs text-cream-muted">
              Generate, preview, and print QR code stands with tokens for tables.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setPrintTableTarget(null);
                setTimeout(() => window.print(), 200);
              }}
              className="px-3.5 py-2 rounded-xl bg-bg-surface border border-gold/30 text-gold text-xs font-bold hover:bg-gold hover:text-bg-card transition-all flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print All QR Codes Sheet</span>
            </button>

            <button
              onClick={handleAddTable}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-white via-slate-100 to-white hover:brightness-105 text-bg-deep text-xs font-bold shadow-gold-glow flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Table</span>
            </button>
          </div>
        </div>

        {/* Tables Grid Display */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {tables.map((table) => {
            const tableMenuUrl = `${origin}/menu?table=${table.number}&token=${table.token}`;

            return (
              <div
                key={table.id}
                className="bg-bg-card rounded-3xl border border-gold/25 p-5 flex flex-col items-center text-center shadow-premium relative group print-card"
              >
                {/* Print Sheet Table Card Header */}
                <img
                  src={RESTAURANT_CONFIG.logoUrl || "/rawther_logo.jpg"}
                  alt={RESTAURANT_CONFIG.restaurantName}
                  className="w-12 h-12 rounded-full border border-gold/40 object-cover shadow-sm mb-1.5"
                />
                <span className="text-[11px] uppercase font-bold tracking-widest text-gold mb-1">
                  {RESTAURANT_CONFIG.restaurantName}
                </span>
                <h3 className="font-serif font-extrabold text-xl text-cream mb-3">
                  Table {table.number}
                </h3>

                {/* High Contrast QR Code Canvas with White Border */}
                <div className="p-3 bg-white rounded-2xl shadow-md border-2 border-gold/40 mb-3">
                  <QRCodeSVG
                    value={tableMenuUrl}
                    size={150}
                    level="H"
                    includeMargin={false}
                  />
                </div>

                <p className="text-[11px] text-cream-muted mb-1">
                  Scan with phone camera to order
                </p>
                <p className="text-[10px] text-cream-dim font-mono mb-4">
                  Token: {table.token}
                </p>

                {/* Actions */}
                <div className="w-full flex items-center justify-center gap-2 pt-3 border-t border-gold/15 no-print">
                  <button
                    onClick={() => {
                      setPrintTableTarget(table);
                      setTimeout(() => window.print(), 200);
                    }}
                    className="flex-1 py-1.5 rounded-lg bg-bg-surface hover:bg-gold/20 text-gold border border-gold/20 text-xs font-bold transition-colors flex items-center justify-center gap-1"
                  >
                    <Printer className="w-3 h-3" />
                    <span>Print</span>
                  </button>

                  <button
                    onClick={() => handleRegenerateToken(table.id)}
                    className="p-1.5 rounded-lg bg-bg-surface hover:bg-bg-elevated text-cream-muted hover:text-cream border border-gold/15"
                    title="Regenerate Token"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDeleteTable(table.id, table.number)}
                    className="p-1.5 rounded-lg bg-rose-950/40 text-rose-300 hover:bg-rose-950 border border-rose-500/20"
                    title="Delete Table"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // TAB 5: ORDER HISTORY & REVENUE
  // --------------------------------------------------------------------------
  function renderHistoryTab() {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif font-bold text-xl text-cream">Order History & Sales</h2>
            <p className="text-xs text-cream-muted">
              View daily breakdown, total revenue, and historical orders.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-cream-muted">Filter Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-bg-surface border border-gold/25 rounded-xl px-3 py-1.5 text-xs font-bold text-cream focus:outline-none focus:border-gold"
            />
          </div>
        </div>

        {/* Stats Metrics Cards */}
        {salesReport && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-bg-card rounded-2xl border border-gold/25 p-5 shadow-premium">
              <p className="text-xs uppercase font-bold text-cream-muted tracking-wider">
                Total Revenue
              </p>
              <h3 className="font-serif font-bold text-2xl text-gold mt-1">
                {RESTAURANT_CONFIG.currencySymbol}{salesReport.total_revenue.toFixed(2)}
              </h3>
              <p className="text-[11px] text-cream-dim mt-1">Excludes rejected orders</p>
            </div>

            <div className="bg-bg-card rounded-2xl border border-gold/25 p-5 shadow-premium">
              <p className="text-xs uppercase font-bold text-cream-muted tracking-wider">
                Total Orders Placed
              </p>
              <h3 className="font-serif font-bold text-2xl text-cream mt-1">
                {salesReport.total_orders}
              </h3>
              <p className="text-[11px] text-cream-dim mt-1">Tickets submitted for this date</p>
            </div>

            <div className="bg-bg-card rounded-2xl border border-gold/25 p-5 shadow-premium">
              <p className="text-xs uppercase font-bold text-cream-muted tracking-wider">
                Served / Completed
              </p>
              <h3 className="font-serif font-bold text-2xl text-[#87A96B] mt-1">
                {salesReport.completed_or_served}
              </h3>
              <p className="text-[11px] text-cream-dim mt-1">Successfully fulfilled</p>
            </div>
          </div>
        )}

        {/* Orders Log Table */}
        <div className="bg-bg-card rounded-2xl border border-gold/20 overflow-hidden shadow-premium">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-bg-surface text-gold border-b border-gold/20 font-serif">
                <tr>
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Table</th>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold/10">
                {salesReport && salesReport.orders && salesReport.orders.length > 0 ? (
                  salesReport.orders.map((o) => (
                    <tr key={o.id} className="hover:bg-bg-surface/50">
                      <td className="py-3 px-4 font-bold text-cream">#{o.id}</td>
                      <td className="py-3 px-4 font-bold text-gold">Table {o.table_number}</td>
                      <td className="py-3 px-4 text-cream-dim font-mono">
                        {new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-4 text-cream-muted">
                        {o.items.map(it => `${it.quantity}× ${it.item_name}`).join(', ')}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          o.status === 'served' || o.status === 'completed'
                            ? 'bg-[#87A96B]/20 text-[#87A96B] border border-[#87A96B]/40'
                            : o.status === 'rejected'
                            ? 'bg-rose-950 text-rose-300 border border-rose-500/30'
                            : 'bg-white/10 text-white border border-white/30'
                        }`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-serif font-bold text-gold">
                        {RESTAURANT_CONFIG.currencySymbol}{o.total.toFixed(2)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-cream-dim">
                      No orders found for selected date.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // CATEGORY MODAL
  // --------------------------------------------------------------------------
  function renderCategoryModal() {
    return (
      <CategoryModal
        category={editingCategory}
        onClose={() => setIsCategoryModalOpen(false)}
        onSaved={async () => {
          setIsCategoryModalOpen(false);
          await loadAllData();
          showNotification("Category saved!");
        }}
      />
    );
  }

  // --------------------------------------------------------------------------
  // MENU ITEM MODAL
  // --------------------------------------------------------------------------
  function renderItemModal() {
    return (
      <MenuItemModal
        item={editingItem}
        categories={categories}
        onClose={() => setIsItemModalOpen(false)}
        onSaved={async () => {
          setIsItemModalOpen(false);
          await loadAllData();
          showNotification("Menu item saved!");
        }}
      />
    );
  }
}

// ----------------------------------------------------------------------------
// MODAL: Category Add/Edit
// ----------------------------------------------------------------------------
function CategoryModal({ category, onClose, onSaved }) {
  const [name, setName] = useState(category ? category.name : '');
  const [sortOrder, setSortOrder] = useState(category ? category.sort_order : 0);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      if (category) {
        await updateCategoryApi(category.id, { name: name.trim(), sort_order: parseInt(sortOrder, 10) });
      } else {
        await createCategoryApi(name.trim(), parseInt(sortOrder, 10));
      }
      onSaved();
    } catch (err) {
      alert(`Error saving category: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-bg-card rounded-3xl border border-gold/30 p-6 relative">
        <h3 className="font-serif font-bold text-lg text-cream mb-4">
          {category ? 'Edit Category' : 'New Category'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-cream-muted mb-1">Category Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. DESSERTS & BEVERAGES"
              required
              className="w-full bg-bg-surface border border-gold/25 rounded-xl px-3 py-2 text-xs text-cream focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-cream-muted mb-1">Sort Order</label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full bg-bg-surface border border-gold/25 rounded-xl px-3 py-2 text-xs text-cream focus:outline-none focus:border-gold"
            />
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-xl bg-bg-surface text-cream-muted text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 rounded-xl bg-gradient-to-r from-white via-slate-100 to-white hover:brightness-105 text-bg-deep text-xs font-bold shadow-gold-glow"
            >
              {loading ? 'Saving...' : 'Save Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// MODAL: Menu Item Add/Edit
// ----------------------------------------------------------------------------
function MenuItemModal({ item, categories, onClose, onSaved }) {
  const [name, setName] = useState(item ? item.name : '');
  const [categoryId, setCategoryId] = useState(item ? item.category_id : (categories[0]?.id || 1));
  const [description, setDescription] = useState(item?.description || '');
  const [basePrice, setBasePrice] = useState(item?.base_price !== null && item?.base_price !== undefined ? item.base_price : '');
  const [isVeg, setIsVeg] = useState(item ? item.is_veg : false);
  const [isAvailable, setIsAvailable] = useState(item ? item.is_available : true);
  const [isHidden, setIsHidden] = useState(item ? item.is_hidden : false);
  const [imageUrl, setImageUrl] = useState(item?.image_url || '');

  // Variants management (Quarter / Half / Full)
  const [variants, setVariants] = useState(item?.variants?.map(v => ({ label: v.label, price: v.price })) || []);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const res = await uploadImageApi(file);
      setImageUrl(res.image_url);
    } catch (err) {
      alert(`Photo upload failed: ${err.message}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const addVariant = () => {
    setVariants(prev => [...prev, { label: 'Portion', price: 100 }]);
  };

  const updateVariant = (index, field, value) => {
    setVariants(prev => prev.map((v, i) => i === index ? { ...v, [field]: value } : v));
  };

  const removeVariant = (index) => {
    setVariants(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    const itemData = {
      name: name.trim(),
      category_id: parseInt(categoryId, 10),
      description: description.trim() || null,
      image_url: imageUrl.trim() || null,
      is_veg: isVeg,
      base_price: variants.length > 0 ? null : (basePrice !== '' ? parseFloat(basePrice) : null),
      is_available: isAvailable,
      is_hidden: isHidden,
      sort_order: item?.sort_order || 0,
      variants: variants.map(v => ({ label: v.label.trim(), price: parseFloat(v.price) }))
    };

    try {
      if (item) {
        await updateMenuItemApi(item.id, itemData);
      } else {
        await createMenuItemApi(itemData);
      }
      onSaved();
    } catch (err) {
      alert(`Error saving item: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-bg-card rounded-3xl border border-gold/30 p-6 relative max-h-[90vh] overflow-y-auto">
        <h3 className="font-serif font-bold text-lg text-cream mb-4">
          {item ? 'Edit Menu Item' : 'Add New Menu Item'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-cream-muted mb-1">Item Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Mutton Biriyani"
                required
                className="w-full bg-bg-surface border border-gold/25 rounded-xl px-3 py-2 text-xs text-cream focus:outline-none focus:border-gold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-cream-muted mb-1">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-bg-surface border border-gold/25 rounded-xl px-3 py-2 text-xs text-cream focus:outline-none focus:border-gold"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-cream-muted mb-1">Description (Optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Slow cooked seeraga samba rice with succulent cuts..."
              rows={2}
              className="w-full bg-bg-surface border border-gold/25 rounded-xl px-3 py-2 text-xs text-cream focus:outline-none focus:border-gold resize-none"
            />
          </div>

          {/* Pricing & Variants */}
          <div className="p-3.5 rounded-2xl bg-bg-surface/70 border border-gold/15 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gold">Portions & Sizes (Variants)</span>
              <button
                type="button"
                onClick={addVariant}
                className="text-xs text-gold hover:underline font-semibold flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>+ Add Size Variant</span>
              </button>
            </div>

            {variants.length > 0 ? (
              <div className="space-y-2">
                {variants.map((v, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={v.label}
                      onChange={(e) => updateVariant(idx, 'label', e.target.value)}
                      placeholder="e.g. Quarter / Half / Full"
                      className="flex-1 bg-bg-card border border-gold/20 rounded-lg px-2.5 py-1 text-xs text-cream"
                    />
                    <div className="flex items-center gap-1 w-28">
                      <span className="text-xs text-gold">₹</span>
                      <input
                        type="number"
                        step="1"
                        value={v.price}
                        onChange={(e) => updateVariant(idx, 'price', e.target.value)}
                        placeholder="Price"
                        className="w-full bg-bg-card border border-gold/20 rounded-lg px-2.5 py-1 text-xs text-cream"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeVariant(idx)}
                      className="p-1 text-rose-400 hover:text-rose-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <label className="block text-[11px] text-cream-muted mb-1">
                  Base Price (Leave empty for "Ask staff")
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-gold">₹</span>
                  <input
                    type="number"
                    step="1"
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    placeholder="e.g. 150 (Leave blank for 'Ask staff')"
                    className="flex-1 bg-bg-card border border-gold/20 rounded-xl px-3 py-2 text-xs text-cream focus:outline-none focus:border-gold"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Dietary & Flags */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isVeg}
                onChange={(e) => setIsVeg(e.target.checked)}
                className="rounded accent-[#87A96B]"
              />
              <span className="text-[#87A96B]">Pure Vegetarian</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isAvailable}
                onChange={(e) => setIsAvailable(e.target.checked)}
                className="rounded accent-gold"
              />
              <span>In Stock</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isHidden}
                onChange={(e) => setIsHidden(e.target.checked)}
                className="rounded accent-white"
              />
              <span>Hidden from Menu</span>
            </label>
          </div>

          {/* Photo Upload */}
          <div>
            <label className="block text-xs font-semibold text-cream-muted mb-1">Photo Upload (Optional)</label>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="text-xs text-cream-muted file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-gold file:text-bg-card"
              />
              {uploadingImage && <span className="text-xs text-gold">Uploading...</span>}
            </div>
            {imageUrl && (
              <div className="mt-2 flex items-center gap-2">
                <img src={imageUrl} alt="Preview" className="w-12 h-12 object-cover rounded-lg border border-gold/30" />
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="text-xs text-rose-400 underline"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex items-center gap-2 pt-3 border-t border-gold/15">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-bg-surface text-cream-muted text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-white via-slate-100 to-white hover:brightness-105 text-bg-deep text-xs font-bold shadow-gold-glow"
            >
              {saving ? 'Saving...' : 'Save Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
