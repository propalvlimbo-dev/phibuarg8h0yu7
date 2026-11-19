import { useSyncExternalStore } from 'react';
import type { MouseEvent } from 'react';

// Tiny history router: enough for "/" and "/cabinet/*" without an extra dependency.
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('popstate', listener);
  };
}

export function navigate(to: string, { replace = false } = {}) {
  if (to === location.pathname + location.search) return;
  history[replace ? 'replaceState' : 'pushState'](null, '', to);
  listeners.forEach((l) => l());
  window.scrollTo(0, 0);
}

export function usePath() {
  return useSyncExternalStore(subscribe, () => location.pathname);
}

/** onClick for <a href> that navigates without a page reload (keeps Cmd/Ctrl-click working). */
export function linkTo(to: string) {
  return (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  };
}
