import type { VoiceRoom } from './servers';

/**
 * Board filters in the cabinet. Add new ones here — the segmented control and its counters pick them up.
 * `test` runs against every room, so keep it cheap.
 */
export type RoomFilter = { id: string; label: string; short?: string; test: (room: VoiceRoom) => boolean };

const ladies = (room: VoiceRoom) => room.members.reduce((n, m) => n + (m.lady ? 1 : 0), 0);

export const ROOM_FILTERS: RoomFilter[] = [
  { id: 'all', label: 'Все комнаты', short: 'Все', test: () => true },
  { id: 'ladies', label: 'Дамы', test: (room) => ladies(room) > 0 },
  // A girl sitting in a room on her own.
  { id: 'lonely', label: 'Одинокие дамы', test: (room) => room.members.length === 1 && Boolean(room.members[0].lady) },
];

export { ladies as countLadies };
