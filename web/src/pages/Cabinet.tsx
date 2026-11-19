import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { logout, useMe } from '../api';
import type { Me } from '../api';
import { LensGlyph } from '../components/Logo';
import ServerCard from '../components/ServerCard';
import { linkTo, navigate } from '../router';
import { useServers } from '../servers';
import type { Server } from '../servers';

type Section = { path: string; label: string };

const SECTIONS: Section[] = [
  { path: '/cabinet', label: 'Обзор' },
  { path: '/cabinet/servers', label: 'Серверы' },
  { path: '/cabinet/subscription', label: 'Подписка' },
  { path: '/cabinet/settings', label: 'Настройки' },
];

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/** Personal account shell: sidebar navigation + one section at a time. */
export default function Cabinet({ path }: { path: string }) {
  const { state, reload } = useMe();
  const servers = useServers();

  // Not logged in → back to the main page (where the Discord button is).
  useEffect(() => {
    if (state.status === 'guest') navigate('/', { replace: true });
  }, [state.status]);

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
      <motion.aside
        className="glass cab-side"
        initial={{ opacity: 0, x: -16, filter: 'blur(8px)' }}
        animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        <a href="/" className="wordmark cab-brand" onClick={linkTo('/')}>
          <LensGlyph className="wordmark-mark" />
          GirlScan
        </a>

        <nav className="cab-nav" aria-label="Личный кабинет">
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
          <Avatar me={me} className="cab-avatar" size={32} />
          <span className="cab-user-name">{me.user.displayName}</span>
          <button type="button" className="cab-logout" onClick={() => void onLogout()}>
            Выйти
          </button>
        </div>
      </motion.aside>

      <motion.section
        key={section.path}
        className="cab-main"
        initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        {demo && <p className="cab-demo">Демо-режим: Go API не запущен, показаны тестовые данные</p>}
        <h1 className="cab-title">{section.label}</h1>
        {section.path === '/cabinet' && <Overview me={me} servers={servers} />}
        {section.path === '/cabinet/servers' && <Servers servers={servers} subscribed={me.subscription.active} />}
        {section.path === '/cabinet/subscription' && <Subscription me={me} />}
        {section.path === '/cabinet/settings' && <Settings />}
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
        {(me.user.displayName || me.user.username).slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return <img className={className} src={me.user.avatarUrl} alt="" width={size} height={size} onError={() => setFailed(true)} />;
}

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`glass cab-panel ${className}`}>{children}</div>;
}

function Overview({ me, servers }: { me: Me; servers: Server[] }) {
  const inVoice = servers.reduce((sum, s) => sum + (s.rooms[0]?.members.length ?? 0), 0);
  const rooms = servers.reduce((sum, s) => sum + s.roomCount, 0);

  return (
    <div className="cab-grid">
      <Panel className="cab-profile">
        <Avatar me={me} className="cab-avatar-lg" size={64} />
        <div>
          <p className="cab-hello">Привет, {me.user.displayName}</p>
          <p className="cab-muted">@{me.user.username}</p>
        </div>
      </Panel>

      <Panel>
        <p className="cab-label">Доступ</p>
        <p className="cab-value">{me.subscription.active ? 'Полный' : 'Бесплатный'}</p>
        <p className="cab-muted">{me.subscription.active ? 'Все румы всех серверов' : 'Первые румы каждого сервера'}</p>
        {!me.subscription.active && (
          <a href="/cabinet/subscription" className="cab-link" onClick={linkTo('/cabinet/subscription')}>
            Полный доступ →
          </a>
        )}
      </Panel>

      <Panel>
        <p className="cab-label">Серверы</p>
        <p className="cab-value">{servers.length}</p>
        <p className="cab-muted">
          {rooms} {plural(rooms, 'комната', 'комнаты', 'комнат')}
        </p>
      </Panel>

      <Panel>
        <p className="cab-label">В голосе сейчас</p>
        <p className="cab-value">{inVoice}</p>
        <p className="cab-muted">в открытых румах</p>
      </Panel>
    </div>
  );
}

function Servers({ servers, subscribed }: { servers: Server[]; subscribed: boolean }) {
  return (
    <div className="cab-servers">
      {servers.map((server) => {
        const locked = Math.max(0, server.roomCount - 1);
        return (
          <article key={server.id} className="glass cab-server">
            <ServerCard server={server} showFoot={false} />
            {locked > 0 && !subscribed && (
              <div className="cab-locked">
                <div className="cab-locked-rows" aria-hidden="true">
                  {Array.from({ length: Math.min(3, locked) }, (_, i) => (
                    <span key={i} />
                  ))}
                </div>
                <p>
                  Ещё {locked} {plural(locked, 'комната', 'комнаты', 'комнат')} — с полным доступом
                </p>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function Subscription({ me }: { me: Me }) {
  return (
    <div className="cab-grid">
      <Panel className="cab-plan">
        <p className="cab-label">Сейчас</p>
        <p className="cab-value">{me.subscription.active ? 'Полный доступ' : 'Бесплатный'}</p>
        <ul className="cab-list">
          <li>Первые румы каждого сервера</li>
          <li>Кто сейчас в голосе</li>
        </ul>
      </Panel>
      <Panel className="cab-plan is-featured">
        <p className="cab-label">Полный доступ</p>
        <p className="cab-value">Скоро</p>
        <ul className="cab-list">
          <li>Все румы всех серверов</li>
          <li>Полная информация по каждому руму</li>
        </ul>
        <button type="button" className="cab-btn" disabled>
          Оформить
        </button>
      </Panel>
    </div>
  );
}

function Settings() {
  return (
    <Panel>
      <p className="cab-muted">Настройки появятся позже.</p>
    </Panel>
  );
}
