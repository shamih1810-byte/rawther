import React, { useRef, useEffect } from 'react';

export default function CategoryBar({ categories, activeCategoryId, onSelectCategory }) {
  const containerRef = useRef(null);
  const activeTabRef = useRef(null);

  // Automatically scroll active chip into view inside horizontal category bar
  useEffect(() => {
    if (activeTabRef.current && containerRef.current) {
      const container = containerRef.current;
      const tab = activeTabRef.current;
      const scrollLeft = tab.offsetLeft - (container.offsetWidth / 2) + (tab.offsetWidth / 2);
      container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
    }
  }, [activeCategoryId]);

  if (!categories || categories.length === 0) return null;

  return (
    <div className="sticky top-[64px] z-30 bg-[#231811]/98 backdrop-blur-2xl border-b border-gold/30 py-2.5 px-4 sm:px-6 lg:px-8 shadow-[0_12px_28px_rgba(0,0,0,0.85)] relative">
      <div
        ref={containerRef}
        className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth"
      >
        {categories.map((cat) => {
          const isActive = activeCategoryId === cat.id;
          return (
            <button
              key={cat.id}
              ref={isActive ? activeTabRef : null}
              onClick={() => onSelectCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 border min-h-[36px] flex items-center cursor-pointer active:scale-90 ${
                isActive
                  ? 'bg-gradient-to-r from-white via-slate-100 to-white text-bg-deep font-extrabold border-white shadow-[0_0_18px_rgba(255,255,255,0.45)] scale-[1.04] ring-2 ring-white/50'
                  : 'bg-[#302016]/90 backdrop-blur-md text-cream-muted border-gold/25 hover:border-gold/50 hover:text-cream hover:bg-[#422C1F] hover:scale-[1.02] shadow-sm'
              }`}
            >
              {cat.name}
            </button>
          );
        })}
      </div>
      {/* Seamless bottom fade so scrolling items dissolve elegantly instead of harsh cut */}
      <div className="pointer-events-none absolute -bottom-5 inset-x-0 h-5 bg-gradient-to-b from-[#231811]/85 to-transparent"></div>
    </div>
  );
}
