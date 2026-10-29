import React, { useState, useEffect } from 'react';
import { ShoppingBag, ChevronRight } from 'lucide-react';
import { RESTAURANT_CONFIG } from '../config';

export default function FloatingCartBar({ cartItems = [], onOpenCart }) {
  const totalCount = cartItems.reduce((acc, it) => acc + it.quantity, 0);
  const totalPrice = cartItems.reduce((acc, it) => acc + (it.unit_price * it.quantity), 0);

  const [isBumping, setIsBumping] = useState(false);

  // Trigger bounce animation whenever items are added or quantities change
  useEffect(() => {
    if (totalCount > 0) {
      setIsBumping(true);
      const timer = setTimeout(() => setIsBumping(false), 450);
      return () => clearTimeout(timer);
    }
  }, [totalCount, totalPrice]);

  if (totalCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-0 right-0 z-40 px-4 animate-slide-up">
      <div className="max-w-md mx-auto">
        <button
          onClick={onOpenCart}
          className={`w-full bg-gradient-to-r from-white via-slate-100 to-white hover:brightness-105 text-bg-deep px-5 py-3.5 rounded-2xl shadow-gold-glow-lg flex items-center justify-between border border-white/50 transition-all duration-200 active:scale-[0.97] cursor-pointer ${
            isBumping ? 'animate-cart-bump ring-2 ring-white' : ''
          }`}
        >
          {/* Left: Bag icon + count + price */}
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-xl bg-bg-deep/90 flex items-center justify-center text-gold shadow-sm">
              <ShoppingBag className="w-5 h-5" />
              <span
                key={totalCount}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white text-[11px] font-black flex items-center justify-center shadow animate-number-pop"
              >
                {totalCount}
              </span>
            </div>
            <div className="text-left">
              <p className="text-xs uppercase font-extrabold tracking-wider opacity-85 text-bg-deep">
                {totalCount} {totalCount === 1 ? 'Item' : 'Items'}
              </p>
              <p className="text-base font-bold font-serif leading-tight">
                {RESTAURANT_CONFIG.currencySymbol}{totalPrice.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Right: CTA */}
          <div className="flex items-center gap-1 font-bold text-sm tracking-wide bg-bg-deep/20 px-3 py-1.5 rounded-xl">
            <span>View Cart</span>
            <ChevronRight className="w-4 h-4 stroke-[2.5]" />
          </div>
        </button>
      </div>
    </div>
  );
}
