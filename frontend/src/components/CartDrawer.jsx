import React, { useState } from 'react';
import { X, Trash2, Plus, Minus, FileText, AlertCircle, Loader2, Sparkles, Utensils } from 'lucide-react';
import VegBadge from './VegBadge';
import { RESTAURANT_CONFIG } from '../config';

export default function CartDrawer({
  isOpen,
  onClose,
  cartItems = [],
  tableNumber,
  tableToken,
  onUpdateQty,
  onRemoveItem,
  onUpdateItemNote,
  orderNote,
  setOrderNote,
  onPlaceOrder,
  isPlacingOrder,
  orderError,
  onOpenTableModal
}) {
  const [activeNoteItemId, setActiveNoteItemId] = useState(null);

  if (!isOpen) return null;

  const totalAmount = cartItems.reduce((acc, it) => acc + (it.unit_price * it.quantity), 0);
  const totalCount = cartItems.reduce((acc, it) => acc + it.quantity, 0);

  const canPlaceOrder = cartItems.length > 0 && tableNumber && tableToken && !isPlacingOrder;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-x-0 bottom-0 max-w-lg mx-auto bg-bg-card rounded-t-3xl border-t border-gold/30 shadow-2xl flex flex-col max-h-[90vh] animate-slide-up">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gold/15 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gold/15 flex items-center justify-center text-gold border border-gold/30">
              <Utensils className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg text-cream leading-tight">
                Your Order
              </h2>
              <p className="text-xs text-cream-muted">
                {tableNumber ? `Table ${tableNumber}` : 'No table set'} • {totalCount} {totalCount === 1 ? 'item' : 'items'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-bg-surface flex items-center justify-center text-cream-muted hover:text-cream border border-gold/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning if no table or token */}
        {(!tableNumber || !tableToken) && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-white/10 border border-white/20 text-white text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-white shrink-0" />
              <span>Table number or token missing</span>
            </div>
            <button
              onClick={onOpenTableModal}
              className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white font-bold rounded-lg border border-white/30 transition-colors"
            >
              Set Table
            </button>
          </div>
        )}

        {/* Error notification if order failed */}
        {orderError && (
          <div className="mx-4 mt-3 p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-rose-300">Order Could Not Be Placed</p>
              <p className="mt-0.5 leading-relaxed text-rose-200/90">{orderError}</p>
            </div>
          </div>
        )}

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 divide-y divide-gold/10 space-y-3">
          {cartItems.length === 0 ? (
            <div className="text-center py-12">
              <Utensils className="w-12 h-12 text-cream-dim mx-auto mb-3 opacity-40" />
              <p className="text-sm font-semibold text-cream">Your cart is empty</p>
              <p className="text-xs text-cream-muted mt-1">Add your favorite biriyanis and grills from the menu</p>
            </div>
          ) : (
            cartItems.map((item, index) => {
              const itemKey = `${item.item_id}_${item.variant_id || 'base'}`;
              const isEditingNote = activeNoteItemId === itemKey;

              return (
                <div key={itemKey} className="pt-3 first:pt-0">
                  <div className="flex items-start justify-between gap-2">
                    {/* Dish thumbnail or elegant icon */}
                    {item.image_url ? (
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-bg-surface border border-gold/25 shrink-0 mt-0.5 shadow-sm">
                        <img
                          src={item.image_url}
                          alt={item.item_name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-bg-surface border border-gold/20 text-gold/70 shrink-0 mt-0.5 shadow-inner">
                        <Utensils className="w-5 h-5 text-gold/60" />
                      </div>
                    )}

                    {/* Item details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <VegBadge isVeg={item.is_veg} />
                        <h4 className="font-semibold text-sm text-cream truncate">
                          {item.item_name}
                        </h4>
                      </div>

                      {item.variant_label && (
                        <span className="inline-block text-[11px] font-medium bg-gold/15 text-gold px-2 py-0.5 rounded-md border border-gold/30 mt-1">
                          {item.variant_label}
                        </span>
                      )}

                      <div className="text-xs mt-1">
                        {item.is_priceless || !item.unit_price ? (
                          <span className="text-white font-semibold bg-white/10 px-2 py-0.5 rounded border border-white/20">
                            Ask staff (Qty: {item.quantity})
                          </span>
                        ) : (
                          <span className="text-gold font-bold">
                            {RESTAURANT_CONFIG.currencySymbol}{item.unit_price} × {item.quantity} = {RESTAURANT_CONFIG.currencySymbol}{(item.unit_price * item.quantity).toFixed(2)}
                          </span>
                        )}
                      </div>

                      {/* Display note if set */}
                      {item.note && !isEditingNote && (
                        <p className="text-xs text-white/90 italic bg-white/10 px-2 py-1 rounded border border-white/20 mt-1.5 flex items-center gap-1">
                          <FileText className="w-3 h-3 shrink-0" />
                          <span>"{item.note}"</span>
                        </p>
                      )}
                    </div>

                    {/* Stepper + delete button */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="flex items-center bg-bg-surface rounded-lg border border-gold/30 h-8">
                        <button
                          onClick={() => {
                            if (item.quantity > 1) {
                              onUpdateQty(item.item_id, item.variant_id, item.quantity - 1);
                            } else {
                              onRemoveItem(item.item_id, item.variant_id);
                            }
                          }}
                          className="w-7 h-full flex items-center justify-center text-gold hover:bg-gold/20"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-bold text-cream">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQty(item.item_id, item.variant_id, item.quantity + 1)}
                          className="w-7 h-full flex items-center justify-center text-gold hover:bg-gold/20"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => onRemoveItem(item.item_id, item.variant_id)}
                        className="p-1.5 text-rose-400/80 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Add / Edit item-level note button */}
                  <div className="mt-2">
                    {isEditingNote ? (
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="text"
                          value={item.note || ''}
                          onChange={(e) => onUpdateItemNote(item.item_id, item.variant_id, e.target.value)}
                          placeholder="e.g. less spicy, no onion"
                          maxLength={60}
                          className="flex-1 bg-bg-surface border border-gold/30 rounded-lg px-2.5 py-1 text-xs text-cream placeholder-cream-dim focus:outline-none focus:border-gold"
                        />
                        <button
                          onClick={() => setActiveNoteItemId(null)}
                          className="px-2.5 py-1 bg-gold text-bg-card font-bold text-xs rounded-lg"
                        >
                          Done
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setActiveNoteItemId(itemKey)}
                        className="text-[11px] text-cream-muted hover:text-gold flex items-center gap-1 transition-colors"
                      >
                        <FileText className="w-3 h-3" />
                        <span>{item.note ? 'Edit cooking note' : '+ Add cooking note'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Overall Order Note */}
          {cartItems.length > 0 && (
            <div className="pt-3 border-t border-gold/15">
              <label className="block text-xs font-semibold text-cream-muted mb-1.5">
                Special Instructions for the Kitchen (Optional)
              </label>
              <textarea
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                placeholder="e.g. Please bring extra raitha and gravy with the biriyani"
                rows={2}
                maxLength={200}
                className="w-full bg-bg-surface border border-gold/20 rounded-xl px-3 py-2 text-xs text-cream placeholder-cream-dim focus:outline-none focus:border-gold resize-none"
              />
            </div>
          )}
        </div>

        {/* Drawer Footer with Subtotal & Place Order */}
        {cartItems.length > 0 && (
          <div className="p-4 bg-bg-surface/90 border-t border-gold/20 shrink-0 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-cream-muted">Subtotal</span>
              <span className="font-bold text-base text-cream">
                {RESTAURANT_CONFIG.currencySymbol}{totalAmount.toFixed(2)}
              </span>
            </div>

            <button
              onClick={onPlaceOrder}
              disabled={!canPlaceOrder}
              className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm tracking-wide uppercase flex items-center justify-center gap-2 shadow-gold-glow transition-all duration-200 ${
                canPlaceOrder
                  ? 'bg-gradient-to-r from-white via-slate-100 to-white hover:brightness-105 text-bg-deep active:scale-[0.98]'
                  : 'bg-white/30 text-bg-deep cursor-not-allowed opacity-60'
              }`}
            >
              {isPlacingOrder ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Sending to Kitchen...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Send Order to Kitchen ({RESTAURANT_CONFIG.currencySymbol}{totalAmount.toFixed(2)})</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
