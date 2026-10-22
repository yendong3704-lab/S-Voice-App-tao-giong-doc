/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        studio: {
          navy: '#0f172a',
          royal: '#1e3a8a',
          porcelain: '#f8fafc',
          amber: '#d97706',
          sonic: '#6366f1',
        }
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        equalizer: {
          '0%, 100%': { transform: 'scaleY(0.25)' },
          '50%': { transform: 'scaleY(1)' },
        }
      },
      animation: {
        shimmer: 'shimmer 2s infinite linear',
        equalizer: 'equalizer 0.8s infinite ease-in-out',
      }
    },
  },
  plugins: [],
};
