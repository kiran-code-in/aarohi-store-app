/**
 * nav.ts — Bottom navigation (DaisyUI btm-nav).
 * Navigation is now handled directly in main.ts via data-page attributes.
 * This module is kept for type exports.
 */

export type PageId = 'home' | 'stock' | 'sales' | 'wholesale' | 'scan' | 'history' | 'prices';

export function initNav(_onNavigate: (page: PageId) => void): void {
  // Navigation now handled in main.ts directly
}

export function setActivePage(pageId: PageId): void {
  document.querySelectorAll<HTMLElement>('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll<HTMLElement>('.nav-btn').forEach(b => b.classList.remove('active'));
  const page = document.getElementById(`page-${pageId}`);
  if (page) page.classList.add('active');
  const navBtn = document.querySelector<HTMLElement>(`.nav-btn[data-page="${pageId}"]`);
  if (navBtn) navBtn.classList.add('active');
}
