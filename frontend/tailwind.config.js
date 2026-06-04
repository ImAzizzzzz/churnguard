export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
      },
      animation: {
        'fade-in':  'fadeIn 0.25s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'bounce-sm': 'bounce-sm 1s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'bounce-sm': {
          '0%,100%': { transform: 'translateY(-4px)' },
          '50%':     { transform: 'translateY(0)' },
        },
      },
      boxShadow: {
        'card':    '0 1px 3px 0 rgba(0,0,0,.07), 0 1px 2px -1px rgba(0,0,0,.07)',
        'card-md': '0 4px 12px 0 rgba(0,0,0,.08), 0 1px 3px -1px rgba(0,0,0,.06)',
        'modal':   '0 20px 60px -10px rgba(0,0,0,.25)',
        'glass':   '0 8px 32px 0 rgba(31,38,135,0.18)',
      },
    },
  },
  plugins: [],
}
