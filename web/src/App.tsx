import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import Background from './components/Background';
import DiscordButton from './components/DiscordButton';
import { LensGlyph } from './components/Logo';
import LoginTransition from './components/LoginTransition';
import RoomOrbit from './components/RoomOrbit';
import { useRooms } from './rooms';
import './styles.css';

export default function App() {
  const [revealed, setRevealed] = useState(false);
  const [active, setActive] = useState(0);
  const rooms = useRooms();

  useEffect(() => {
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const current = rooms[active];

  // Login: for now only the transition (logo → centre → loading). The Discord OAuth redirect comes later.
  const [loginFrom, setLoginFrom] = useState<DOMRect | null>(null);
  const buttonLogo = useRef<HTMLSpanElement | null>(null);

  const appear = (delay: number) => ({
    initial: { opacity: 0, y: 18, filter: 'blur(10px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { type: 'spring' as const, stiffness: 110, damping: 22, delay },
  });

  return (
    <main className="app">
      <div className="backdrop" aria-hidden="true">
        <span className="light light-a" />
        <span className="light light-b" />
        <span className="light light-c" />
      </div>
      <Background />

      <motion.header className="corner" {...appear(0.05)}>
        <span className="wordmark">
          <LensGlyph className="wordmark-mark" />
          GirlScan
        </span>
      </motion.header>

      <div className="shell">
        <motion.div className="stage-wrap" {...appear(0.1)}>
          <RoomOrbit rooms={rooms} active={active} onActiveChange={setActive} revealed={revealed} />
        </motion.div>

        <motion.div className="cta" {...appear(0.25)}>
          <DiscordButton
            label="Войти через Discord"
            ariaLabel={current ? `Войти в ${current.name} через Discord` : undefined}
            onClick={setLoginFrom}
            logoHidden={loginFrom !== null}
            logoRef={buttonLogo}
          />
        </motion.div>
      </div>

      {loginFrom && (
        <LoginTransition
          from={loginFrom}
          getReturnRect={() => buttonLogo.current?.getBoundingClientRect() ?? null}
          onClosed={() => setLoginFrom(null)}
        />
      )}

      <p className="sr-only" aria-live="polite">
        {current ? `${current.name}: ${current.members} в эфире` : ''}
      </p>
    </main>
  );
}
