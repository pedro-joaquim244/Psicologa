import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const savedPositions = new Map();

function scrollImmediately(position) {
  const root = document.documentElement;
  const previous = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  window.scrollTo({ left: position.x, top: position.y, behavior: 'auto' });
  root.style.scrollBehavior = previous;
}

function scrollToHash(hash) {
  if (!hash) return false;
  let id;
  try {
    id = decodeURIComponent(hash.slice(1));
  } catch {
    return false;
  }
  const target = document.getElementById(id);
  if (!target) return false;
  const root = document.documentElement;
  const previous = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  target.scrollIntoView({ block: 'start', behavior: 'auto' });
  root.style.scrollBehavior = previous;
  return true;
}

export default function ScrollManager() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const currentKey = useRef(location.key);

  useLayoutEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = previousRestoration; };
  }, []);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (navigationType === 'POP' && savedPositions.has(location.key) && !location.hash) {
        const position = savedPositions.get(location.key);
        scrollImmediately(position);
      } else if (!scrollToHash(location.hash)) {
        scrollImmediately({ x: 0, y: 0 });
      }
      currentKey.current = location.key;
    });

    return () => {
      cancelAnimationFrame(frame);
      savedPositions.set(currentKey.current, { x: window.scrollX, y: window.scrollY });
    };
  }, [location.hash, location.key, location.pathname, navigationType]);

  return null;
}
