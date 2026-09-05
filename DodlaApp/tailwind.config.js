/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,js}',
  ],
  safelist: [
    'hidden', 'block', 'open', 'active', 'added',
    'cust-row', 'product-row', 'history-card', 'subtype-head', 'cat-tab',
    'type-btn-active',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
