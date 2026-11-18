import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import './styles.css';

type Room = {
  id: string;
  name: string;
  members: number;
};

const previewRooms: Room[] = [
  { id: 'lounge', name: 'Лаунж', members: 12 },
  { id: 'music', name: 'Музыка', members: 8 },
  { id: 'night', name: 'Ночной чат', members: 21 },
];

function CrystalLens() {
  return (
    <svg viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="lens-face" x1="22" y1="15" x2="72" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F1FCFF" />
          <stop offset=".42" stopColor="#78DFFF" />
          <stop offset="1" stopColor="#3453F0" />
        </linearGradient>
        <linearGradient id="lens-handle" x1="65" y1="53" x2="90" y2="83" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8CE8FF" />
          <stop offset="1" stopColor="#3547C9" />
        </linearGradient>
      </defs>
      <path d="m49.5 10.2 21.7 12.5v25L49.5 60.3 27.8 47.7v-25L49.5 10.2Z" fill="url(#lens-face)" stroke="#C5F7FF" strokeWidth="1.4" />
      <path d="M49.5 10.2v50.1m21.7-37.6-43.4 25m0-25 43.4 25M37 17.4l25 43m0-43-25 43" stroke="#E9FDFF" strokeOpacity=".52" strokeWidth="1.15" />
      <path d="m65.5 54.5 10-5.7 14.3 24.8-10.5 6-13.8-25.1Z" fill="url(#lens-handle)" stroke="#C5F7FF" strokeWidth="1.4" />
      <path d="m75.5 48.8 3.8 30.8m-3.8-30.8 14.3 24.8m-24-19.1 13.5 8" stroke="#F0FFFF" strokeOpacity=".46" strokeWidth="1.05" />
    </svg>
  );
}

function RoomPanel({ rooms }: { rooms: Room[] }) {
  return (
    <motion.section
      className="room-panel"
      initial={{ opacity: 0, y: 22, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
      aria-label="Румы"
    >
      <div className="rooms">
        {rooms.map((room, index) => (
          <motion.div
            className="room"
            key={room.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.16 + index * 0.09, duration: 0.32 }}
          >
            <span className="room-signal" />
            <span className="room-name">{room.name}</span>
            <span className="room-members">{room.members}</span>
          </motion.div>
        ))}
      </div>
      <motion.button
        className="enter"
        type="button"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.48, duration: 0.25 }}
      >
        ВОЙТИ <span>→</span>
      </motion.button>
    </motion.section>
  );
}

export default function App() {
  const reduceMotion = useReducedMotion();
  const [ready, setReady] = useState(Boolean(reduceMotion));
  const [rooms, setRooms] = useState<Room[]>(previewRooms);

  useEffect(() => {
    // During local Vite development use safe preview data.
    // The Go API is requested only in the production build, where both run on one origin.
    if (import.meta.env.DEV) return;

    const controller = new AbortController();
    fetch('/api/rooms', { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: { rooms?: Room[] }) => {
        if (Array.isArray(data.rooms) && data.rooms.length) setRooms(data.rooms.slice(0, 3));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return (
    <main className={`app ${ready ? 'ready' : ''}`}>
      <div className="ambient" aria-hidden="true" />
      <motion.div
        className="lens"
        initial={reduceMotion ? { opacity: 1, x: -74, y: -245, scale: 0.55 } : { opacity: 0, x: -900, y: 180, scale: 1.25 }}
        animate={reduceMotion ? { opacity: 1, x: -74, y: -245, scale: 0.55 } : {
          opacity: [0, 1, 1, 1, 1, 1],
          x: [-900, -74, -270, 148, -74, -74],
          y: [180, -74, -180, 96, -74, -245],
          scale: [1.25, 1, 0.88, 0.95, 1, 0.55],
          rotate: [-18, 0, 10, -9, 2, 0],
        }}
        transition={reduceMotion ? { duration: 0 } : { duration: 3.45, times: [0, 0.22, 0.43, 0.66, 0.82, 1], ease: [0.42, 0, 0.2, 1] }}
        onAnimationComplete={() => setReady(true)}
      >
        <CrystalLens />
      </motion.div>
      <AnimatePresence>{ready && <RoomPanel rooms={rooms} />}</AnimatePresence>
    </main>
  );
}
