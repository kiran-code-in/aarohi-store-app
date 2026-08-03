/**
 * state.ts — Global app state: current date, helpers.
 */

export const AppState = (() => {
  let currentDate = todayKey();

  function todayKey(): string {
    const d = new Date();
    return formatDate(d);
  }

  function formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  function shiftDate(key: string, days: number): string {
    const [y, m, d] = key.split('-').map(Number);
    const dt = new Date(y, m - 1, d + days);
    return formatDate(dt);
  }

  function displayDate(key: string): string {
    const [y, m, d] = key.split('-');
    const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    return dt.toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    });
  }

  return {
    getDate: () => currentDate,
    getDisplayDate: () => displayDate(currentDate),
    isToday: () => currentDate >= todayKey(),
    prevDay: () => { currentDate = shiftDate(currentDate, -1); },
    nextDay: () => { currentDate = shiftDate(currentDate, 1); },
    goToday: () => { currentDate = todayKey(); },
    todayKey,
    formatDate,
    shiftDate,
  };
})();

/** Format a number as Indian Rupees */
export function formatCurrency(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
