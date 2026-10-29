/**
 * Central Configuration for Rawther Biriyani QR Ordering App
 * Easily modify restaurant branding, currency symbol, and theme settings.
 */

export const RESTAURANT_CONFIG = {
  restaurantName: "Rawther Biriyani",
  tagline: "Authentic Heritage Dum Biriyani & Charcoal Grills",
  logoUrl: "/rawther_logo.jpg",
  currencySymbol: "₹",
  rateLimitPerMinute: 3,
  
  // Theme Color Palette
  theme: {
    bgDeep: "#231811",   // Primary deep warm brown background
    bgCard: "#302016",   // Warm brown card surface
    brownSurface: "#5A3E2B", // Core warm brown (#5A3E2B)
    gold: "#FFFFFF",     // Crisp white accent (#FFFFFF)
    sageGreen: "#87A96B", // Fresh asparagus / sage green (#87A96B)
    cream: "#F7F1E1",    // Warm cream primary text
    muted: "#D4C7B5",    // Soft cream secondary text
    vegGreen: "#87A96B", // Fresh vegetarian marker (#87A96B)
    nonvegRed: "#EF4444" // Non-vegetarian marker
  },

  // Order status labels, indicators, and steps
  orderStatuses: [
    { key: "received", label: "Received", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
    { key: "accepted", label: "Accepted", color: "bg-white/20 text-white border-white/30" },
    { key: "preparing", label: "Preparing", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
    { key: "served", label: "Served", color: "bg-[#87A96B]/20 text-[#87A96B] border-[#87A96B]/35" },
    { key: "completed", label: "Completed", color: "bg-gray-500/20 text-gray-300 border-gray-500/30" },
    { key: "rejected", label: "Rejected", color: "bg-rose-500/20 text-rose-300 border-rose-500/30" },
  ],

  // Customer status progression steps
  customerTrackerSteps: ["received", "preparing", "served"]
};

// Play pleasant golden chime using Web Audio API (works without external audio assets)
export const playOrderNotificationSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    // Two-tone bell chime (A5: 880Hz -> C#6: 1108.73Hz)
    const playTone = (freq, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.3, startTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    playTone(784.0, now, 0.4);       // G5
    playTone(1046.5, now + 0.15, 0.6); // C6
    playTone(1318.5, now + 0.35, 0.8); // E6
  } catch (err) {
    console.warn("Audio playback not permitted or supported yet:", err);
  }
};
