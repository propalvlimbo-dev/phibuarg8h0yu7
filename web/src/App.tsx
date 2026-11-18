import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import RoomOrbit from './components/RoomOrbit';
import { useRooms } from './rooms';
import { createLensScene } from './scene/lensScene';
import './styles.css';

type Stage = 'intro' | 'reveal' | 'ready';

const ease = [0.16, 1, 0.3, 1] as const;
const inviteUrl = import.meta.env.VITE_DISCORD_INVITE as string | undefined;

/** Static line-art fallback when WebGL is unavailable. */
function LensGlyph() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx="26" cy="26" r="17" stroke="#bfe8ff" strokeWidth="1.5" />
      <circle cx="26" cy="26" r="13.5" stroke="#7cc8ff" strokeOpacity=".55" strokeWidth="1" />
      <path d="m38.5 38.5 15 15" stroke="#bfe8ff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<Stage>('intro');
  const [fallback, setFallback] = useState(false);
  const [active, setActive] = useState(0);
  const rooms = useRooms();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scene = createLensScene({
      canvas,
      getDock: () => markRef.current,
      reducedMotion,
      onDocking: () => setStage((s) => (s === 'intro' ? 'reveal' : s)),
      onDocked: () => setStage('ready'),
    });

    if (!scene) {
      setFallback(true);
      setStage('ready');
      return;
    }

    const skip = () => scene.skip();
    window.addEventListener('pointerdown', skip);
    window.addEventListener('keydown', skip);
    return () => {
      window.removeEventListener('pointerdown', skip);
      window.removeEventListener('keydown', skip);
      scene.dispose();
    };
  }, []);

  const revealed = stage !== 'intro';
  const total = rooms.reduce((sum, room) => sum + room.members, 0);
  const current = rooms[active];

  const enter = () => {
    if (inviteUrl) window.location.assign(inviteUrl);
  };

  return (
    <main className="app" data-stage={stage}>
      <canvas ref={canvasRef} className="scene" aria-hidden="true" />

      <div className="shell">
        <div ref={markRef} className="mark" aria-hidden="true">
          {fallback && <LensGlyph />}
        </div>

        <motion.section
          className="console"
          aria-label="GirlScan"
          aria-hidden={!revealed}
          initial={false}
          animate={revealed ? { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' } : { opacity: 0, y: 28, scale: 0.985, filter: 'blur(6px)' }}
          transition={{ duration: 0.9, ease, delay: revealed ? 0.25 : 0 }}
          style={{ pointerEvents: revealed ? 'auto' : 'none' }}
        >
          <div className="console-bar">
            <span className="wordmark">GirlScan</span>
            <span className="live mono">
              <i />
              {total} в эфире
            </span>
          </div>

          <RoomOrbit rooms={rooms} active={active} onActiveChange={setActive} revealed={revealed} />

          <button className="enter" type="button" onClick={enter} aria-label={current ? `Войти в ${current.name}` : 'Войти'}>
            <span>ВОЙТИ</span>
          </button>
        </motion.section>
      </div>

      <p className="sr-only" aria-live="polite">
        {current ? `${current.name}: ${current.members} в эфире` : ''}
      </p>
    </main>
  );
}
