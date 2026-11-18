import { useEffect, useState } from 'react';

export type Room = {
  id: string;
  name: string;
  members: number;
  capacity?: number;
};

// Placeholder data until the real Discord radar is wired up.
export const previewRooms: Room[] = [
  { id: 'lounge', name: 'Лаунж', members: 12, capacity: 25 },
  { id: 'music', name: 'Музыка', members: 8, capacity: 20 },
  { id: 'night', name: 'Ночной чат', members: 21, capacity: 30 },
];

export function useRooms(): Room[] {
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

  return rooms;
}
