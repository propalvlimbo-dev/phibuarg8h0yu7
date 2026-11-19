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

/** Discord CDN server icon (animated icons have an `a_` hash; `animated=true` keeps them moving). */
const discordIcon = (guildId: string, hash: string, size = 128) =>
  `https://cdn.discordapp.com/icons/${guildId}/${hash}.webp?size=${size}&animated=true`;

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
    iconUrl: discordIcon('1239260433551200276', 'a_22dec9f014cefe6ec09b03fc315f5d25'),
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
    iconUrl: discordIcon('856646640329031721', 'a_70de26123bf3d4ce31b6748bbcd3414b'),
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
  {
    id: 'lounge',
    name: 'Lounge',
    hue: 250,
    iconUrl: discordIcon('254958490676625408', 'a_5a440bf390ab640719fd3729b10eb708'),
    roomCount: 15,
    rooms: [
      {
        id: 'lounge-1',
        name: 'чилл',
        emoji: '🎧',
        limit: 10,
        members: [
          { id: 'l1', name: 'ночной гость', hue: 210, talks: true },
          { id: 'l2', name: '! afk 5 мин', hue: 30, muted: true },
          { id: 'l3', name: 'ᴠᴇʟᴠᴇᴛ', hue: 280, talks: true },
          { id: 'l4', name: 'Сова 🦉', hue: 120 },
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
