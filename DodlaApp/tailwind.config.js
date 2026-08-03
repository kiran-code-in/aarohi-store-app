/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,js}',
  ],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#0F766E', light: '#14B8A6', dark: '#115E59' },
        surface: '#FFFFFF',
        muted: '#64748B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        title: '24px',
        section: '18px',
        body: '14px',
        caption: '12px',
      },
      borderRadius: {
        card: '16px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08)',
        nav: '0 -2px 10px rgba(0,0,0,0.05)',
      },
    },
  },
  plugins: [],
};
