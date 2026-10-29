import React, { useState } from 'react';
import { Plus, Minus, Info, Sparkles } from 'lucide-react';
import VegBadge from './VegBadge';
import { RESTAURANT_CONFIG, playOrderNotificationSound } from '../config';

// Map dish to authentic appetizing photography only; return null for excluded or image-free items
export const getDishImageUrl = (item) => {
  if (!item || !item.image_url) return null;
  const name = (item.name || '').toLowerCase();

  // Strictly exclude Beef, Thanthoori, Tikka, Kababs, and mismatched dishes
  if (
    name.includes('beef') ||
    name.includes('thanthoori') ||
    name.includes('tandoori') ||
    name.includes('tikka') ||
    name.includes('kabab') ||
    name.includes('gilma') ||
    name.includes('pallipalayam') ||
    name.includes('chinthamani') ||
    name.includes('kolhapuri') ||
    name.includes('do pyaza') ||
    name.includes('andhra') ||
    name.includes('off mt') ||
    name.includes('65 chicken chukka')
  ) {
    return null;
  }

  return item.image_url;
};

export default function ItemCard({
  item,
  cartItems = [],
  onAddToCart,
  onUpdateCartQty
}) {
  const hasVariants = item.variants && item.variants.length > 0;
  const [selectedVariantId, setSelectedVariantId] = useState(
    hasVariants ? item.variants[0].id : null
  );

  // Micro-interaction animation state
  const [isPulsing, setIsPulsing] = useState(false);
  const [floatingBadges, setFloatingBadges] = useState([]);
  const [animKey, setAnimKey] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    // Only apply 3D tilt on larger devices with mouse pointer
    if (window.matchMedia('(pointer: coarse)').matches) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 6;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -6;
    setTilt({ x, y });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  const selectedVariant = hasVariants
    ? item.variants.find(v => v.id === selectedVariantId) || item.variants[0]
    : null;

  // Find quantity in cart for this specific item + variant combination
  const cartItem = cartItems.find(ci => {
    if (ci.item_id !== item.id) return false;
    if (hasVariants) return ci.variant_id === selectedVariantId;
    return !ci.variant_id;
  });

  const quantityInCart = cartItem ? cartItem.quantity : 0;

  // Determine pricing display
  const isPriceless = !hasVariants && (item.base_price === null || item.base_price === undefined);
  const currentPrice = hasVariants ? selectedVariant?.price : item.base_price;
  const isSoldOut = !item.is_available;

  // Dish photo next to dish name (null if beef, thanthoori, or no authentic photo)
  const dishImageUrl = getDishImageUrl(item);

  const triggerClickFeedback = () => {
    playOrderNotificationSound();
    setIsPulsing(true);
    setTimeout(() => setIsPulsing(false), 600);

    const badgeId = Date.now() + Math.random();
    setFloatingBadges(prev => [...prev, { id: badgeId, text: '+1' }]);
    setTimeout(() => {
      setFloatingBadges(prev => prev.filter(b => b.id !== badgeId));
    }, 750);

    setAnimKey(k => k + 1);
  };

  const handleAdd = () => {
    if (isSoldOut) return;
    triggerClickFeedback();
    onAddToCart({
      item_id: item.id,
      item_name: item.name,
      variant_id: hasVariants ? selectedVariant.id : null,
      variant_label: hasVariants ? selectedVariant.label : null,
      unit_price: currentPrice !== null && currentPrice !== undefined ? currentPrice : 0,
      is_priceless: isPriceless,
      is_veg: item.is_veg,
      image_url: dishImageUrl,
      note: ""
    });
  };

  const handleIncrease = () => {
    if (isSoldOut) return;
    triggerClickFeedback();
    onUpdateCartQty(item.id, hasVariants ? selectedVariant.id : null, quantityInCart + 1);
  };

  const handleDecrease = () => {
    setAnimKey(k => k + 1);
    onUpdateCartQty(item.id, hasVariants ? selectedVariant.id : null, quantityInCart - 1);
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: tilt.x !== 0 || tilt.y !== 0
          ? `perspective(800px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg) translateY(-3px)`
          : undefined,
      }}
      className={`relative bg-[#2E1E14]/95 backdrop-blur-xl rounded-2xl p-3.5 sm:p-4 border transition-all duration-200 shadow-[0_12px_28px_rgba(0,0,0,0.85)] card-hover-lift hover:bg-[#3B281C]/98 hover:shadow-[0_18px_38px_rgba(0,0,0,0.95)] hover:-translate-y-0.5 overflow-hidden ${
        isPulsing ? 'animate-gold-pulse border-gold/80' : ''
      } ${
        isSoldOut
          ? 'opacity-65 border-white/5 grayscale-[50%]'
          : 'border-gold/25 hover:border-gold/55'
      }`}
    >
      {/* Subtle luxury top golden hairline glow */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-gold/40 to-transparent pointer-events-none rounded-t-2xl"></div>

      {/* Floating "+1" Badges */}
      {floatingBadges.map((badge) => (
        <span
          key={badge.id}
          className="absolute -top-3 right-4 z-30 pointer-events-none px-2 py-0.5 rounded-full bg-gradient-to-r from-white via-slate-100 to-white text-bg-deep font-black text-xs shadow-gold-glow animate-float-badge flex items-center gap-0.5 select-none"
        >
          <Sparkles className="w-2.5 h-2.5" />
          <span>{badge.text}</span>
        </span>
      ))}
      <div className="flex items-start gap-3 relative z-10">
        {/* Dish Image (only shown if an authentic matching picture exists) */}
        {dishImageUrl ? (
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-[#1C140E] border border-gold/30 shrink-0 shadow-md relative group">
            <img
              src={dishImageUrl}
              alt={item.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
            {isSoldOut && (
              <div className="absolute inset-0 bg-[#1C140E]/80 backdrop-blur-[1px] flex items-center justify-center">
                <span className="text-[10px] font-bold text-rose-300 uppercase tracking-wider">
                  Sold Out
                </span>
              </div>
            )}
          </div>
        ) : null}

        {/* Center: Title, VegBadge, Description, Variants, Price */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <VegBadge isVeg={item.is_veg} />
            <h3 className="font-serif font-bold text-sm sm:text-base text-cream-light tracking-tight drop-shadow-sm">
              {item.name}
            </h3>
            {!dishImageUrl && isSoldOut && (
              <span className="ml-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-500/30 uppercase tracking-wider">
                Sold Out
              </span>
            )}
          </div>

          {item.description && (
            <p className="text-[11px] sm:text-xs text-cream-muted/90 line-clamp-2 leading-relaxed mb-2 font-normal">
              {item.description}
            </p>
          )}

          {/* Variants chips (Quarter / Half / Full) */}
          {hasVariants && (
            <div className="flex flex-wrap gap-1.5 my-1.5">
              {item.variants.map((v) => {
                const isSelected = selectedVariantId === v.id;
                return (
                  <button
                    key={v.id}
                    disabled={isSoldOut}
                    onClick={() => {
                      setSelectedVariantId(v.id);
                      setAnimKey(k => k + 1);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all border active:scale-90 duration-150 ${
                      isSelected
                        ? 'bg-gradient-to-r from-white to-slate-100 text-bg-deep border-white font-bold shadow-sm ring-1 ring-white/40 scale-[1.02]'
                        : 'bg-[#231811]/90 text-cream-muted border-gold/25 hover:border-gold/50 hover:text-cream hover:bg-[#3B281C]'
                    }`}
                  >
                    <span>{v.label}</span>
                    <span className="ml-1 opacity-90">
                      {RESTAURANT_CONFIG.currencySymbol}{v.price}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Price Display */}
          <div className="mt-1 flex items-baseline gap-2">
            {isPriceless ? (
              <span className="text-xs font-semibold text-white bg-white/10 px-2 py-0.5 rounded-md border border-white/25 flex items-center gap-1 shadow-sm">
                <Info className="w-3.5 h-3.5" /> Ask staff
              </span>
            ) : (
              <div className="flex items-baseline">
                <span className="text-xs font-semibold text-gold mr-0.5">
                  {RESTAURANT_CONFIG.currencySymbol}
                </span>
                <span className="text-base sm:text-lg font-bold font-serif text-gold-light drop-shadow-sm">
                  {currentPrice}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Add Button or Stepper CTA */}
        <div className="flex flex-col items-end justify-between shrink-0 self-stretch min-w-[76px] pl-1">
          <div className="h-1"></div>

          {/* Action Button / Stepper */}
          <div className="mt-auto">
            {isSoldOut ? (
              <span className="inline-block px-2.5 py-1 rounded-xl text-[11px] font-bold bg-rose-950/80 text-rose-300 border border-rose-500/30 whitespace-nowrap">
                Sold out
              </span>
            ) : quantityInCart > 0 ? (
              /* Stepper */
              <div className="flex items-center bg-[#1C140E] rounded-xl border border-gold/50 shadow-gold-glow overflow-hidden h-8 sm:h-9">
                <button
                  onClick={handleDecrease}
                  aria-label="Decrease quantity"
                  className="w-7 sm:w-8 h-full flex items-center justify-center text-gold hover:bg-gold/20 active:scale-75 active:bg-gold/30 transition-all duration-150 cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span
                  key={animKey}
                  className="w-6 sm:w-7 text-center font-bold text-xs sm:text-sm text-cream-light select-none animate-number-pop inline-block"
                >
                  {quantityInCart}
                </span>
                <button
                  onClick={handleIncrease}
                  aria-label="Increase quantity"
                  className="w-7 sm:w-8 h-full flex items-center justify-center text-gold hover:bg-gold/20 active:scale-75 active:bg-gold/30 transition-all duration-150 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              /* Add Button for both priced and unpriced items */
              <button
                onClick={handleAdd}
                className="min-h-[34px] sm:min-h-[38px] px-3.5 sm:px-4 py-1.5 rounded-xl text-xs font-bold tracking-wide uppercase bg-gradient-to-r from-white via-slate-100 to-white hover:brightness-105 text-bg-deep shadow-gold-glow flex items-center gap-1 active:scale-90 hover:scale-[1.03] transition-all duration-150 cursor-pointer font-sans"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Add</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
