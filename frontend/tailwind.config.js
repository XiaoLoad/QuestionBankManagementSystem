/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        notion: {
          bg: '#ffffff',
          'bg-dark': '#191919',
          surface: '#f7f6f3',
          'surface-dark': '#202020',
          text: '#37352f',
          'text-dark': '#e8e6e3',
          border: '#e5e3df',
          'border-dark': '#333333',
          accent: '#5645d4',
          'accent-dark': '#7c6ef0',
          muted: '#9b9a97',
          'muted-dark': '#6b6b6b',
        }
      },
      borderRadius: {
        'btn': '8px',
        'card': '12px',
        'badge': '6px',
      },
      fontFamily: {
        'inter': ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    }
  },
  plugins: [],
}
