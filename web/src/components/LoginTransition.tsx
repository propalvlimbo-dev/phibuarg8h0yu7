import { AnimatePresence, motion } from 'framer-motion';
import type { Transition } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import Logo3D from './Logo3D';

type Phase = 'enter' | 'loading' | 'leave';

type Props = {
  /** Where the button logo was when the user clicked. */
  from: DOMRect;
  /** Where to fly back to if the user cancels (the button logo's current rect). */
  getReturnRect: () => DOMRect | null;
  /** Called once the cancel animation has finished and the overlay can unmount. */
  onClosed: () => void;
};

const BIG = 112; // final logo width, px
type Bezier = [number, number, number, number];
const EASE_IN_OUT: Bezier = [0.65, 0, 0.35, 1];
const EASE_OUT: Bezier = [0.22, 1, 0.36, 1];
const ARC_IN: Bezier = [0.3, 0.6, 0.25, 1];
const ARC_OUT: Bezier = [0.5, 0, 0.75, 0.4];

/**
 * Login transition: the Discord logo leaves the button, flies to the middle of the screen
 * over a glass veil, grows and starts the loading spin. Esc or a click cancels and flies it back.
 * TODO(auth): when the OAuth redirect is wired, navigate to it from the 'loading' phase.
 */
export default function LoginTransition({ from, getReturnRect, onClosed }: Props) {
  const [phase, setPhase] = useState<Phase>('enter');
  const [center] = useState(() => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 - 28 }));

  const offsetTo = useCallback(
    (r: DOMRect) => ({ x: r.left + r.width / 2 - center.x, y: r.top + r.height / 2 - center.y, scale: r.width / BIG }),
    [center],
  );
  const [start] = useState(() => offsetTo(from));
  const [target, setTarget] = useState({ x: 0, y: 0, scale: 1 });

  const cancel = useCallback(() => {
    if (phase === 'leave') return;
    const back = getReturnRect();
    setTarget(back ? offsetTo(back) : start);
    setPhase('leave');
  }, [phase, getReturnRect, offsetTo, start]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancel]);

  const leaving = phase === 'leave';
  const flight: Transition = leaving
    ? { x: { duration: 0.85, ease: EASE_IN_OUT }, y: { duration: 0.85, ease: ARC_OUT }, scale: { duration: 0.85, ease: EASE_IN_OUT } }
    : // x and y on different curves = a soft arc instead of a straight line.
      { x: { duration: 1.05, ease: EASE_IN_OUT }, y: { duration: 1.05, ease: ARC_IN }, scale: { duration: 1.05, ease: EASE_IN_OUT } };

  return (
    <>
      <motion.div
        className="login-veil"
        data-no-drag
        initial={{ opacity: 0 }}
        animate={{ opacity: leaving ? 0 : 1 }}
        transition={{ duration: leaving ? 0.75 : 0.7, ease: EASE_OUT }}
        onClick={cancel}
      />

      <motion.div
        className="login-logo"
        style={{ left: center.x, top: center.y, marginLeft: -BIG / 2, marginTop: (-BIG * 0.8) / 2 }}
        initial={start}
        animate={target}
        transition={flight}
        onAnimationComplete={() => {
          if (phase === 'enter') setPhase('loading');
          else if (phase === 'leave') onClosed();
        }}
      >
        <Logo3D size={BIG} spin={phase === 'loading' ? 'loop' : 'none'} />
      </motion.div>

      <div className="login-loader" style={{ top: center.y + BIG * 0.4 + 44 }} role="status" aria-live="polite">
        <AnimatePresence>
          {phase === 'loading' && (
            <motion.div
              className="login-loader-inner"
              initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: 4, filter: 'blur(4px)', transition: { duration: 0.3 } }}
              transition={{ duration: 0.6, ease: EASE_OUT }}
            >
              <span className="login-bar">
                <i />
              </span>
              <span className="login-caption">Подключаемся к Discord</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
