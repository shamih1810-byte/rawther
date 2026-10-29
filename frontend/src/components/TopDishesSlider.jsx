import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Sparkles, Star, Crown, ArrowDown, Check } from 'lucide-react';
import VegBadge from './VegBadge';
import { RESTAURANT_CONFIG, playOrderNotificationSound } from '../config';

// Fallback curated top dishes in case categories are still loading
const CURATED_TOP_DISHES = [
  {
    name: "Chicken Biriyani",
    badge: "👑 Chef's Signature Dum",
    highlight: "Heritage Recipe",
    rating: "4.9",
    ordersCount: "500+ orders this week",
    description: "Fragrant seeraga samba rice slow-dum cooked with tender chicken cuts, royal saffron, and aromatic ground spices.",
    price: 160,
    image_url: "/images/dishes/chicken-biriyani.jpg",
    is_veg: false,
    category_id: 1,
  },
  {
    name: "Chicken Chukka Biriyani",
    badge: "🔥 Best Seller #1",
    highlight: "Spicy & Rich",
    rating: "4.9",
    ordersCount: "420+ orders this week",
    description: "Our signature dum biriyani crowned with dry-roasted peppery chicken chukka sautéed in cold-pressed oil and shallots.",
    price: 180,
    image_url: "/images/dishes/chicken-chukka-biriyani.jpg",
    is_veg: false,
    category_id: 1,
  },
  {
    name: "Butter Chicken",
    badge: "✨ Royal Muglai Special",
    highlight: "Velvety Gravy",
    rating: "4.8",
    ordersCount: "380+ orders this week",
    description: "Succulent charcoal-grilled tandoori chicken simmered in a luscious butter and sun-ripened tomato cream gravy.",
    price: 190,
    image_url: "/images/dishes/butter-chicken.jpg",
    is_veg: false,
    category_id: 2,
  },
  {
    name: "Chicken 65",
    badge: "⚡ Crispy Flame Starter",
    highlight: "Charcoal Favorite",
    rating: "4.9",
    ordersCount: "460+ orders this week",
    description: "Golden crispy fried boneless chicken bites tempered with fresh curry leaves, green chilies, and hand-pounded spices.",
    price: 140,
    image_url: "/images/dishes/chicken-65.jpg",
    is_veg: false,
    category_id: 3,
  },
  {
    name: "Paneer Butter Masala",
    badge: "🌿 Vegetarian Royalty",
    highlight: "Pure Cream Cottage Cheese",
    rating: "4.8",
    ordersCount: "310+ orders this week",
    description: "Tender cubes of malai paneer gently simmered in a creamy, velvety cardamom-infused cashew butter gravy.",
    price: 160,
    image_url: "/images/dishes/paneer-butter-masala.jpg",
    is_veg: true,
    category_id: 4,
  },
  {
    name: "Garlic Naan",
    badge: "🥖 Tandoor Hot Bread",
    highlight: "Clay Oven Fresh",
    rating: "4.9",
    ordersCount: "620+ orders this week",
    description: "Traditional clay-oven blistered flatbread glazed with melted ghee and aromatic roasted minced garlic.",
    price: 45,
    image_url: "/images/dishes/garlic-naan.jpg",
    is_veg: true,
    category_id: 5,
  }
];

