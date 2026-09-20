/**
 * header.ts — App header: logo, title, date picker (calendar), day nav.
 */

import { AppState } from '@/lib/state';

export function renderHeader(): void {
  const el = document.getElementById('headerDate');
  if (el) el.textContent = AppState.getDisplayDate();

  const isToday = AppState.isToday();

  // Date-picker button shows the selected date ("Today" when it is today)
  const label = document.getElementById('datePickLabel');
  if (label) label.textContent = isToday ? 'Today' : shortDate(AppState.getDate());

  // Keep the native date input in sync + cap it at today (no future)
  const picker = document.getElementById('datePicker') as HTMLInputElement | null;
  if (picker) {
    picker.value = AppState.getDate();
    picker.max = AppState.todayKey();
  }

  const nextBtn = document.getElementById('nextDayBtn') as HTMLButtonElement | null;
  if (nextBtn) nextBtn.disabled = isToday;

  // "Jump to today" only shows when we're not already on today
  const todayBtn = document.getElementById('todayBtn') as HTMLButtonElement | null;
  if (todayBtn) todayBtn.style.display = isToday ? 'none' : '';
}

/** Short date like "Sat 20 Sep" for the picker button. */
function shortDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function initHeaderNav(onDateChange: () => void): void {
  document.getElementById('prevDayBtn')?.addEventListener('click', () => {
    AppState.prevDay();
    renderHeader();
    onDateChange();
  });

  document.getElementById('nextDayBtn')?.addEventListener('click', () => {
    if (AppState.isToday()) return;
    AppState.nextDay();
    renderHeader();
    onDateChange();
  });

  document.getElementById('todayBtn')?.addEventListener('click', () => {
    AppState.goToday();
    renderHeader();
    onDateChange();
  });

  // Calendar: jump to any chosen date (not beyond today)
  const picker = document.getElementById('datePicker') as HTMLInputElement | null;
  picker?.addEventListener('change', () => {
    const chosen = picker.value;
    if (!chosen) return;
    if (chosen > AppState.todayKey()) { AppState.goToday(); }
    else { AppState.setDate(chosen); }
    renderHeader();
    onDateChange();
  });
}
