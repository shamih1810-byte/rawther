import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ChefHat, Volume2, VolumeX, RefreshCw, Printer, Clock, AlertTriangle,
  CheckCircle, ArrowRight, X, Utensils, LogOut, Settings, Filter, Layers
} from 'lucide-react';
import {
  fetchOrders, updateOrderStatusApi, fetchTableBill,
  getAuthToken, getAuthRole, clearAuthSession
} from '../api';
import { RESTAURANT_CONFIG, playOrderNotificationSound } from '../config';

export default function KitchenDashboard() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('new'); // 'new' (received/accepted), 'preparing', 'served', 'all'
  const [groupByTable, setGroupByTable] = useState(false);
  const [requireAcceptance, setRequireAcceptance] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [newOrderIds, setNewOrderIds] = useState(new Set()); // highlighted card IDs

  // Reject Modal state
  const [rejectingOrder, setRejectingOrder] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  // Printable Bill Modal state
  const [billModalData, setBillModalData] = useState(null);
  const [loadingBill, setLoadingBill] = useState(false);

  const socketRef = useRef(null);

  // Check auth
  useEffect(() => {
    const token = getAuthToken();
    const role = getAuthRole();
    if (!token || (role !== 'staff' && role !== 'admin')) {
      navigate('/login?portal=kitchen&redirect=/kitchen');
    }
  }, [navigate]);

  // Load orders from API
  const loadOrders = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await fetchOrders();
      setOrders(data);
    } catch (err) {
      console.error("Failed to load orders:", err);
      if (err.status === 401 || err.status === 403) {
        clearAuthSession();
        navigate('/login?portal=kitchen&redirect=/kitchen');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  // WebSocket Live Connection + 5s polling fallback
  useEffect(() => {
    let wsUrl = '';
    const customWs = import.meta.env.VITE_WS_URL;
    const apiHost = import.meta.env.VITE_API_BASE_URL;

    if (customWs) {
      wsUrl = `${customWs.replace(/\/$/, '')}/ws/orders`;
    } else if (apiHost) {
      const wsProtocol = apiHost.startsWith('https') ? 'wss:' : 'ws:';
      const cleanHost = apiHost.replace(/^https?:\/\//, '').replace(/\/$/, '');
      wsUrl = `${wsProtocol}//${cleanHost}/ws/orders`;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}/ws/orders`;
    }

    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          console.log("Connected to Kitchen WebSockets channel");
        };

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);

            if (payload.type === 'ORDER_CREATED') {
              const newOrder = payload.data;
              setOrders(prev => [newOrder, ...prev.filter(o => o.id !== newOrder.id)]);

              // Play audio chime alert
              if (soundEnabled) {
                playOrderNotificationSound();
              }

              // Highlight card
              setNewOrderIds(prev => new Set(prev).add(newOrder.id));

              // Auto-remove highlight after 10 seconds
              setTimeout(() => {
                setNewOrderIds(prev => {
                  const next = new Set(prev);
                  next.delete(newOrder.id);
                  return next;
                });
              }, 10000);
            } else if (payload.type === 'ORDER_STATUS_UPDATED') {
              setOrders(prev => prev.map(o => {
                if (o.id === payload.order_id) {
                  return {
                    ...o,
                    status: payload.status,
                    reject_reason: payload.reject_reason,
                    ...(payload.data || {})
                  };
                }
                return o;
              }));
            }
          } catch (e) {
            console.error("WS message parse error:", e);
          }
        };

        ws.onerror = (e) => {
          console.warn("WebSocket error, relying on polling fallback");
        };
      } catch (err) {
        console.warn("WebSocket instantiation error:", err);
      }
    };

    connectWebSocket();

    // 5-second polling fallback
    const interval = setInterval(() => {
      loadOrders(true);
    }, 5000);

    return () => {
      clearInterval(interval);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [soundEnabled]);

  const handleStatusChange = async (orderId, newStatus, reason = null) => {
    try {
      const updated = await updateOrderStatusApi(orderId, newStatus, reason);
      setOrders(prev => prev.map(o => o.id === orderId ? updated : o));
      if (reason) {
        setRejectingOrder(null);
        setRejectReason('');
      }
    } catch (err) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  // Bill Generation
  const handleOpenBill = async (tableNumber) => {
    setLoadingBill(true);
    try {
      const bill = await fetchTableBill(tableNumber);
      setBillModalData(bill);
    } catch (err) {
      alert(`Failed to fetch table bill: ${err.message}`);
    } finally {
      setLoadingBill(false);
    }
  };

  const handleLogout = () => {
    clearAuthSession();
    navigate('/login');
  };

  // Filter orders according to tab
  const filteredOrders = orders.filter(o => {
    if (activeTab === 'new') return o.status === 'received' || o.status === 'accepted';
    if (activeTab === 'preparing') return o.status === 'preparing';
    if (activeTab === 'served') return o.status === 'served';
    if (activeTab === 'all') return true;
    return true;
  });

  // Optional grouping by table
  const groupedOrders = React.useMemo(() => {
    if (!groupByTable) return null;
    const map = {};
    for (const order of filteredOrders) {
      const tNum = order.table_number || 'Unknown';
      if (!map[tNum]) map[tNum] = [];
      map[tNum].push(order);
    }
    return map;
  }, [filteredOrders, groupByTable]);

  // Format time (e.g. 10 mins ago, or HH:MM)
  const formatOrderTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-bg-deep text-cream">
      {/* Top Staff Navbar */}
      <header className="sticky top-0 z-40 bg-bg-card border-b border-gold/20 px-4 py-3 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={RESTAURANT_CONFIG.logoUrl || "/rawther_logo.jpg"}
              alt={RESTAURANT_CONFIG.restaurantName}
              className="w-10 h-10 rounded-full object-cover border border-gold/50 shadow-gold-glow shrink-0"
            />
            <div>
              <h1 className="font-serif font-bold text-lg text-gold flex items-center gap-2">
                <span>Kitchen Live Display</span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#87A96B] animate-pulse"></span>
              </h1>
              <p className="text-xs text-cream-muted">
                {RESTAURANT_CONFIG.restaurantName} • Real-time Orders
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                soundEnabled
                  ? 'bg-gold/15 text-gold border-gold/40'
                  : 'bg-bg-surface text-cream-dim border-white/10'
              }`}
              title={soundEnabled ? 'Order sound alert enabled' : 'Muted'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline">{soundEnabled ? 'Alerts ON' : 'Muted'}</span>
            </button>

            {/* Refresh */}
            <button
              onClick={() => loadOrders()}
              className="p-2 rounded-xl bg-bg-surface border border-gold/15 text-cream-muted hover:text-gold transition-colors"
              title="Manual refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Customer Menu Link */}
            <Link
              to="/menu"
              className="px-3 py-2 rounded-xl bg-bg-surface border border-gold/20 text-cream text-xs font-bold hover:text-gold transition-colors flex items-center gap-1.5"
            >
              <Utensils className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Menu</span>
            </Link>

            {/* Logout */}
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

      {/* Sub-header Filter Tabs & View Controls */}
      <div className="bg-bg-card/70 border-b border-gold/15 px-4 py-3 sticky top-[61px] z-30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('new')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                activeTab === 'new'
                  ? 'bg-gold text-bg-card border-gold font-extrabold shadow-gold-glow'
                  : 'bg-bg-surface text-cream-muted border-gold/15 hover:border-gold/30'
              }`}
            >
              New & Accepted ({orders.filter(o => o.status === 'received' || o.status === 'accepted').length})
            </button>
            <button
              onClick={() => setActiveTab('preparing')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                activeTab === 'preparing'
                  ? 'bg-white text-bg-deep border-white font-extrabold shadow-sm'
                  : 'bg-bg-surface text-cream-muted border-gold/15 hover:border-gold/30'
              }`}
            >
              Preparing ({orders.filter(o => o.status === 'preparing').length})
            </button>
            <button
              onClick={() => setActiveTab('served')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                activeTab === 'served'
                  ? 'bg-[#87A96B] text-bg-deep border-[#87A96B] font-extrabold shadow-sm'
                  : 'bg-bg-surface text-cream-muted border-gold/15 hover:border-gold/30'
              }`}
            >
              Served ({orders.filter(o => o.status === 'served').length})
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                activeTab === 'all'
                  ? 'bg-gold/20 text-gold border-gold font-extrabold'
                  : 'bg-bg-surface text-cream-muted border-gold/15 hover:border-gold/30'
              }`}
            >
              All Orders ({orders.length})
            </button>
          </div>

          {/* Group by table toggle & Optional Accept setting */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setGroupByTable(!groupByTable)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                groupByTable
                  ? 'bg-gold/20 text-gold border-gold/50'
                  : 'bg-bg-surface text-cream-muted border-gold/15'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Group by Table</span>
            </button>

            <button
              onClick={() => setRequireAcceptance(!requireAcceptance)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border hidden md:flex items-center gap-1.5 transition-all ${
                requireAcceptance
                  ? 'bg-white/15 text-white border-white/30'
                  : 'bg-bg-surface text-cream-dim border-white/10'
              }`}
              title="Toggle requirement for staff to click Accept before Preparing"
            >
              <span>Require Accept: {requireAcceptance ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Order Cards Container */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <div className="w-10 h-10 border-3 border-gold border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-semibold text-gold">Loading active kitchen tickets...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-20 bg-bg-card rounded-3xl border border-gold/15 max-w-lg mx-auto">
            <ChefHat className="w-14 h-14 text-gold/30 mx-auto mb-3" />
            <h3 className="font-serif font-bold text-lg text-cream">No orders in this status</h3>
            <p className="text-xs text-cream-muted mt-1">All kitchen orders have been processed or table has not ordered yet.</p>
          </div>
        ) : groupByTable ? (
          /* Grouped by Table View */
          <div className="space-y-8">
            {Object.entries(groupedOrders).map(([tNum, tableOrders]) => (
              <div key={tNum} className="bg-bg-card rounded-3xl border border-gold/25 p-5 shadow-premium">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-gold/20">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1.5 rounded-xl bg-gold text-bg-deep font-extrabold text-sm tracking-wide shadow-gold-glow">
                      Table {tNum}
                    </span>
                    <span className="text-xs text-cream-muted">
                      {tableOrders.length} {tableOrders.length === 1 ? 'ticket' : 'tickets'} • Total: {RESTAURANT_CONFIG.currencySymbol}{tableOrders.reduce((acc, o) => acc + (o.status !== 'rejected' ? o.total : 0), 0).toFixed(2)}
                    </span>
                  </div>

                  <button
                    onClick={() => handleOpenBill(parseInt(tNum, 10))}
                    className="px-3.5 py-1.5 rounded-xl bg-bg-surface border border-gold/30 text-gold text-xs font-bold hover:bg-gold hover:text-bg-card transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Bill</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tableOrders.map(order => renderOrderCard(order))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Standard Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredOrders.map(order => renderOrderCard(order))}
          </div>
        )}
      </main>

      {/* Reject Reason Modal */}
      {rejectingOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-bg-card rounded-3xl border border-rose-500/40 shadow-2xl p-6 relative">
            <button
              onClick={() => setRejectingOrder(null)}
              className="absolute top-4 right-4 text-cream-muted hover:text-cream"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 text-rose-400 font-bold mb-3">
              <AlertTriangle className="w-5 h-5" />
              <span>Reject Order #{rejectingOrder.id}</span>
            </div>
            <p className="text-xs text-cream-muted mb-4">
              Enter reason for rejecting order from Table {rejectingOrder.table_number}. Customer will see this on their screen.
            </p>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Item 65 Chicken is freshly sold out, or clarification needed on table."
              rows={3}
              className="w-full bg-bg-surface border border-rose-500/30 rounded-xl p-3 text-xs text-cream placeholder-cream-dim focus:outline-none focus:border-rose-400 mb-4"
            />

            <div className="flex items-center gap-2">
              <button
                onClick={() => setRejectingOrder(null)}
                className="flex-1 py-2.5 rounded-xl bg-bg-surface text-cream-muted text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleStatusChange(rejectingOrder.id, 'rejected', rejectReason || 'Kitchen rejected')}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Bill Modal */}
      {billModalData && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white text-black rounded-2xl shadow-2xl overflow-hidden p-6 relative">
            {/* Screen Controls */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-200 mb-4 no-print">
              <span className="font-bold text-sm text-gray-800">Print Table Bill</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-lg bg-[#87A96B] hover:bg-[#6E8E54] text-white font-bold text-xs flex items-center gap-1.5 shadow"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Receipt</span>
                </button>
                <button
                  onClick={() => setBillModalData(null)}
                  className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Thermal Print Receipt Style Layout */}
            <div className="font-mono text-xs leading-relaxed printable-receipt text-black">
              <div className="text-center pb-3 border-b border-dashed border-gray-400">
                <h2 className="font-serif font-black text-xl text-black uppercase tracking-wider">
                  {billModalData.restaurant_name}
                </h2>
                <p className="text-[11px] text-gray-600">Authentic Heritage Dum Biriyani</p>
                <div className="mt-2 text-sm font-bold bg-gray-100 py-1 rounded">
                  TABLE {billModalData.table_number} BILL
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  {new Date(billModalData.bill_time).toLocaleString()}
                </p>
              </div>

              {/* Items Table */}
              <div className="py-3 border-b border-dashed border-gray-400">
                <div className="flex justify-between font-bold pb-1 text-gray-700 border-b border-gray-300">
                  <span>ITEM</span>
                  <span>QTY × PRICE = AMT</span>
                </div>
                <div className="space-y-1.5 mt-2">
                  {billModalData.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-start">
                      <div className="flex-1 pr-2">
                        <span className="font-bold">{it.item_name}</span>
                        {it.variant_label && (
                          <span className="text-[10px] text-gray-600 block">
                            ({it.variant_label})
                          </span>
                        )}
                      </div>
                      <div className="text-right font-semibold whitespace-nowrap">
                        {it.unit_price > 0 ? (
                          `${it.quantity} × ${billModalData.currency_symbol}${it.unit_price} = ${billModalData.currency_symbol}${it.subtotal.toFixed(2)}`
                        ) : (
                          `${it.quantity} × Ask staff`
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grand Total */}
              <div className="py-3 border-b border-dashed border-gray-400 flex justify-between items-center text-sm font-black">
                <span>GRAND TOTAL</span>
                <span className="text-base font-black">
                  {billModalData.currency_symbol}{billModalData.grand_total.toFixed(2)}
                </span>
              </div>

              <div className="text-center pt-3 text-[10px] text-gray-500">
                <p>Thank you for dining with us!</p>
                <p>Please visit again.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Helper to render individual Order Card
  function renderOrderCard(order) {
    const isNew = newOrderIds.has(order.id);
    const isRejected = order.status === 'rejected';

    return (
      <div
        key={order.id}
        className={`bg-bg-card rounded-2xl border flex flex-col justify-between transition-all duration-300 shadow-premium overflow-hidden ${
          isNew
            ? 'border-gold shadow-gold-glow-lg scale-[1.01] ring-2 ring-gold/40'
            : isRejected
            ? 'border-rose-500/30 opacity-70'
            : order.status === 'preparing'
            ? 'border-white/50'
            : order.status === 'served'
            ? 'border-[#87A96B]/50'
            : 'border-gold/20 hover:border-gold/40'
        }`}
      >
        {/* Card Header: Table, Order ID, Time */}
        <div className="p-4 bg-bg-surface/80 border-b border-gold/15 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-xl bg-gold font-extrabold text-bg-card text-xs tracking-wider shadow-sm">
              Table {order.table_number}
            </span>
            <span className="text-xs font-bold text-cream">
              #{order.id}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenBill(order.table_number)}
              className="p-1.5 rounded-lg bg-bg-card hover:bg-gold/20 text-cream-muted hover:text-gold border border-gold/15 transition-colors"
              title="Print Table Bill"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>

            <span className="text-xs text-cream-dim flex items-center gap-1 font-mono">
              <Clock className="w-3 h-3" />
              {formatOrderTime(order.created_at)}
            </span>
          </div>
        </div>

        {/* Card Body: Items, quantities, cooking notes */}
        <div className="p-4 flex-1 space-y-3">
          <div className="divide-y divide-gold/10 space-y-2">
            {order.items.map((it) => (
              <div key={it.id} className="pt-2 first:pt-0">
                <div className="flex items-start justify-between text-xs">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-2">
                    <span className="font-extrabold text-gold text-sm w-5 shrink-0">
                      {it.quantity}×
                    </span>
                    <span className="font-semibold text-cream truncate">
                      {it.item_name}
                    </span>
                    {it.variant_label && (
                      <span className="px-1.5 py-0.5 rounded bg-gold/15 text-gold text-[10px] font-bold shrink-0">
                        {it.variant_label}
                      </span>
                    )}
                  </div>
                  <span className="text-cream-dim font-mono text-[11px] shrink-0">
                    {it.unit_price > 0 ? (
                      `${RESTAURANT_CONFIG.currencySymbol}${(it.unit_price * it.quantity).toFixed(2)}`
                    ) : (
                      <span className="text-white font-semibold bg-white/10 px-1.5 py-0.5 rounded border border-white/20 text-[10px]">
                        Ask staff
                      </span>
                    )}
                  </span>
                </div>

                {/* Individual item cooking note */}
                {it.note && (
                  <p className="text-[11px] text-white/90 italic bg-white/10 px-2 py-0.5 rounded border border-white/20 mt-1 ml-6">
                    Note: "{it.note}"
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Overall order instruction */}
          {order.note && (
            <div className="p-2.5 rounded-xl bg-white/10 border border-white/20 text-[11px] text-white/90">
              <span className="font-bold text-white">Kitchen Note: </span>
              <span>{order.note}</span>
            </div>
          )}

          {/* Rejection notice if rejected */}
          {isRejected && (
            <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/30 text-[11px] text-rose-300">
              <span className="font-bold">Rejected: </span>
              <span>{order.reject_reason || 'No reason provided'}</span>
            </div>
          )}
        </div>

        {/* Card Footer: Status Badge, Total & Action Transitions */}
        <div className="p-4 bg-bg-surface/50 border-t border-gold/15">
          <div className="flex items-center justify-between mb-3 text-xs">
            <span className="font-medium text-cream-muted uppercase tracking-wider text-[10px]">
              Status: <span className="font-bold text-cream">{order.status.toUpperCase()}</span>
            </span>
            <span className="font-serif font-bold text-sm text-gold">
              {RESTAURANT_CONFIG.currencySymbol}{order.total.toFixed(2)}
            </span>
          </div>

          {/* Status Progression Buttons */}
          <div className="flex items-center gap-2">
            {order.status === 'received' && (
              <>
                <button
                  onClick={() => setRejectingOrder(order)}
                  className="px-2.5 py-2 rounded-xl bg-rose-950/50 hover:bg-rose-950 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all"
                >
                  Reject
                </button>
                {requireAcceptance ? (
                  <button
                    onClick={() => handleStatusChange(order.id, 'accepted')}
                    className="flex-1 py-2 rounded-xl bg-white hover:bg-slate-100 text-bg-deep font-extrabold text-xs uppercase tracking-wide transition-all shadow-sm"
                  >
                    Accept Order
                  </button>
                ) : (
                  <button
                    onClick={() => handleStatusChange(order.id, 'preparing')}
                    className="flex-1 py-2 rounded-xl bg-gradient-to-r from-white via-slate-100 to-white hover:brightness-105 text-bg-deep font-extrabold text-xs uppercase tracking-wide transition-all shadow-gold-glow flex items-center justify-center gap-1.5"
                  >
                    <span>Start Cooking</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            )}

            {order.status === 'accepted' && (
              <>
                <button
                  onClick={() => setRejectingOrder(order)}
                  className="px-2.5 py-2 rounded-xl bg-rose-950/50 hover:bg-rose-950 text-rose-300 border border-rose-500/30 text-xs font-bold"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleStatusChange(order.id, 'preparing')}
                  className="flex-1 py-2 rounded-xl bg-gradient-to-r from-white via-slate-100 to-white hover:brightness-105 text-bg-deep font-extrabold text-xs uppercase tracking-wide shadow-gold-glow flex items-center justify-center gap-1.5"
                >
                  <span>Start Cooking</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            {order.status === 'preparing' && (
              <button
                onClick={() => handleStatusChange(order.id, 'served')}
                className="w-full py-2.5 rounded-xl bg-[#87A96B] hover:bg-[#6E8E54] text-white font-extrabold text-xs uppercase tracking-wide shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Mark as Served</span>
              </button>
            )}

            {order.status === 'served' && (
              <button
                onClick={() => handleStatusChange(order.id, 'completed')}
                className="w-full py-2 rounded-xl bg-bg-surface hover:bg-bg-elevated border border-gold/30 text-cream-muted hover:text-cream text-xs font-bold"
              >
                Complete Ticket
              </button>
            )}

            {order.status === 'completed' && (
              <span className="w-full text-center py-1.5 text-xs font-bold text-cream-dim">
                ✓ Ticket Completed
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }
}
