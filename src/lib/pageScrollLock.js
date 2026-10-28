let locks = 0;
let saved = null;

export function lockPageScroll() {
  locks += 1;
  if (locks > 1) return;
  saved = { x: window.scrollX, y: window.scrollY };
  document.body.classList.add('modal-open');
  Object.assign(document.body.style, {
    position: 'fixed',
    top: `-${saved.y}px`,
    left: `-${saved.x}px`,
    right: '0',
    width: '100%',
  });
}

export function unlockPageScroll() {
  locks = Math.max(0, locks - 1);
  if (locks || !saved) return;
  const position = saved;
  saved = null;
  document.body.classList.remove('modal-open');
  document.body.style.removeProperty('position');
  document.body.style.removeProperty('top');
  document.body.style.removeProperty('left');
  document.body.style.removeProperty('right');
  document.body.style.removeProperty('width');
  const root = document.documentElement;
  const previous = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  window.scrollTo({ left: position.x, top: position.y, behavior: 'auto' });
  root.style.scrollBehavior = previous;
}
