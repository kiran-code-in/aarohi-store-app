/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,js}',
  ],
  safelist: [
    'hidden', 'block', 'open', 'active', 'added',
    'cust-row', 'product-row', 'history-card', 'subtype-head', 'cat-tab',
    'bg-white', 'rounded-card', 'shadow-card', 'cursor-pointer',
    'bg-slate-50', 'bg-emerald-50', 'text-emerald-600', 'text-emerald-700',
    'bg-red-50', 'text-red-700', 'text-muted', 'text-primary',
    'border-b', 'border-slate-100', 'border-slate-50', 'border-slate-200',
    'space-y-2', 'py-1', 'py-2', 'py-3', 'px-4', 'px-3', 'mx-3', 'ml-2',
    'flex', 'flex-1', 'items-center', 'justify-between', 'gap-2', 'gap-3',
    'text-body', 'text-caption', 'text-sm', 'text-xs', 'text-lg',
    'font-bold', 'font-semibold', 'font-extrabold',
    'text-slate-700', 'text-slate-600', 'w-12', 'w-16',
    'rounded-lg', 'overflow-hidden', 'mb-2', 'mt-1', 'pt-2',
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