export default function TopDishesSlider({ categories = [], onAddToCart, cartItems = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState('right');
  const [addedAnimationKey, setAddedAnimationKey] = useState(null);

  // Mouse Drag State
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartX = useRef(0);
  const hasDragged = useRef(false);

  // Touch state
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const timerRef = useRef(null);

  // Link curated dishes with actual backend database items when categories are available
  const topDishes = useMemo(() => {
    if (!categories || categories.length === 0) return CURATED_TOP_DISHES;

    return CURATED_TOP_DISHES.map(curated => {
      let matchedItem = null;
      let matchedCatId = curated.category_id;

      for (const cat of categories) {
        const found = cat.items.find(it =>
          it.name.toLowerCase().trim() === curated.name.toLowerCase().trim() ||
          it.name.toLowerCase().includes(curated.name.toLowerCase())
        );
        if (found) {
          matchedItem = found;
          matchedCatId = cat.id;
          break;
        }
      }

      if (matchedItem) {
        return {
          ...curated,
          id: matchedItem.id,
          category_id: matchedCatId,
          price: matchedItem.base_price || curated.price,
          is_available: matchedItem.is_available !== false,
          variants: matchedItem.variants || [],
          rawItem: matchedItem
        };
      }

      return curated;
    });
  }, [categories]);

  const activeDish = topDishes[currentIndex] || topDishes[0];

  const handleNext = () => {
    setDirection('right');
    setCurrentIndex(prev => (prev + 1) % topDishes.length);
  };

  const handlePrev = () => {
    setDirection('left');
    setCurrentIndex(prev => (prev - 1 + topDishes.length) % topDishes.length);
  };

  // Continuous auto-sliding: always slides every 4.5s unless active mouse dragging
  useEffect(() => {
    if (isDragging) return;

    timerRef.current = setInterval(() => {
      handleNext();
    }, 4500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, isDragging, topDishes.length]);

  // Mouse Drag Handlers
  const handleMouseDown = (e) => {
    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input')) return;
    setIsDragging(true);
    dragStartX.current = e.clientX;
    hasDragged.current = false;
    setDragOffset(0);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const diff = e.clientX - dragStartX.current;
    if (Math.abs(diff) > 6) {
      hasDragged.current = true;
    }
    setDragOffset(diff);
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragOffset < -45) {
      handleNext();
    } else if (dragOffset > 45) {
      handlePrev();
    }
    setDragOffset(0);
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      if (dragOffset < -45) {
        handleNext();
      } else if (dragOffset > 45) {
        handlePrev();
      }
      setDragOffset(0);
    }
  };

  // Touch swipe handling
  const handleTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
    if (touchStart) {
      const diff = e.targetTouches[0].clientX - touchStart;
      setDragOffset(diff * 0.7);
    }
  };

  const handleTouchEnd = () => {
    setDragOffset(0);
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const minSwipeDistance = 45;
    if (distance > minSwipeDistance) {
      handleNext();
    } else if (distance < -minSwipeDistance) {
      handlePrev();
    }
  };

  // Check how many of this dish is already in the cart
  const quantityInCart = useMemo(() => {
    if (!activeDish || !cartItems) return 0;
    const match = cartItems.find(ci =>
      (activeDish.id && ci.item_id === activeDish.id) ||
      ci.item_name?.toLowerCase() === activeDish.name?.toLowerCase()
    );
    return match ? match.quantity : 0;
  }, [activeDish, cartItems]);

  const handleAddDish = (e) => {
    e.stopPropagation();
    if (hasDragged.current) return;
    if (activeDish.is_available === false) return;

    playOrderNotificationSound();
    setAddedAnimationKey(Date.now());
    setTimeout(() => setAddedAnimationKey(null), 800);

    const targetItem = activeDish.rawItem || {
      id: activeDish.id || 9990 + currentIndex,
      name: activeDish.name,
      base_price: activeDish.price,
      is_veg: activeDish.is_veg,
      variants: activeDish.variants || []
    };

    onAddToCart({
      item_id: targetItem.id,
      item_name: targetItem.name,
      variant_id: targetItem.variants && targetItem.variants.length > 0 ? targetItem.variants[0].id : null,
      variant_label: targetItem.variants && targetItem.variants.length > 0 ? targetItem.variants[0].label : null,
      unit_price: targetItem.variants && targetItem.variants.length > 0 ? targetItem.variants[0].price : activeDish.price,
      is_priceless: false,
      is_veg: activeDish.is_veg,
      image_url: activeDish.image_url,
      note: ""
    });
  };

  const handleScrollToMenu = (categoryId, dishName) => {
    const el = document.getElementById(`category-${categoryId}`);
    if (el) {
      const yOffset = -120;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <div
      className="relative max-w-7xl mx-auto my-6 px-4 sm:px-6 lg:px-8 select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Ornate UAE Header Banner */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gold/20 border border-gold/40 flex items-center justify-center text-gold shadow-gold-glow shrink-0">
            <Crown className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-gold uppercase tracking-wider">
              <span>Chef's Royal Selection</span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-gold animate-pulse"></span>
              <span className="hidden sm:inline-block text-[10px] text-cream-muted lowercase font-normal">
                (drag with mouse or auto-slides)
              </span>
            </div>
            <h3 className="font-serif font-black text-lg sm:text-2xl text-cream tracking-tight">
              Most Celebrated Dishes
            </h3>
          </div>
        </div>

        {/* Slide Counter & Next/Prev Navigation */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-gold/90 bg-black/60 backdrop-blur-md border border-gold/30 px-2.5 py-1 rounded-lg">
            0{currentIndex + 1} <span className="opacity-40">/</span> 0{topDishes.length}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); handlePrev(); }}
              aria-label="Previous top dish"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-black/60 backdrop-blur-md border border-gold/35 hover:border-gold text-gold hover:text-cream flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-sm cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
              aria-label="Next top dish"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-black/60 backdrop-blur-md border border-gold/35 hover:border-gold text-gold hover:text-cream flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-sm cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Showcase Slide Card with Grab Drag Support (Frosted Dark Glass) */}
      <div
        className={`relative overflow-hidden rounded-3xl bg-[#231811]/90 border-2 border-gold/40 shadow-[0_16px_40px_-10px_rgba(0,0,0,0.85),0_0_30px_rgba(255,255,255,0.2)] backdrop-blur-xl p-4 sm:p-6 lg:p-8 transition-colors ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {/* Background Islamic Filigree watermark within card */}
        <div
          className="absolute inset-0 opacity-[0.035] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23FFFFFF' fill-opacity='1' fill-rule='evenodd'%3E%3Cpath d='M30 30L15 15l15-15 15 15-15 15zm0 0l-15 15 15 15 15-15-15-15zM0 30l15-15L0 0v30zm60 0L45 15l15-15v30zM0 60l15-15L0 30v30zm60 0L45 45l15-15v30z'/%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Ambient Radial Golden Flash */}
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-gold/15 blur-3xl pointer-events-none" />

        {/* Slide Content Container with live drag offset */}
        <div
          style={{
            transform: dragOffset !== 0 ? `translateX(${dragOffset}px)` : undefined,
            transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div
            key={currentIndex}
            className={`relative z-10 flex flex-col md:flex-row items-center gap-6 sm:gap-8 lg:gap-12 ${
              dragOffset === 0 ? (direction === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left') : ''
            }`}
          >
            {/* Left: Glorious Dish Photography with Ornate Golden Halo and Steam */}
            <div className="relative shrink-0 flex items-center justify-center pointer-events-none">
              {/* Rotating Ornate Golden Dashed Ring */}
              <div className="absolute inset-0 -m-3 sm:-m-4 md:-m-5 rounded-full border-2 border-dashed border-gold/45 animate-ring-rotate pointer-events-none" />
              <div className="absolute inset-0 -m-5 sm:-m-7 md:-m-8 rounded-full border border-gold/20 animate-ring-counter pointer-events-none" />

              {/* Rising Steam Wisps */}
              <div className="absolute -top-9 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-none z-20">
                <span className="w-1.5 h-6 rounded-full bg-cream/40 blur-[1px] animate-steam-1" />
                <span className="w-2 h-8 rounded-full bg-cream/50 blur-[1px] animate-steam-2" />
                <span className="w-1.5 h-6 rounded-full bg-cream/35 blur-[1px] animate-steam-1" style={{ animationDelay: '0.6s' }} />
              </div>

              {/* Dish Image Container */}
              <div className="relative w-36 h-36 sm:w-48 sm:h-48 md:w-56 md:h-56 lg:w-64 lg:h-64 rounded-full overflow-hidden border-3 border-gold shadow-[0_12px_28px_rgba(0,0,0,0.8),0_0_24px_rgba(213,133,31,0.4)] group">
                <img
                  src={activeDish.image_url}
                  alt={activeDish.name}
                  draggable="false"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 pointer-events-none"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-bg-card/70 via-transparent to-transparent pointer-events-none" />

                {/* Shimmer sweep effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none animate-shimmer-sweep" />
              </div>

              {/* Veg / Non-Veg Indicator Pin */}
              <div className="absolute bottom-1 right-2 sm:bottom-2 sm:right-3 bg-[#1C140E]/90 backdrop-blur-md border border-gold/40 p-1.5 rounded-xl shadow-md z-20">
                <VegBadge isVeg={activeDish.is_veg} />
              </div>
            </div>

            {/* Right: Dish Details, Aroma Notes, Pricing and Direct Action */}
            <div className="flex-1 min-w-0 text-center md:text-left flex flex-col justify-between py-1">
              <div>
                {/* Badge Pills */}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-2.5">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-gold/25 border border-gold/60 text-gold shadow-sm">
                    <Sparkles className="w-3.5 h-3.5 text-gold" />
                    <span>{activeDish.badge}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-white/10 border border-white/25 text-white">
                    <Star className="w-3.5 h-3.5 fill-white text-white" />
                    <span>{activeDish.rating}</span>
                    <span className="opacity-70">({activeDish.ordersCount})</span>
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#1C140E]/60 backdrop-blur-sm border border-gold/25 text-cream-muted">
                    {activeDish.highlight}
                  </span>
                </div>

                {/* Dish Name */}
                <h2 className="font-serif font-black text-2xl sm:text-3xl md:text-4xl text-cream tracking-tight mb-2">
                  {activeDish.name}
                </h2>

                {/* Description */}
                <p className="text-xs sm:text-sm md:text-base text-cream-muted leading-relaxed line-clamp-2 sm:line-clamp-3 mb-4 max-w-2xl">
                  {activeDish.description}
                </p>
              </div>

              {/* Bottom Row: Price + Order CTA + Scroll to category */}
              <div className="pt-3 border-t border-gold/15 flex flex-wrap items-center justify-between gap-4">
                {/* Price Tag */}
                <div className="flex items-baseline gap-1.5 mx-auto md:mx-0">
                  <span className="text-xs font-semibold text-gold uppercase tracking-wider">Price</span>
                  <span className="text-base font-bold text-gold">{RESTAURANT_CONFIG.currencySymbol}</span>
                  <span className="font-serif font-black text-2xl sm:text-3xl md:text-4xl text-gold drop-shadow-sm">
                    {activeDish.price}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-center md:justify-end gap-3 w-full sm:w-auto">
                  {/* Jump to Menu Section */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleScrollToMenu(activeDish.category_id, activeDish.name);
                    }}
                    className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-cream-muted hover:text-cream bg-[#1C140E]/80 backdrop-blur-md border border-gold/25 hover:border-gold/50 flex items-center gap-2 transition-all active:scale-95 cursor-pointer shadow-sm"
                    title="View this category in full menu below"
                  >
                    <ArrowDown className="w-4 h-4 text-gold" />
                    <span>View in Menu</span>
                  </button>

                  {/* Direct Add to Order Button */}
                  <button
                    onClick={handleAddDish}
                    className={`relative px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wider transition-all duration-200 flex items-center gap-2 shadow-gold-glow cursor-pointer active:scale-90 overflow-hidden ${
                      quantityInCart > 0
                        ? 'bg-gradient-to-r from-[#87A96B] to-[#67894E] text-white border border-[#87A96B]/50'
                        : 'bg-gradient-to-r from-white via-slate-100 to-white text-bg-deep hover:brightness-105 animate-gold-ring-pulse'
                    }`}
                  >
                    {/* Shimmer sweep inside button */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none animate-shimmer-sweep" />

                    {addedAnimationKey ? (
                      <>
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Added!</span>
                      </>
                    ) : quantityInCart > 0 ? (
                      <>
                        <Plus className="w-4 h-4 stroke-[3]" />
                        <span>Add More ({quantityInCart})</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 stroke-[3]" />
                        <span>Add to Order</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Timeline Indicator at bottom */}
        <div className="relative w-full h-1 bg-white/10 rounded-full mt-5 sm:mt-6 overflow-hidden">
          <div
            key={currentIndex}
            className="h-full bg-gradient-to-r from-[#87A96B] via-white to-slate-100 transition-all duration-300 w-full animate-[progress_4.5s_linear_infinite]"
          />
        </div>

        {/* Dot Pagination indicators */}
        <div className="flex items-center justify-center gap-2 mt-3.5">
          {topDishes.map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                setDirection(idx > currentIndex ? 'right' : 'left');
                setCurrentIndex(idx);
              }}
              aria-label={`Go to slide ${idx + 1}`}
              className={`h-1.5 sm:h-2 rounded-full transition-all duration-300 cursor-pointer ${
                idx === currentIndex
                  ? 'w-7 sm:w-8 bg-gold shadow-gold-glow'
                  : 'w-2 sm:w-2.5 bg-gold/25 hover:bg-gold/50'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
