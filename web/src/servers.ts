import { useEffect, useState } from 'react';

export type Member = {
  id: string;
  name: string;
  /** Placeholder avatar colour until real Discord avatars come from the bot. */
  hue: number;
  avatarUrl?: string;
  muted?: boolean;
  deafened?: boolean;
  /** Shows the green "speaking" ring from time to time. */
  talks?: boolean;
};

export type VoiceRoom = {
  id: string;
  name: string;
  emoji?: string;
  limit?: number;
  members: Member[];
};

export type Server = {
  id: string;
  name: string;
  hue: number;
  iconUrl?: string;
  /** All voice rooms on the server; the main page only shows `rooms[0]` (the first one is public). */
  roomCount: number;
  rooms: VoiceRoom[];
};

// Placeholder data until the bot is live. Then the main page shows the servers that are active right now.
export const previewServers: Server[] = [
  {
    id: 'xivivide',
    name: 'Xivivide',
    hue: 352,
    roomCount: 12,
    rooms: [
      {
        id: 'xivivide-1',
        name: '1',
        emoji: '🔴',
        limit: 20,
        members: [
          { id: 'x1', name: '! Сижу в войсе пока не пишу', hue: 20, talks: true },
          { id: 'x2', name: '#moonlight', hue: 300, muted: true },
          { id: 'x3', name: 'ᴍᴀʀʟᴏ ꜱᴛᴀʀᴋ', hue: 220, talks: true },
          { id: 'x4', name: 'Неповторимый вечер', hue: 160 },
          { id: 'x5', name: 'кефирчик', hue: 270, talks: true },
        ],
      },
    ],
  },
  {
    id: 'elysium',
    name: 'Elysium',
    hue: 42,
    roomCount: 8,
    rooms: [
      {
        id: 'elysium-1',
        name: 'room 1',
        emoji: '🌕',
        limit: 99,
        members: [
          { id: 'e1', name: '! В войсе, не пишу', hue: 330, talks: true },
          { id: 'e2', name: 'ʀᴏɴɪɴ ᴅᴜꜱᴋ', hue: 200, talks: true },
          { id: 'e3', name: 'Pixel 🦋', hue: 190, muted: true, deafened: true },
        ],
      },
    ],
  },
];

export function useServers(): Server[] {
  const [servers, setServers] = useState<Server[]>(previewServers);

  useEffect(() => {
    // During local Vite development use preview data.
    // In production the Go API (same origin) will serve the bot's live servers; until then this 404s and we keep the preview.
    if (import.meta.env.DEV) return;

    const controller = new AbortController();
    fetch('/api/servers', { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: { servers?: Server[] }) => {
        if (Array.isArray(data.servers) && data.servers.length) setServers(data.servers);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return servers;
}
