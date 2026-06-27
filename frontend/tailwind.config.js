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
          bg: 'var(--theme-bg)',
          'bg-dark': 'var(--theme-bg)',
          surface: 'var(--theme-surface)',
          'surface-dark': 'var(--theme-surface)',
          text: 'var(--theme-text)',
          'text-dark': 'var(--theme-text)',
          border: 'var(--theme-border)',
          'border-dark': 'var(--theme-border)',
          accent: 'var(--theme-accent)',
          'accent-dark': 'var(--theme-accent)',
          muted: 'var(--theme-muted)',
          'muted-dark': 'var(--theme-muted)',
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
