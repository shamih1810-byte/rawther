import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Sparkles, AlertCircle, RefreshCw, X, Utensils, ChefHat, Shield } from 'lucide-react';
import Navbar from '../components/Navbar';
import CategoryBar from '../components/CategoryBar';
import ItemCard from '../components/ItemCard';
import FloatingCartBar from '../components/FloatingCartBar';
import CartDrawer from '../components/CartDrawer';
import OrderTrackerModal from '../components/OrderTrackerModal';
import ManualTableModal from '../components/ManualTableModal';
import TopDishesSlider from '../components/TopDishesSlider';
import ScrollEnhancements from '../components/ScrollEnhancements';
import { fetchMenu, placeOrderApi } from '../api';
import { RESTAURANT_CONFIG } from '../config';

export default function CustomerMenu() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Scroll position for subtle parallax and entrance depth
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Read table and token from query params
  const tableParam = searchParams.get('table');
  const tokenParam = searchParams.get('token');

  const [tableNumber, setTableNumber] = useState(tableParam ? parseInt(tableParam, 10) : null);
  const [tableToken, setTableToken] = useState(tokenParam || '');

  // Menu & Category State
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuError, setMenuError] = useState(null);
  const [activeCategoryId, setActiveCategoryId] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [dietFilter, setDietFilter] = useState('ALL'); // ALL, VEG, NON_VEG

  // Cart State (stored in session so reloading preserves table cart)
  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = sessionStorage.getItem('biriyani_cart');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderNote, setOrderNote] = useState('');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState(null);

  // Placed Order Tracking State
  const [placedOrder, setPlacedOrder] = useState(null);
  const [isTrackerOpen, setIsTrackerOpen] = useState(false);

  // Manual Table modal
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);

  // Save cart changes
  useEffect(() => {
    try {
      sessionStorage.setItem('biriyani_cart', JSON.stringify(cartItems));
    } catch (e) {}
  }, [cartItems]);

  // Sync params if they change in URL
  useEffect(() => {
    if (tableParam) setTableNumber(parseInt(tableParam, 10));
    if (tokenParam) setTableToken(tokenParam);
  }, [tableParam, tokenParam]);

  // Load Menu from backend
  const loadMenu = async (silent = false) => {
    if (!silent) setLoading(true);
    if (!silent) setMenuError(null);
    try {
      const data = await fetchMenu(false);
      setCategories(data);
      setActiveCategoryId(prev => prev || (data && data.length > 0 ? data[0].id : null));
    } catch (err) {
      if (!silent) setMenuError(err.message || 'Unable to connect to the restaurant kitchen server. Please check your internet connection.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Real-time Live Menu Sync across all devices (WebSockets + BroadcastChannel + Tab Focus + Polling)
  useEffect(() => {
    loadMenu();

    // 1. WebSocket Live Stream from backend
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
              // Silently refresh menu in place so items, prices, and sold-out states update live
              loadMenu(true);
            }
          } catch (e) {}
        };

        socket.onclose = () => {
          reconnectTimeout = setTimeout(connectMenuSocket, 5000);
        };
        socket.onerror = () => {
          try { socket.close(); } catch (e) {}
        };
      } catch (e) {
        reconnectTimeout = setTimeout(connectMenuSocket, 5000);
      }
    };

    connectMenuSocket();

    // 2. BroadcastChannel for instant sync across tabs on same device/browser
    let bc = null;
    try {
      bc = new BroadcastChannel('rawther_menu_sync');
      bc.onmessage = () => {
        loadMenu(true);
      };
    } catch (e) {}

    // 3. Storage event listener (syncs across windows when local storage changes)
    const handleStorageChange = (e) => {
      if (e.key === 'rawther_custom_menu' || e.key === 'rawther_menu_version') {
        loadMenu(true);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // 4. Tab / phone unlock visibility listener
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadMenu(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 5. Periodic 15s heartbeat poll for maximum network reliability
    const interval = setInterval(() => {
      loadMenu(true);
    }, 15000);

    return () => {
      if (socket) socket.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, []);

  // Scroll reveal observer for menu items
  useEffect(() => {
    if (loading || categories.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.05, rootMargin: '0px 0px -20px 0px' }
    );

    const timer = setTimeout(() => {
      const items = document.querySelectorAll('.reveal-item');
      items.forEach((item) => observer.observe(item));
    }, 60);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [categories, searchQuery, dietFilter, loading]);

  // Scroll Spy for sticky category bar
  useEffect(() => {
    if (categories.length === 0) return;

    const handleScroll = () => {
      const scrollPos = window.scrollY + 160; // offset for sticky headers (Navbar + CategoryBar)
      for (const cat of categories) {
        const el = document.getElementById(`category-${cat.id}`);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPos >= top && scrollPos < top + height) {
            setActiveCategoryId(cat.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [categories]);

  const handleSelectCategory = (catId) => {
    setActiveCategoryId(catId);
    const cat = categories.find(c => c.id === catId);
    if (cat) {
      window.dispatchEvent(new CustomEvent('menu-category-change', {
        detail: { id: cat.id, name: cat.name }
      }));
    }
    const el = document.getElementById(`category-${catId}`);
    if (el) {
      // Clearance: Navbar (65px) + CategoryBar (55px) + 25px breathing space = 145px
      const yOffset = -145;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  // Sync active category change with full-web background animatic crossfader
  useEffect(() => {
    if (!activeCategoryId || categories.length === 0) return;
    const cat = categories.find(c => c.id === activeCategoryId);
    if (cat) {
      window.dispatchEvent(new CustomEvent('menu-category-change', {
        detail: { id: cat.id, name: cat.name }
      }));
    }
  }, [activeCategoryId, categories]);

  // Cart operations
  const handleAddToCart = (newItem) => {
    setCartItems(prev => {
      const index = prev.findIndex(ci =>
        ci.item_id === newItem.item_id && ci.variant_id === newItem.variant_id
      );
      if (index >= 0) {
        const updated = [...prev];
        updated[index].quantity += 1;
        return updated;
      }
      return [...prev, { ...newItem, quantity: 1 }];
    });
  };

  const handleUpdateCartQty = (itemId, variantId, newQty) => {
    setCartItems(prev => {
      if (newQty <= 0) {
        return prev.filter(ci => !(ci.item_id === itemId && ci.variant_id === variantId));
      }
      return prev.map(ci => {
        if (ci.item_id === itemId && ci.variant_id === variantId) {
          return { ...ci, quantity: newQty };
        }
        return ci;
      });
    });
  };

  const handleRemoveCartItem = (itemId, variantId) => {
    setCartItems(prev => prev.filter(ci => !(ci.item_id === itemId && ci.variant_id === variantId)));
  };

  const handleUpdateItemNote = (itemId, variantId, note) => {
    setCartItems(prev => prev.map(ci => {
      if (ci.item_id === itemId && ci.variant_id === variantId) {
        return { ...ci, note };
      }
      return ci;
    }));
  };

  // Placing Order
  const handlePlaceOrder = async () => {
    if (!tableNumber || !tableToken) {
      setIsTableModalOpen(true);
      return;
    }

    if (cartItems.length === 0) return;

    setIsPlacingOrder(true);
    setOrderError(null);

    const payload = {
      table_number: tableNumber,
      table_token: tableToken,
      note: orderNote.trim() || null,
      items: cartItems.map(ci => ({
        menu_item_id: ci.item_id,
        variant_id: ci.variant_id,
        quantity: ci.quantity,
        note: ci.note ? ci.note.trim() : null
      }))
    };

    try {
      const orderResult = await placeOrderApi(payload);
      setPlacedOrder(orderResult);
      // Clear cart
      setCartItems([]);
      sessionStorage.removeItem('biriyani_cart');
      setOrderNote('');
      setIsCartOpen(false);
      setIsTrackerOpen(true);
    } catch (err) {
      console.error("Order submission failed:", err);
      setOrderError(err.message || "Failed to transmit order to kitchen. Please check table token or retry.");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // Filter items based on search and diet filter
  const filteredCategories = useMemo(() => {
    if (!categories) return [];

    return categories.map(cat => {
      const items = cat.items.filter(item => {
        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = item.name.toLowerCase().includes(q);
          const matchDesc = item.description?.toLowerCase().includes(q);
          if (!matchName && !matchDesc) return false;
        }

        // Dietary filter
        if (dietFilter === 'VEG' && !item.is_veg) return false;
        if (dietFilter === 'NON_VEG' && item.is_veg) return false;

        return true;
      });

      return {
        ...cat,
        items
      };
    }).filter(cat => cat.items.length > 0);
  }, [categories, searchQuery, dietFilter]);

  return (
    <div className="min-h-screen bg-transparent text-cream pb-24">
      {/* 0. Golden Laser Scroll Progress Bar & Quick Return Orb */}
      <ScrollEnhancements />

      {/* 1. Header Navbar */}
      <Navbar
        tableNumber={tableNumber}
        hasToken={Boolean(tableToken)}
        onOpenTableModal={() => setIsTableModalOpen(true)}
      />

      {/* Search Bar & Dietary Filter Container (Frosted Glassmorphism) */}
      <div
        className="bg-[#231811]/60 backdrop-blur-md px-4 pt-3 pb-3 border-b border-gold/15 transition-transform duration-75 ease-out"
        style={{
          transform: scrollY > 0 && scrollY < 350 ? `translateY(${scrollY * 0.05}px)` : undefined,
        }}
      >
        {/* Search Bar & Dietary Filter */}
        <div className="max-w-7xl mx-auto space-y-2.5 px-4 sm:px-6 lg:px-8">
          {/* Quick Table Indicator if no table selected */}
          {!tableNumber && (
            <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-gold/15 backdrop-blur-sm border border-gold/35 text-gold-light text-xs shadow-md">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-gold shrink-0" />
                <span>Select your table number to place orders directly.</span>
              </div>
              <button
                onClick={() => setIsTableModalOpen(true)}
                className="px-3 py-1 rounded-lg bg-gold/25 hover:bg-gold/40 border border-gold/60 font-bold text-cream shrink-0 active:scale-95 transition-all cursor-pointer shadow-sm"
              >
                Select Table
              </button>
            </div>
          )}
          {/* Search box */}
          <div className="relative">
            <Search className="w-4 h-4 text-gold absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chicken biriyani, naan, tandoori..."
              className="w-full bg-[#19110B]/70 backdrop-blur-md border border-gold/30 rounded-xl pl-10 pr-9 py-2.5 text-xs sm:text-sm text-cream placeholder-cream-dim focus:outline-none focus:border-gold transition-colors shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-cream-muted hover:text-cream cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Dietary Filters */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            <button
              onClick={() => setDietFilter('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border active:scale-95 duration-150 cursor-pointer ${
                dietFilter === 'ALL'
                  ? 'bg-gold/30 text-gold border-gold/70 shadow-gold-glow scale-[1.03]'
                  : 'bg-[#302016]/70 backdrop-blur-sm text-cream-muted border-gold/20 hover:border-gold/40 hover:text-cream'
              }`}
            >
              All Items
            </button>
            <button
              onClick={() => setDietFilter('NON_VEG')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 active:scale-95 duration-150 cursor-pointer ${
                dietFilter === 'NON_VEG'
                  ? 'bg-rose-950/80 text-rose-300 border-rose-500/60 shadow-sm scale-[1.03]'
                  : 'bg-[#302016]/70 backdrop-blur-sm text-cream-muted border-gold/20 hover:border-gold/40 hover:text-cream'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              Non-Veg
            </button>
            <button
              onClick={() => setDietFilter('VEG')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 active:scale-95 duration-150 cursor-pointer ${
                dietFilter === 'VEG'
                  ? 'bg-[#87A96B]/25 text-[#87A96B] border-[#87A96B]/60 shadow-[0_0_12px_rgba(135,169,107,0.35)] scale-[1.03]'
                  : 'bg-[#302016]/70 backdrop-blur-sm text-cream-muted border-gold/20 hover:border-gold/40 hover:text-cream'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#87A96B]"></span>
              Pure Veg
            </button>
          </div>
        </div>
      </div>

      {/* Entrance Animated Slider with Top Dishes */}
      {!searchQuery && (
        <TopDishesSlider
          categories={categories}
          onAddToCart={handleAddToCart}
          cartItems={cartItems}
        />
      )}

      {/* 2. Sticky Category Bar */}
      <CategoryBar
        categories={categories}
        activeCategoryId={activeCategoryId}
        onSelectCategory={handleSelectCategory}
      />

      {/* 3. Main Menu Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="w-10 h-10 border-3 border-gold border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-semibold text-gold">Loading royal menu...</p>
          </div>
        ) : menuError ? (
          <div className="bg-bg-card border border-rose-500/40 rounded-2xl p-6 text-center max-w-md mx-auto my-12 shadow-premium">
            <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
            <h3 className="font-serif font-bold text-base text-cream">Unable to Load Menu</h3>
            <p className="text-xs text-cream-muted mt-1 leading-relaxed">{menuError}</p>
            <button
              onClick={loadMenu}
              className="mt-4 px-4 py-2 bg-gold text-bg-card font-bold text-xs uppercase rounded-xl flex items-center gap-2 mx-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="text-center py-16">
            <Utensils className="w-12 h-12 text-gold/30 mx-auto mb-3" />
            <h3 className="font-serif font-bold text-base text-cream">No items found</h3>
            <p className="text-xs text-cream-muted mt-1">Try adjusting your search or dietary filter</p>
            <button
              onClick={() => { setSearchQuery(''); setDietFilter('ALL'); }}
              className="mt-3 text-xs text-gold font-bold underline cursor-pointer"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="space-y-10">
            {filteredCategories.map((cat) => (
              <section
                key={cat.id}
                id={`category-${cat.id}`}
                className="scroll-mt-44"
              >
                {/* Category Header with royal gold badge and divider */}
                <div className="flex items-center gap-3.5 mb-5 pt-3 group">
                  <div className="flex items-center gap-2.5">
                    <div className="w-1.5 h-6 rounded-full bg-gradient-to-b from-gold to-[#87A96B] shadow-gold-glow"></div>
                    <h2 className="font-serif font-black text-xl sm:text-2xl text-cream-light tracking-wide group-hover:text-gold transition-colors drop-shadow-sm">
                      {cat.name}
                    </h2>
                  </div>
                  <div className="flex-1 h-[1px] bg-gradient-to-r from-gold/50 via-gold/20 to-transparent"></div>
                  <span className="text-xs text-gold font-semibold bg-[#231811]/90 px-3 py-1 rounded-full border border-gold/30 shadow-inner">
                    {cat.items.length} {cat.items.length === 1 ? 'dish' : 'dishes'}
                  </span>
                </div>

                {/* Items Grid with Responsive 3 Columns on Desktop */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 lg:gap-4.5">
                  {cat.items.map((item, idx) => (
                    <div
                      key={item.id}
                      className="reveal-item"
                      style={{
                        transitionDelay: `${(idx % 6) * 50}ms`
                      }}
                    >
                      <ItemCard
                        item={item}
                        cartItems={cartItems}
                        onAddToCart={handleAddToCart}
                        onUpdateCartQty={handleUpdateCartQty}
                      />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {/* Brand Footer & Separate Portal Links */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16 text-center border-t border-gold/15 mt-12">
        <div className="flex flex-col items-center justify-center space-y-3">
          <img
            src={RESTAURANT_CONFIG.logoUrl || "/rawther_logo.jpg"}
            alt={RESTAURANT_CONFIG.restaurantName}
            className="w-12 h-12 rounded-full object-cover border border-gold/40 shadow-sm"
          />
          <h4 className="font-serif font-bold text-base text-gold">
            {RESTAURANT_CONFIG.restaurantName}
          </h4>
          <p className="text-xs text-cream-muted max-w-sm">
            {RESTAURANT_CONFIG.tagline}
          </p>

          {/* Dedicated Staff & Admin Separate Portals */}
          <div className="flex items-center justify-center gap-4 pt-4 text-xs font-semibold">
            <Link
              to="/login?portal=kitchen&redirect=/kitchen"
              className="px-3.5 py-1.5 rounded-xl bg-bg-card border border-gold/20 text-cream-muted hover:text-[#87A96B] hover:border-[#87A96B]/40 transition-all flex items-center gap-1.5 active:scale-95 duration-150"
            >
              <ChefHat className="w-3.5 h-3.5 text-[#87A96B]" />
              <span>Kitchen Display</span>
            </Link>

            <span className="text-gold/30">•</span>

            <Link
              to="/login?portal=admin&redirect=/admin"
              className="px-3.5 py-1.5 rounded-xl bg-bg-card border border-gold/20 text-cream-muted hover:text-gold hover:border-gold/40 transition-all flex items-center gap-1.5 active:scale-95 duration-150"
            >
              <Shield className="w-3.5 h-3.5 text-gold" />
              <span>Admin Portal</span>
            </Link>
          </div>

          <p className="text-[11px] text-cream-dim pt-3">
            © {new Date().getFullYear()} {RESTAURANT_CONFIG.restaurantName}. All rights reserved.
          </p>
        </div>
      </footer>

      {/* 4. Floating Cart Summary Bar */}
      <FloatingCartBar
        cartItems={cartItems}
        onOpenCart={() => setIsCartOpen(true)}
      />

      {/* 5. Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        tableNumber={tableNumber}
        tableToken={tableToken}
        onUpdateQty={handleUpdateCartQty}
        onRemoveItem={handleRemoveCartItem}
        onUpdateItemNote={handleUpdateItemNote}
        orderNote={orderNote}
        setOrderNote={setOrderNote}
        onPlaceOrder={handlePlaceOrder}
        isPlacingOrder={isPlacingOrder}
        orderError={orderError}
        onOpenTableModal={() => {
          setIsCartOpen(false);
          setIsTableModalOpen(true);
        }}
      />

      {/* 6. Live Order Tracking Modal */}
      <OrderTrackerModal
        order={placedOrder}
        isOpen={isTrackerOpen}
        onClose={() => setIsTrackerOpen(false)}
        onOrderMore={() => {
          setIsTrackerOpen(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* 7. Manual Table Number / Token Modal */}
      <ManualTableModal
        isOpen={isTableModalOpen}
        onClose={() => setIsTableModalOpen(false)}
        initialTable={tableNumber ? String(tableNumber) : ''}
        initialToken={tableToken || ''}
        onTableSet={(num, token) => {
          setTableNumber(num);
          setTableToken(token);
          // Also reflect in URL parameters seamlessly
          const params = new URLSearchParams(searchParams);
          params.set('table', String(num));
          if (token) params.set('token', token);
          setSearchParams(params);
        }}
      />
    </div>
  );
}
