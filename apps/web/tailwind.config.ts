import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
          800: '#6b21a8',
          900: '#581c87',
          950: '#3b0764',
          DEFAULT: '#a855f7'
        },
        gt: {
          bg: '#0f0f0f',
          surface: '#181818',
          elevated: '#212121',
          border: '#2a2a2a',
          'border-light': '#333333',
          hover: '#272727',
          active: '#303030',
          text: '#f1f1f1',
          'text-secondary': '#aaaaaa',
          'text-muted': '#717171'
        }
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '8px',
        md: '10px',
        lg: '12px',
        xl: '16px'
      },
      boxShadow: {
        subtle: '0 1px 3px rgba(0,0,0,0.3)',
        card: '0 1px 6px rgba(0,0,0,0.2)',
        'card-hover': '0 4px 16px rgba(0,0,0,0.3)',
        dropdown: '0 4px 16px rgba(0,0,0,0.5)',
        modal: '0 12px 40px rgba(0,0,0,0.6)',
        glow: 'none',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }]
      }
    }
  },
  plugins: []
} satisfies Config;
