import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SEARCH_FILTERS } from '../filters';
import type { SearchFilter } from '../filters';
import type { Server } from '../servers';
import { ServerIcon } from './ServerCard';

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

const Chevron = ({ left = false }: { left?: boolean }) => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" style={left ? { transform: 'scaleX(-1)' } : undefined}>
    <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Glass sheet for one server: pick what to search for. Rendered into <body> so page transforms don't affect it. */
export default function ServerModal({ server, onClose }: { server: Server; onClose: () => void }) {
  const [choice, setChoice] = useState<SearchFilter | null>(null);
  const titleId = useId();
  const dialog = useRef<HTMLDivElement | null>(null);
  const returnFocus = useRef<Element | null>(null);

  // Esc goes back one step, then closes. Page scroll is locked while open; focus returns to the server tile.
  useEffect(() => {
    returnFocus.current = document.activeElement;
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevOverflow;
      if (returnFocus.current instanceof HTMLElement) returnFocus.current.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (choice) setChoice(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choice, onClose]);

  useEffect(() => {
    dialog.current?.querySelector<HTMLElement>('.modal-option, .modal-back')?.focus({ preventScroll: true });
  }, [choice]);

  return createPortal(
    <motion.div
      className="modal-veil"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={dialog}
        className="glass modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, scale: 0.94, y: 18, filter: 'blur(10px)' }}
        animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, scale: 0.96, y: 10, filter: 'blur(6px)' }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      >
        <header className="modal-head">
          <ServerIcon server={server} className="srv-icon-md" />
          <div className="modal-head-text">
            <h2 id={titleId}>{server.name}</h2>
            <p>
              {server.roomCount} {plural(server.roomCount, 'комната', 'комнаты', 'комнат')}
            </p>
          </div>
          <button type="button" className="modal-close" aria-label="Закрыть" onClick={onClose}>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <AnimatePresence mode="wait" initial={false}>
          {choice ? (
            <motion.div
              key="choice"
              className="modal-body"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.28, ease: EASE }}
            >
              <button type="button" className="modal-back" onClick={() => setChoice(null)}>
                <Chevron left />
                {choice.label}
              </button>
              <div className="modal-empty">Список появится, когда подключим бота</div>
            </motion.div>
          ) : (
            <motion.div
              key="list"
              className="modal-body modal-options"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.28, ease: EASE }}
            >
              {SEARCH_FILTERS.map((f) => (
                <button key={f.id} type="button" className="modal-option" onClick={() => setChoice(f)}>
                  <span>{f.label}</span>
                  <Chevron />
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
