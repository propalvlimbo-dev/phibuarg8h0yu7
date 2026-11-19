import { useMemo } from 'react';
import { countLadies } from './filters';
import type { Member, Server, VoiceRoom } from './servers';

/** A voice room on the board, flattened across all servers. */
export type BoardRoom = VoiceRoom & { server: Server; ladies: number; order: number };

// ---- Placeholder rooms until the bot reports every room of every server ----

function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

const LADY_NICKS = ['Аня', 'лиса', 'kira', 'ᴍɪʟᴀ', 'Соня 🌸', 'вишня', 'Marie', 'Ника', 'Alice', 'зефирка', 'Лера', 'Мира', 'Ева', 'ʟᴜɴᴀ', 'Катя', 'mint', 'Даша', 'кошка', 'Varya', 'Юля 🦋', 'malina', 'Полина', 'Sakura', 'Агата'];
const OTHER_NICKS = ['Артём', 'kai', 'Дима', 'ᴅᴀʀᴋ', 'Макс', 'nightowl', 'Влад', 'Сеня', 'Rex', 'Тимур', 'ghost', 'Олег', 'Егор', 'zen', 'Миша', 'ʀᴏɴɪɴ', 'Кирилл', 'Ден', 'wolf', 'Паша'];
const ROOM_NAMES = ['поболтать', 'чилл', 'ночь', 'игры', 'музыка', 'кино', 'тихая', 'лаунж', 'кофе', 'вечер', 'общение', 'знакомства', 'дуо', 'трио', 'релакс', 'уютная', 'afk', 'караоке', 'спим', 'talk'];
const EMOJIS = ['🔴', '🌙', '🎧', '☕', '🎮', '🎬', '💬', '🌸', '🖤', '✨', '🌕', '🍷'];
const LIMITS = [0, 2, 4, 5, 10, 15, 20, 25, 99];

function placeholderRooms(server: Server, count: number): VoiceRoom[] {
  const r = rng(server.id);
  const pick = <T,>(list: T[]) => list[Math.floor(r() * list.length)];
  const rooms: VoiceRoom[] = [];
  for (let i = rooms.length; i < count; i++) {
    const roll = r();
    // Some rooms with one person in them, most with a small group.
    const size = roll < 0.22 ? 1 : 2 + Math.floor(r() * r() * 9);
    const members: Member[] = Array.from({ length: size }, (_, j) => {
      const lady = r() < 0.32;
      return {
        id: `${server.id}-${i}-${j}`,
        name: pick(lady ? LADY_NICKS : OTHER_NICKS),
        hue: Math.floor(r() * 360),
        lady,
        muted: r() < 0.15,
        deafened: r() < 0.05,
      };
    });
    const limit = pick(LIMITS);
    rooms.push({
      id: `${server.id}-gen-${i}`,
      name: r() < 0.3 ? String(i + 2) : pick(ROOM_NAMES),
      emoji: r() < 0.7 ? pick(EMOJIS) : undefined,
      limit: limit ? Math.max(limit, size) : undefined,
      members,
    });
  }
  return rooms;
}

/** Dev only: `?rooms=3000` stretches the placeholder data to preview a huge board. */
function devRoomTarget(servers: Server[]) {
  if (!import.meta.env.DEV || typeof location === 'undefined') return 0;
  const n = Number(new URLSearchParams(location.search).get('rooms'));
  return Number.isFinite(n) && n > 0 ? Math.ceil(Math.min(n, 20000) / Math.max(1, servers.length)) : 0;
}

export function useBoardRooms(servers: Server[]): BoardRoom[] {
  return useMemo(() => {
    const perServer = devRoomTarget(servers);
    const out: BoardRoom[] = [];
    for (const server of servers) {
      const total = perServer || server.roomCount;
      const known = server.rooms.slice(0, total);
      const rooms = known.length >= total ? known : [...known, ...placeholderRooms(server, total - known.length)];
      for (const room of rooms) {
        if (!room.members.length) continue; // empty rooms aren't interesting on the board
        out.push({ ...room, server, ladies: countLadies(room), order: out.length });
      }
    }
    return out;
  }, [servers]);
}
