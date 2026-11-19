import { motion } from 'framer-motion';
import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { logout, useMe } from '../api';
import type { Me } from '../api';
import { useBoardRooms } from '../board';
import type { BoardRoom } from '../board';
import { LensGlyph } from '../components/Logo';
import { ServerIcon } from '../components/ServerCard';
import { ROOM_FILTERS } from '../filters';
import { linkTo, navigate } from '../router';
import { useServers } from '../servers';
import type { Member, Server } from '../servers';

type Section = { path: string; label: string };

const SECTIONS: Section[] = [
  { path: '/cabinet', label: 'Комнаты' },
  { path: '/cabinet/subscription', label: 'Подписка' },
];

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
/** Rooms rendered per step; more are added as you scroll, so thousands of rooms stay smooth. */
const PAGE = 60;
/** Members shown per room card before "+N". */
const MAX_MEMBERS = 6;

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

const pad = (n: number) => String(n).padStart(2, '0');

function initial(name: string) {
  const ch = [...name].find((c) => /[\p{L}\p{N}]/u.test(c));
  return ch ? ch.toUpperCase() : '•';
}

/** Personal account: top bar + one section. No side panels. */
export default function Cabinet({ path }: { path: string }) {
  const { state, reload } = useMe();

  useEffect(() => {
    if (state.status === 'guest') navigate('/', { replace: true });
  }, [state.status]);

  const known = SECTIONS.some((s) => s.path === path);
  useEffect(() => {
    if (!known) navigate(SECTIONS[0].path, { replace: true });
  }, [known]);

  if (state.status === 'loading' || state.status === 'guest') {
    return <main className="cab cab-center" aria-busy="true" />;
  }
  if (state.status === 'error') {
    return (
      <main className="cab cab-center">
        <div className="glass cab-panel cab-error">
          <p>Не удалось загрузить профиль</p>
          <button type="button" className="cab-btn" onClick={() => void reload()}>
            Повторить
          </button>
        </div>
      </main>
    );
  }

  const { me, demo } = state;
  const section = SECTIONS.find((s) => s.path === path) ?? SECTIONS[0];

  const onLogout = async () => {
    if (!demo) await logout();
    navigate('/');
  };

  return (
    <main className="cab">
      <motion.header
        className="glass cab-top"
        initial={{ opacity: 0, y: -12, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <a href="/" className="wordmark cab-brand" onClick={linkTo('/')}>
          <LensGlyph className="wordmark-mark" />
          GirlScan
        </a>

        <nav className="cab-tabs" aria-label="Личный кабинет">
          {SECTIONS.map((s) => (
            <a
              key={s.path}
              href={s.path}
              className={s.path === section.path ? 'is-active' : ''}
              aria-current={s.path === section.path ? 'page' : undefined}
              onClick={linkTo(s.path)}
            >
              {s.label}
            </a>
          ))}
        </nav>

        <div className="cab-user">
          <Avatar me={me} className="cab-avatar" size={30} />
          <span className="cab-user-name">{me.user.displayName}</span>
          <button type="button" className="cab-logout" onClick={() => void onLogout()}>
            Выйти
          </button>
        </div>
      </motion.header>

      {demo && <p className="cab-demo">Демо-режим: API не запущен, показаны тестовые данные</p>}

      <motion.section
        key={section.path}
        className="cab-main"
        initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        {section.path === '/cabinet' && <Board subscribed={me.subscription.active} />}
        {section.path === '/cabinet/subscription' && <Subscription me={me} />}
      </motion.section>
    </main>
  );
}

/** Discord avatar with a letter fallback if the CDN image fails to load. */
function Avatar({ me, className, size }: { me: Me; className: string; size: number }) {
  const [failed, setFailed] = useState(false);
  if (failed || !me.user.avatarUrl) {
    return (
      <span className={`${className} cab-avatar-letter`} style={{ fontSize: size * 0.42 }} aria-hidden="true">
        {initial(me.user.displayName || me.user.username)}
      </span>
    );
  }
  return <img className={className} src={me.user.avatarUrl} alt="" width={size} height={size} onError={() => setFailed(true)} />;
}

// ---------------------------------------------------------------- Board

/** Filters live in the URL (?server=…&f=…&q=…) so a reload or a shared link keeps them. */
function readParams() {
  const p = new URLSearchParams(location.search);
  return { server: p.get('server') ?? '', filter: p.get('f') ?? 'all', query: p.get('q') ?? '' };
}

function useBoardParams() {
  const [params, setParams] = useState(readParams);
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const set = (key: string, value: string, fallback: string) => (value && value !== fallback ? p.set(key, value) : p.delete(key));
    set('server', params.server, '');
    set('f', params.filter, 'all');
    set('q', params.query.trim(), '');
    const qs = p.toString();
    const next = location.pathname + (qs ? `?${qs}` : '');
    if (next !== location.pathname + location.search) history.replaceState(null, '', next);
  }, [params]);
  return [params, setParams] as const;
}

const LockIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <rect x="5" y="10.5" width="14" height="10" rx="2.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const SearchIcon = () => (
  <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
    <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

function matches(room: BoardRoom, q: string) {
  if (!q) return true;
  if (room.name.toLowerCase().includes(q) || room.server.name.toLowerCase().includes(q)) return true;
  return room.members.some((m) => m.name.toLowerCase().includes(q));
}

function Board({ subscribed }: { subscribed: boolean }) {
  const servers = useServers();
  const rooms = useBoardRooms(servers);
  const [params, setParams] = useBoardParams();
  const query = useDeferredValue(params.query.trim().toLowerCase());

  const filter = ROOM_FILTERS.find((f) => f.id === params.filter) ?? ROOM_FILTERS[0];
  const serverId = servers.some((s) => s.id === params.server) ? params.server : '';

  // Rooms matching the search; counters for the server chips and filter tabs are derived from here.
  const searched = useMemo(() => rooms.filter((r) => matches(r, query)), [rooms, query]);

  const filterCounts = useMemo(() => {
    const pool = serverId ? searched.filter((r) => r.server.id === serverId) : searched;
    return Object.fromEntries(ROOM_FILTERS.map((f) => [f.id, pool.reduce((n, r) => n + (f.test(r) ? 1 : 0), 0)]));
  }, [searched, serverId]);

  const serverCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of searched) if (filter.test(r)) counts.set(r.server.id, (counts.get(r.server.id) ?? 0) + 1);
    return counts;
  }, [searched, filter]);

  const visible = useMemo(() => {
    const list = searched.filter((r) => (!serverId || r.server.id === serverId) && filter.test(r));
    // "Дамы": rooms with more girls first.
    if (filter.id === 'ladies') list.sort((a, b) => b.ladies - a.ladies || b.members.length - a.members.length || a.order - b.order);
    return list;
  }, [searched, serverId, filter]);

  const totalCount = useMemo(() => [...serverCounts.values()].reduce((a, b) => a + b, 0), [serverCounts]);

  // Incremental rendering.
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => setLimit(PAGE), [serverId, filter.id, query]);
  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || limit >= visible.length) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && setLimit((l) => l + PAGE), { rootMargin: '1200px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [limit, visible.length]);

  const update = (patch: Partial<typeof params>) => setParams((p) => ({ ...p, ...patch }));
  const people = useMemo(() => visible.reduce((n, r) => n + r.members.length, 0), [visible]);

  return (
    <div className={`board ${subscribed ? '' : 'is-locked'}`}>
      <div className="board-body" aria-hidden={!subscribed || undefined} inert={!subscribed}>
        <div className="board-tools">
          <div className="board-servers" role="toolbar" aria-label="Серверы">
            <ServerChip label="Все серверы" count={totalCount} active={!serverId} onClick={() => update({ server: '' })} />
            {servers.map((s) => (
              <ServerChip key={s.id} server={s} label={s.name} count={serverCounts.get(s.id) ?? 0} active={serverId === s.id} onClick={() => update({ server: serverId === s.id ? '' : s.id })} />
            ))}
          </div>

          <div className="board-row">
            <div className="board-filters" role="tablist" aria-label="Фильтр">
              {ROOM_FILTERS.map((f) => (
                <button key={f.id} type="button" role="tab" aria-selected={filter.id === f.id} className={filter.id === f.id ? 'is-active' : ''} onClick={() => update({ filter: f.id })}>
                  <span className={f.short ? 'label-long' : undefined}>{f.label}</span>
                  {f.short && <span className="label-short">{f.short}</span>}
                  <span className="board-count">{filterCounts[f.id] ?? 0}</span>
                </button>
              ))}
            </div>

            <label className="board-search">
              <SearchIcon />
              <input type="search" placeholder="Ник, комната или сервер" value={params.query} onChange={(e) => update({ query: e.target.value })} aria-label="Поиск" />
            </label>
          </div>
        </div>

        <p className="board-summary">
          {visible.length} {plural(visible.length, 'комната', 'комнаты', 'комнат')} · {people} в голосе
        </p>

        {visible.length ? (
          <div className="board-grid">
            {visible.slice(0, limit).map((room) => (
              <RoomTile key={room.id} room={room} />
            ))}
          </div>
        ) : (
          <div className="board-empty">
            <p>Ничего не найдено</p>
            <button type="button" className="cab-logout" onClick={() => setParams({ server: '', filter: 'all', query: '' })}>
              Сбросить фильтры
            </button>
          </div>
        )}
        {limit < visible.length && <div ref={sentinel} className="board-sentinel" aria-hidden="true" />}
      </div>

      {!subscribed && (
        <div className="cab-lock">
          <div className="glass cab-lock-card">
            <span className="cab-lock-icon">
              <LockIcon />
            </span>
            <p className="cab-lock-title">Доступно по подписке</p>
            <a href="/cabinet/subscription" className="cab-btn" onClick={linkTo('/cabinet/subscription')}>
              Оформить
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function ServerChip({ server, label, count, active, onClick }: { server?: Server; label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`board-chip ${active ? 'is-active' : ''}`} aria-pressed={active} onClick={onClick}>
      {server && <ServerIcon server={server} className="srv-icon-xs" />}
      <span className="board-chip-name">{label}</span>
      <span className="board-count">{count}</span>
    </button>
  );
}

const SpeakerIcon = () => (
  <svg className="vc-speaker" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M11.4 4.3 6.9 8H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.9l4.5 3.7a.6.6 0 0 0 1-.5V4.8a.6.6 0 0 0-1-.5Z" fill="currentColor" />
    <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.3a8 8 0 0 1 0 11.4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const MicOff = () => (
  <svg viewBox="0 0 24 24" aria-label="Микрофон выключен" role="img">
    <path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" fill="currentColor" />
    <path d="M6 11a6 6 0 0 0 12 0M12 17v3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M4.5 4.5 19.5 19.5" stroke="#f23f43" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

function BoardMember({ m }: { m: Member }) {
  return (
    <li className={`vc-member ${m.lady ? 'is-lady' : ''}`} style={{ '--hue': m.hue } as CSSProperties}>
      <span className="vc-av" aria-hidden="true">
        {m.avatarUrl ? <img src={m.avatarUrl} alt="" loading="lazy" /> : initial(m.name)}
      </span>
      <span className="vc-nick">{m.name}</span>
      {m.muted && (
        <span className="vc-state">
          <MicOff />
        </span>
      )}
    </li>
  );
}

/** One voice room on the board, Discord-style. Memoised: filtering re-renders only what changed. */
const RoomTile = memo(function RoomTile({ room }: { room: BoardRoom }) {
  const shown = room.members.slice(0, MAX_MEMBERS);
  const more = room.members.length - shown.length;
  const inVoice = room.members.length;
  const href = room.server.guildId ? `https://discord.com/channels/${room.server.guildId}` : undefined;

  return (
    <article className="room">
      <header className="room-head">
        <ServerIcon server={room.server} className="srv-icon-xs" />
        <span className="room-server">{room.server.name}</span>
        {room.ladies > 0 && <span className="room-ladies">{room.ladies} {plural(room.ladies, 'дама', 'дамы', 'дам')}</span>}
      </header>
      <div className="vc-channel">
        <SpeakerIcon />
        {room.emoji && <span className="vc-emoji">{room.emoji}</span>}
        <span className="vc-title">{room.name}</span>
        {room.limit ? (
          <span className="vc-limit" aria-label={`${inVoice} из ${room.limit}`}>
            <b>{pad(inVoice)}</b>
            <i>{pad(room.limit)}</i>
          </span>
        ) : (
          <span className="vc-limit" aria-label={`${inVoice} в голосе`}>
            <b>{pad(inVoice)}</b>
          </span>
        )}
      </div>
      <ul className="vc-members">
        {shown.map((m) => (
          <BoardMember key={m.id} m={m} />
        ))}
      </ul>
      <footer className="room-foot">
        {more > 0 ? <span>ещё {more}</span> : <span />}
        {href && (
          <a className="room-open" href={href} target="_blank" rel="noreferrer">
            Открыть в Discord
          </a>
        )}
      </footer>
    </article>
  );
});

// ---------------------------------------------------------------- Subscription

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`glass cab-panel ${className}`}>{children}</div>;
}

function Subscription({ me }: { me: Me }) {
  if (me.subscription.active) {
    return (
      <div className="cab-grid">
        <Panel className="cab-plan is-featured">
          <p className="cab-label">Подписка</p>
          <p className="cab-value">Полный доступ</p>
          <p className="cab-muted">Активна</p>
          <ul className="cab-list">
            <li>Все комнаты всех серверов</li>
            <li>Фильтры и поиск</li>
          </ul>
        </Panel>
      </div>
    );
  }
  return (
    <div className="cab-grid">
      <Panel className="cab-plan">
        <p className="cab-label">Сейчас</p>
        <p className="cab-value">Бесплатный</p>
        <ul className="cab-list">
          <li>Первые румы на главной</li>
        </ul>
      </Panel>
      <Panel className="cab-plan is-featured">
        <p className="cab-label">Полный доступ</p>
        <p className="cab-value">Скоро</p>
        <ul className="cab-list">
          <li>Все комнаты всех серверов</li>
          <li>Фильтры и поиск</li>
        </ul>
        <button type="button" className="cab-btn" disabled>
          Оформить
        </button>
      </Panel>
    </div>
  );
}
