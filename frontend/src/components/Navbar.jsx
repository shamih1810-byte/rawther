import React, { useState, useEffect } from 'react';
import { Utensils, Shield, QrCode, AlertCircle, ChefHat } from 'lucide-react';
import { RESTAURANT_CONFIG } from '../config';
import { Link } from 'react-router-dom';

export default function Navbar({ tableNumber, hasToken, onOpenTableModal }) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 px-4 sm:px-6 lg:px-8 py-3 border-b ${
        isScrolled
          ? 'bg-[#231811]/98 backdrop-blur-2xl border-gold/35 shadow-[0_10px_25px_rgba(0,0,0,0.85)]'
          : 'bg-[#231811]/95 backdrop-blur-xl border-gold/25 shadow-lg'
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group text-left cursor-pointer active:scale-95 transition-transform duration-150">
          <img
            src={RESTAURANT_CONFIG.logoUrl || "/rawther_logo.jpg"}
            alt={RESTAURANT_CONFIG.restaurantName}
            className="w-10 h-10 rounded-full object-cover shadow-gold-glow shrink-0 border border-gold/50 group-hover:scale-105 transition-transform"
          />
          <div>
            <h1 className="font-serif font-bold text-lg md:text-xl text-gold tracking-wide leading-tight group-hover:text-gold-hover transition-colors">
              {RESTAURANT_CONFIG.restaurantName}
            </h1>
            <p className="text-[10px] text-cream-muted uppercase tracking-wider font-medium">
              Authentic Heritage Dum
            </p>
          </div>
        </Link>

        {/* Table Badge & Staff Links */}
        <div className="flex items-center gap-2">
          {tableNumber ? (
            <button
              onClick={onOpenTableModal}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide border transition-all active:scale-90 duration-150 cursor-pointer ${
                hasToken
                  ? 'bg-[#87A96B]/20 border-[#87A96B]/60 text-[#87A96B] shadow-sm'
                  : 'bg-white/15 border-white/40 text-white'
              }`}
              title="Click to view or switch table"
            >
              <span className={`w-2 h-2 rounded-full ${hasToken ? 'bg-[#87A96B] animate-pulse' : 'bg-white'}`}></span>
              <span>Table {tableNumber}</span>
              {!hasToken && <AlertCircle className="w-3.5 h-3.5 text-gold" />}
            </button>
          ) : (
            <button
              onClick={onOpenTableModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide bg-gold/20 border border-gold/45 text-gold hover:bg-gold/30 transition-all shadow-sm active:scale-90 duration-150 cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Enter Table</span>
            </button>
          )}

          {/* 1. Kitchen Portal Link */}
          <Link
            to="/login?portal=kitchen&redirect=/kitchen"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#302016]/80 border border-gold/25 text-cream-muted hover:text-gold hover:border-gold/50 transition-all active:scale-90 duration-150 text-xs font-semibold backdrop-blur-sm"
            title="Kitchen Staff Portal (Live Display)"
          >
            <ChefHat className="w-4 h-4 text-[#87A96B]" />
            <span className="hidden md:inline">Kitchen</span>
          </Link>

          {/* 2. Admin Portal Link */}
          <Link
            to="/login?portal=admin&redirect=/admin"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#302016]/80 border border-gold/25 text-cream-muted hover:text-gold hover:border-gold/50 transition-all active:scale-90 duration-150 text-xs font-semibold backdrop-blur-sm"
            title="Owner & Admin Management Portal"
          >
            <Shield className="w-4 h-4 text-gold" />
            <span className="hidden md:inline">Admin</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
