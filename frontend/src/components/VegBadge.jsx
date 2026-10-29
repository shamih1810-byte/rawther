import React from 'react';

/**
 * Standard Indian Veg/Non-Veg icon:
 * Square border with a filled circle inside.
 * Green for Vegetarian, Red/Maroon for Non-Vegetarian.
 */
export default function VegBadge({ isVeg, className = "" }) {
  if (isVeg) {
    return (
      <div 
        className={`w-4 h-4 border-[1.5px] border-[#87A96B] rounded-[3px] flex items-center justify-center p-[2px] bg-[#87A96B]/15 shrink-0 shadow-[0_0_8px_rgba(135,169,107,0.3)] ${className}`}
        title="Pure Vegetarian"
        aria-label="Pure Vegetarian"
      >
        <div className="w-2 h-2 rounded-full bg-[#87A96B]"></div>
      </div>
    );
  }

  return (
    <div 
      className={`w-4 h-4 border-[1.5px] border-rose-500 rounded-[3px] flex items-center justify-center p-[2px] bg-rose-950/40 shrink-0 ${className}`}
      title="Non-Vegetarian"
      aria-label="Non-Vegetarian"
    >
      <div className="w-2 h-2 rounded-full bg-rose-500"></div>
    </div>
  );
}
