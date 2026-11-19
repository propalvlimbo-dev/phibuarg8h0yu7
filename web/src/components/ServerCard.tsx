import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Member, Server } from '../servers';

const pad = (n: number) => String(n).padStart(2, '0');

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/** First letter worth showing on a placeholder avatar (skips "!", "#", spaces…). */
function initial(name: string) {
  const ch = [...name].find((c) => /[\p{L}\p{N}]/u.test(c));
  return ch ? ch.toUpperCase() : '•';
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

const SpeakerIcon = () => (
  <svg className="vc-speaker" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M11.4 4.3 6.9 8H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.9l4.5 3.7a.6.6 0 0 0 1-.5V4.8a.6.6 0 0 0-1-.5Z" fill="currentColor" />
    <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.3a8 8 0 0 1 0 11.4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const MicOffIcon = () => (
  <svg viewBox="0 0 24 24" aria-label="Микрофон выключен" role="img">
    <path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" fill="currentColor" />
    <path d="M6 11a6 6 0 0 0 12 0M12 17v3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M4.5 4.5 19.5 19.5" stroke="#f23f43" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

const DeafIcon = () => (
  <svg viewBox="0 0 24 24" aria-label="Звук выключен" role="img">
    <path d="M4 16v-4a8 8 0 0 1 16 0v4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <rect x="3" y="13.5" width="4.5" height="7" rx="1.6" fill="currentColor" />
    <rect x="16.5" y="13.5" width="4.5" height="7" rx="1.6" fill="currentColor" />
    <path d="M4.5 4.5 19.5 19.5" stroke="#f23f43" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

function MemberRow({ m }: { m: Member }) {
  // Each talker gets its own rhythm so the room feels alive without anything in sync.
  const style = useMemo(() => {
    const r = hash(m.id);
    return {
      '--hue': m.hue,
      '--talk-dur': `${(3.2 + r * 3.4).toFixed(2)}s`,
      '--talk-delay': `${(-r * 6).toFixed(2)}s`,
    } as CSSProperties;
  }, [m.id, m.hue]);
  const talking = m.talks && !m.muted && !m.deafened;

  return (
    <li className={`vc-member ${talking ? 'talks' : ''}`} style={style}>
      <span className="vc-av" aria-hidden="true">
        {m.avatarUrl ? <img src={m.avatarUrl} alt="" /> : initial(m.name)}
      </span>
      <span className="vc-nick">{m.name}</span>
      {(m.muted || m.deafened) && (
        <span className="vc-state">
          {m.muted && <MicOffIcon />}
          {m.deafened && <DeafIcon />}
        </span>
      )}
    </li>
  );
}

/** Server icon from Discord's CDN; falls back to a coloured letter if it can't load. */
function ServerIcon({ server }: { server: Server }) {
  const [failed, setFailed] = useState(false);
  const showImage = server.iconUrl && !failed;
  return (
    <span className={`srv-icon ${showImage ? 'has-image' : ''}`} style={{ '--hue': server.hue } as CSSProperties} aria-hidden="true">
      {showImage ? (
        <img src={server.iconUrl} alt="" loading="eager" decoding="async" draggable={false} referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        initial(server.name)
      )}
    </span>
  );
}

/** Discord-style card: server header, its first (public) voice room and who is in it. */
export default function ServerCard({ server }: { server: Server }) {
  const room = server.rooms[0];
  const hidden = Math.max(0, server.roomCount - 1);
  const inVoice = room?.members.length ?? 0;

  return (
    <>
      <header className="srv-head">
        <ServerIcon server={server} />
        <h2 className="srv-name">{server.name}</h2>
      </header>

      {room && (
        <section className="vc" aria-label={`Голосовой канал ${room.name}`}>
          <div className="vc-channel">
            <SpeakerIcon />
            {room.emoji && <span className="vc-emoji">{room.emoji}</span>}
            <span className="vc-title">{room.name}</span>
            {room.limit ? (
              <span className="vc-limit" aria-label={`${inVoice} из ${room.limit}`}>
                <b>{pad(inVoice)}</b>
                <i>{pad(room.limit)}</i>
              </span>
            ) : null}
          </div>
          <ul className="vc-members">
            {room.members.map((m) => (
              <MemberRow key={m.id} m={m} />
            ))}
          </ul>
        </section>
      )}

      {hidden > 0 && (
        <footer className="srv-foot">
          ещё {hidden} {plural(hidden, 'комната', 'комнаты', 'комнат')} в личном кабинете
        </footer>
      )}
    </>
  );
}
