/**
 * header.ts — App header with logo, title, date display, and date navigation.
 */

import { AppState } from '@/lib/state';

export function renderHeader(): void {
  const el = document.getElementById('headerDate');
  if (el) el.textContent = AppState.getDisplayDate();

  const nextBtn = document.getElementById('nextDayBtn') as HTMLButtonElement | null;
  if (nextBtn) nextBtn.disabled = AppState.isToday();
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
}
