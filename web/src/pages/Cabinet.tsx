import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { logout, useMe } from '../api';
import type { Me } from '../api';
import { LensGlyph } from '../components/Logo';
import { ServerIcon } from '../components/ServerCard';
import ServerModal from '../components/ServerModal';
import { linkTo, navigate } from '../router';
import { useServers } from '../servers';
import type { Server } from '../servers';

type Section = { path: string; label: string };

const SECTIONS: Section[] = [
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

  // /cabinet (and unknown sub-paths) open the first section.
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

const LockIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <rect x="5" y="10.5" width="14" height="10" rx="2.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

/** Server icons; a click opens the server sheet. Without a subscription everything is blurred and inert. */
function Servers({ servers, subscribed }: { servers: Server[]; subscribed: boolean }) {
  const [open, setOpen] = useState<Server | null>(null);

  return (
    <div className={`cab-srv-wrap ${subscribed ? '' : 'is-locked'}`}>
      <div className="cab-srv-grid" aria-hidden={!subscribed || undefined} inert={!subscribed}>
        {servers.map((server) => (
          <button key={server.id} type="button" className="glass cab-srv" onClick={() => setOpen(server)}>
            <ServerIcon server={server} className="srv-icon-lg" />
            <span className="cab-srv-name">{server.name}</span>
            <span className="cab-srv-meta">
              {server.roomCount} {plural(server.roomCount, 'комната', 'комнаты', 'комнат')}
            </span>
          </button>
        ))}
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

      <AnimatePresence>{open && subscribed && <ServerModal key={open.id} server={open} onClose={() => setOpen(null)} />}</AnimatePresence>
    </div>
  );
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
            <li>Все серверы</li>
            <li>Поиск по каждому серверу</li>
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
          <li>Все серверы</li>
          <li>Поиск по каждому серверу</li>
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
