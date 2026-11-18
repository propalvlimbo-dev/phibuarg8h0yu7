import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import DiscordButton from './components/DiscordButton';
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

  const appear = (delay: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 18, filter: 'blur(10px)' },
          animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
          transition: { type: 'spring' as const, stiffness: 110, damping: 22, delay },
        };

  return (
    <main className="app">
      <div className="backdrop" aria-hidden="true">
        <span className="light light-a" />
        <span className="light light-b" />
        <span className="light light-c" />
      </div>

      <motion.header className="corner" {...appear(0.05)}>
        <span className="wordmark">GirlScan</span>
        <span className="live">
          <i />
          {total} в эфире
        </span>
      </motion.header>

      <div className="shell">
        <motion.div className="stage-wrap" {...appear(0.1)}>
          <RoomOrbit rooms={rooms} active={active} onActiveChange={setActive} revealed={revealed} />
        </motion.div>

        <motion.div className="cta" {...appear(0.25)}>
          <DiscordButton label="Войти через Discord" ariaLabel={current ? `Войти в ${current.name} через Discord` : undefined} onClick={enter} />
        </motion.div>
      </div>

      <p className="sr-only" aria-live="polite">
        {current ? `${current.name}: ${current.members} в эфире` : ''}
      </p>
    </main>
  );
}
