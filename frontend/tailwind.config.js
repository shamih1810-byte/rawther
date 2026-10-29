/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          canvas: '#19110B', // deepest dark brown
          deep: '#231811',   // deep roast brown
          card: '#302016',   // warm dark brown card
          surface: '#5A3E2B', // user UI color #5A3E2B
          elevated: '#6B4C35', // elevated warm brown
        },
        brown: {
          deep: '#231811',
          card: '#302016',
          DEFAULT: '#5A3E2B', // user UI color #5A3E2B
          surface: '#5A3E2B',
          light: '#765239',
          border: 'rgba(90, 62, 43, 0.5)',
        },
        gold: {
          light: '#FFFFFF',
          DEFAULT: '#FFFFFF', // Replaced orange with white color
          hover: '#F3F4F6',
          dark: '#E5E7EB',
          subtle: 'rgba(255, 255, 255, 0.15)',
          border: 'rgba(255, 255, 255, 0.3)',
        },
        sage: {
          light: '#A4C38B',
          DEFAULT: '#87A96B', // user UI color #87A96B (asparagus / sage green)
          hover: '#95B879',
          dark: '#67894E',
          subtle: 'rgba(135, 169, 107, 0.18)',
          border: 'rgba(135, 169, 107, 0.35)',
        },
        cream: {
          light: '#FFFDF7',
          DEFAULT: '#F7F1E1', // warm cream
          muted: '#D4C7B5',
          dim: '#A89985',
        },
        veg: '#87A96B', // user UI color #87A96B
        nonveg: '#EF4444',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'gold-glow': '0 0 15px rgba(255, 255, 255, 0.35)',
        'gold-glow-lg': '0 0 25px rgba(255, 255, 255, 0.55)',
        'sage-glow': '0 0 15px rgba(135, 169, 107, 0.35)',
        'premium': '0 10px 30px -5px rgba(0, 0, 0, 0.65), 0 0 1px 1px rgba(255, 255, 255, 0.2)',
      },
      animation: {
        'pop': 'pop 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        pop: {
          '0%': { transform: 'scale(0.95)' },
          '50%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
