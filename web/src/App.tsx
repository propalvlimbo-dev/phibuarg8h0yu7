import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import RoomOrbit from './components/RoomOrbit';
import { useRooms } from './rooms';
import './styles.css';

const inviteUrl = import.meta.env.VITE_DISCORD_INVITE as string | undefined;

export default function App() {
  const reduceMotion = useReducedMotion();
  const [revealed, setRevealed] = useState(false);
  const [active, setActive] = useState(0);
  const rooms = useRooms();

  useEffect(() => {
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const total = rooms.reduce((sum, room) => sum + room.members, 0);
  const current = rooms[active];

  const enter = () => {
    if (inviteUrl) window.location.assign(inviteUrl);
  };

  return (
    <main className="app">
      <div className="backdrop" aria-hidden="true">
        <span className="light light-a" />
        <span className="light light-b" />
        <span className="light light-c" />
      </div>

      <div className="shell">
        <motion.section
          className="console glass"
          aria-label="GirlScan"
          initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.97, filter: 'blur(12px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          transition={{ type: 'spring', stiffness: 120, damping: 22, mass: 1 }}
        >
          <header className="console-bar">
            <span className="wordmark">GirlScan</span>
            <span className="live">
              <i />
              {total} в эфире
            </span>
          </header>

          <RoomOrbit rooms={rooms} active={active} onActiveChange={setActive} revealed={revealed} />

          <button className="enter" type="button" onClick={enter} aria-label={current ? `Войти в ${current.name}` : 'Войти'}>
            ВОЙТИ
          </button>
        </motion.section>
      </div>

      <p className="sr-only" aria-live="polite">
        {current ? `${current.name}: ${current.members} в эфире` : ''}
      </p>
    </main>
  );
}
