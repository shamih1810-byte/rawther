import React, { useState, useEffect } from 'react';
import { ArrowUp, Sparkles } from 'lucide-react';
import { playOrderNotificationSound } from '../config';

/**
 * ScrollEnhancements
 * Delivers special scroll-triggered visual animations:
 * 1. Luminous Golden Laser Scroll Progress Bar at the top of the viewport.
 * 2. Floating Golden Orb Scroll-To-Top button with radial progress circle indicator.
 */
export default function ScrollEnhancements() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const currentProgress = (window.scrollY / totalHeight) * 100;
        setScrollProgress(Math.min(100, Math.max(0, currentProgress)));
      }
      setIsVisible(window.scrollY > 280);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleScrollToTop = () => {
    playOrderNotificationSound();
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <>
      {/* 1. Golden Laser Scroll Progress Bar */}
      <div
        aria-hidden="true"
        className="fixed top-0 left-0 right-0 h-[3.5px] z-50 pointer-events-none overflow-visible no-print"
      >
        {/* Glow Track */}
        <div
          className="h-full bg-gradient-to-r from-[#87A96B] via-white to-white shadow-[0_0_12px_rgba(255,255,255,0.9),0_0_24px_rgba(135,169,107,0.6)] animate-laser-glow transition-all duration-75 ease-out relative"
          style={{ width: `${scrollProgress}%` }}
        >
          {/* Leading Sparkle Head */}
          {scrollProgress > 1 && (
            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_10px_#fff,0_0_20px_#ffffff] flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            </div>
          )}
        </div>
      </div>

      {/* 2. Floating Circular Scroll-To-Top Button with Progress Ring */}
      <div
        className={`fixed bottom-20 right-4 sm:right-6 z-30 transition-all duration-300 no-print ${
          isVisible
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-8 pointer-events-none'
        }`}
      >
        <button
          onClick={handleScrollToTop}
          aria-label="Scroll back to top"
          className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-bg-card/95 border-2 border-white/50 text-white hover:text-cream shadow-[0_8px_24px_rgba(0,0,0,0.6),0_0_18px_rgba(255,255,255,0.35)] flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 group backdrop-blur-md cursor-pointer"
        >
          {/* Radial SVG Progress Ring */}
          <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none p-0.5">
            <circle
              cx="50%"
              cy="50%"
              r="44%"
              fill="none"
              stroke="rgba(255, 255, 255, 0.2)"
              strokeWidth="2.5"
            />
            <circle
              cx="50%"
              cy="50%"
              r="44%"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2.5"
              strokeDasharray="100"
              strokeDashoffset={100 - scrollProgress}
              strokeLinecap="round"
              className="transition-all duration-75"
            />
          </svg>

          {/* Icon */}
          <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200 group-hover:-translate-y-0.5" />
        </button>
      </div>
    </>
  );
}
