/**
 * modal.ts — Simple modal open/close using .open class on .modal-bg.
 */

export function openModal(id: string): void {
  document.getElementById(id)?.classList.add('open');
}

export function closeModal(id: string): void {
  document.getElementById(id)?.classList.remove('open');
}

export function initModal(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('click', (e) => {
    if (e.target === el) closeModal(id);
  });
}
