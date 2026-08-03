/**
 * toast.ts — Simple bottom toast.
 */

let _timer: ReturnType<typeof setTimeout> | null = null;

export function showToast(message: string, duration = 1800): void {
  const el = document.getElementById('saveToast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  if (_timer) clearTimeout(_timer);
  _timer = setTimeout(() => el.classList.remove('show'), duration);
}
