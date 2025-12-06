/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./popup.html', './popup.js'],
  theme: {
    extend: {
      colors: {
        arete: {
          bg: '#fafafa',
          surface: '#f5f5f5',
          border: '#e5e5e5',
          'border-hover': '#d4d4d4',
          text: '#171717',
          'text-secondary': '#525252',
          'text-tertiary': '#a3a3a3',
          accent: '#0d9488',
          'accent-light': '#ccfbf1',
        }
      },
      fontFamily: {
        serif: ['Instrument Serif', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
