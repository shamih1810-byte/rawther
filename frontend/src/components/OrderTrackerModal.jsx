import React, { useEffect, useState, useRef } from 'react';
import { CheckCircle2, Clock, Flame, UtensilsCrossed, AlertTriangle, X, RefreshCw, PlusCircle } from 'lucide-react';
import { fetchOrderById } from '../api';
import { RESTAURANT_CONFIG } from '../config';
import confetti from 'canvas-confetti';

export default function OrderTrackerModal({
  order,
  isOpen,
  onClose,
  onOrderMore
}) {
  const [currentOrder, setCurrentOrder] = useState(order);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const socketRef = useRef(null);

  // Sync state if initial prop changes
  useEffect(() => {
    if (order) {
      setCurrentOrder(order);
      // Trigger festive golden & sage confetti once on order placement!
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#FFFFFF', '#87A96B', '#5A3E2B', '#F7F1E1']
        });
      } catch (e) {}
    }
  }, [order?.id]);

  // WebSocket Live Tracker with Polling Fallback (every 5 seconds)
  useEffect(() => {
    if (!isOpen || !currentOrder?.id) return;

    const orderId = currentOrder.id;

    // Connect WebSocket
    let wsUrl = '';
    const customWs = import.meta.env.VITE_WS_URL;
    const apiHost = import.meta.env.VITE_API_BASE_URL;

    if (customWs) {
      wsUrl = `${customWs.replace(/\/$/, '')}/ws/orders/${orderId}`;
    } else if (apiHost) {
      const wsProtocol = apiHost.startsWith('https') ? 'wss:' : 'ws:';
      const cleanHost = apiHost.replace(/^https?:\/\//, '').replace(/\/$/, '');
      wsUrl = `${wsProtocol}//${cleanHost}/ws/orders/${orderId}`;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}/ws/orders/${orderId}`;
    }
    
    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'ORDER_STATUS_UPDATED' && payload.order_id === orderId) {
            setCurrentOrder(prev => ({
              ...prev,
              status: payload.status,
              reject_reason: payload.reject_reason,
              ...(payload.data || {})
            }));
          }
        } catch (err) {
          console.error("WS error parsing message:", err);
        }
      };

      ws.onerror = (e) => {
        console.warn("WebSocket connection fallback to polling:", e);
      };
    } catch (e) {
      console.warn("Failed to instantiate WebSocket:", e);
    }

    // Polling fallback every 5 seconds
    const interval = setInterval(async () => {
      try {
        const fresh = await fetchOrderById(orderId);
        setCurrentOrder(fresh);
      } catch (e) {
        // quiet error on poll
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [isOpen, currentOrder?.id]);

  if (!isOpen || !currentOrder) return null;

  const steps = [
    { key: "received", label: "Received", icon: Clock },
    { key: "preparing", label: "Preparing", icon: Flame },
    { key: "served", label: "Served", icon: UtensilsCrossed }
  ];

  // Map order status to progress index
  const getStepIndex = (st) => {
    if (st === 'received') return 0;
    if (st === 'accepted') return 0; // accepted treated as received/in-queue
    if (st === 'preparing') return 1;
    if (st === 'served' || st === 'completed') return 2;
    return -1;
  };

  const currentStepIdx = getStepIndex(currentOrder.status);
  const isRejected = currentOrder.status === 'rejected';

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const data = await fetchOrderById(currentOrder.id);
      setCurrentOrder(data);
    } catch (e) {
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="w-full max-w-lg bg-bg-card rounded-t-3xl sm:rounded-3xl border border-gold/30 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="px-5 py-4 bg-bg-surface/90 border-b border-gold/15 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#87A96B]/20 border border-[#87A96B]/50 text-[#87A96B] flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-base text-cream">
                Order #{currentOrder.id} Placed!
              </h2>
              <p className="text-xs text-cream-muted">
                Table {currentOrder.table_number} • Live Kitchen Tracker
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleManualRefresh}
              className={`p-2 rounded-lg bg-bg-card text-cream-muted hover:text-gold border border-gold/15 ${isRefreshing ? 'animate-spin' : ''}`}
              title="Refresh status"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-bg-card text-cream-muted hover:text-cream border border-gold/15"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Status Tracker */}
          {isRejected ? (
            <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-200">
              <div className="flex items-center gap-2.5 font-bold text-rose-300">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <span>Order Rejected by Kitchen</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-rose-200/90">
                Reason: {currentOrder.reject_reason || 'Item unavailable or table clarification needed. Please speak with floor staff.'}
              </p>
            </div>
          ) : (
            <div className="bg-bg-surface/70 rounded-2xl p-4 border border-gold/20 shadow-inner">
              <p className="text-xs font-semibold text-center text-cream-muted uppercase tracking-wider mb-4">
                Live Kitchen Status
              </p>

              {/* Progress Steps */}
              <div className="relative flex items-center justify-between px-3">
                {/* Horizontal Progress line */}
                <div className="absolute left-8 right-8 top-5 h-[2px] bg-bg-deep -z-0">
                  <div
                    className="h-full bg-gradient-to-r from-gold to-[#87A96B] transition-all duration-500"
                    style={{
                      width: currentStepIdx === 0 ? '0%' : currentStepIdx === 1 ? '50%' : '100%'
                    }}
                  />
                </div>

                {steps.map((step, idx) => {
                  const Icon = step.icon;
                  const isDone = currentStepIdx >= idx;
                  const isCurrent = currentStepIdx === idx;

                  return (
                    <div key={step.key} className="flex flex-col items-center relative z-10">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${
                          isCurrent
                            ? 'bg-white text-bg-deep border-white shadow-gold-glow scale-110 font-bold'
                            : isDone
                            ? 'bg-[#87A96B] text-white border-[#87A96B] shadow-sm'
                            : 'bg-bg-card text-cream-dim border-gold/20'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span
                        className={`mt-2 text-xs font-semibold ${
                          isCurrent
                            ? 'text-white font-bold'
                            : isDone
                            ? 'text-[#87A96B]'
                            : 'text-cream-dim'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 text-center">
                {currentOrder.status === 'received' && (
                  <p className="text-xs text-cream-muted">
                    Your order has been transmitted to the kitchen display.
                  </p>
                )}
                {currentOrder.status === 'preparing' && (
                  <p className="text-xs text-white font-medium animate-pulse">
                    Chef is preparing your biriyani and charcoal grills fresh!
                  </p>
                )}
                {currentOrder.status === 'served' && (
                  <p className="text-xs text-[#87A96B] font-medium">
                    Order has been served to Table {currentOrder.table_number}. Enjoy your royal feast!
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Items Summary */}
          <div className="bg-bg-surface/50 rounded-2xl p-4 border border-gold/15">
            <h3 className="font-serif font-bold text-sm text-gold mb-3">
              Ordered Items
            </h3>
            <div className="divide-y divide-gold/10 space-y-2.5">
              {currentOrder.items && currentOrder.items.map((it) => (
                <div key={it.id} className="pt-2.5 first:pt-0 flex items-start justify-between text-xs">
                  <div>
                    <span className="font-bold text-cream">{it.quantity}× </span>
                    <span className="text-cream">{it.item_name}</span>
                    {it.variant_label && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded bg-gold/15 text-gold text-[10px]">
                        {it.variant_label}
                      </span>
                    )}
                    {it.note && (
                      <p className="text-cream-muted italic mt-0.5 text-[11px]">"{it.note}"</p>
                    )}
                  </div>
                  <span className="font-semibold text-cream shrink-0 ml-2">
                    {it.unit_price > 0 ? (
                      `${RESTAURANT_CONFIG.currencySymbol}${(it.unit_price * it.quantity).toFixed(2)}`
                    ) : (
                      <span className="text-white text-[11px] font-semibold">
                        Ask staff
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-gold/20 flex items-center justify-between text-sm">
              <span className="font-semibold text-cream-muted">Total Paid / Due</span>
              <span className="font-bold font-serif text-base text-gold">
                {RESTAURANT_CONFIG.currencySymbol}{currentOrder.total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer: Order More CTA */}
        <div className="p-4 bg-bg-surface/90 border-t border-gold/20 flex items-center gap-3">
          <button
            onClick={onOrderMore}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-white via-slate-100 to-white hover:brightness-105 text-bg-deep font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-gold-glow transition-all active:scale-[0.98]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Order More for Table {currentOrder.table_number}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
