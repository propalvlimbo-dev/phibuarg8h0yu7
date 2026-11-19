import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { authStatus } from '../api';
import DiscordButton from '../components/DiscordButton';
import { LensGlyph } from '../components/Logo';
import LoginTransition from '../components/LoginTransition';
import ServerOrbit from '../components/ServerOrbit';
import { navigate } from '../router';
import { useServers } from '../servers';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ?auth_error=… set by the Go callback when Discord login didn't work out.
const AUTH_ERRORS: Record<string, string> = {
  denied: 'Вход отменён',
  state: 'Сессия входа устарела. Попробуйте ещё раз',
  failed: 'Не удалось войти через Discord. Попробуйте ещё раз',
  not_configured: 'Вход через Discord ещё не настроен',
};

function useAuthErrorToast() {
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('auth_error');
    if (!code) return;
    setToast(AUTH_ERRORS[code] ?? AUTH_ERRORS.failed);
    params.delete('auth_error');
    const rest = params.toString();
    history.replaceState(null, '', location.pathname + (rest ? `?${rest}` : ''));
    const id = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(id);
  }, []);
  return toast;
}

export default function Landing() {
  const [revealed, setRevealed] = useState(false);
  const [active, setActive] = useState(0);
  const servers = useServers();

  useEffect(() => {
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const current = servers[active];
  const currentRoom = current?.rooms[0];

  // Login: logo flies to the centre and spins, meanwhile we check the API and go to Discord.
  const [loginFrom, setLoginFrom] = useState<DOMRect | null>(null);
  const buttonLogo = useRef<HTMLSpanElement | null>(null);
  const toast = useAuthErrorToast();

  const startLogin = useCallback(async (): Promise<string | void> => {
    const [status] = await Promise.all([authStatus(), wait(1100)]);
    if (!status) return 'Сервер авторизации не запущен';
    if (status.loggedIn) return navigate('/cabinet');
    if (!status.configured) return 'Вход через Discord ещё не настроен';
    window.location.assign('/api/auth/login');
  }, []);

  const appear = (delay: number) => ({
    initial: { opacity: 0, y: 18, filter: 'blur(10px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { type: 'spring' as const, stiffness: 110, damping: 22, delay },
  });

  return (
    <main className="app">
      <motion.header className="corner" {...appear(0.05)}>
        <span className="wordmark">
          <LensGlyph className="wordmark-mark" />
          GirlScan
        </span>
      </motion.header>

      <div className="shell">
        <motion.div className="stage-wrap" {...appear(0.1)}>
          <ServerOrbit servers={servers} active={active} onActiveChange={setActive} revealed={revealed} />
        </motion.div>

        <motion.div className="cta" {...appear(0.25)}>
          <DiscordButton
            label="Войти через Discord"
            ariaLabel="Войти через Discord"
            onClick={setLoginFrom}
            logoHidden={loginFrom !== null}
            logoRef={buttonLogo}
          />
        </motion.div>
      </div>

      {loginFrom && (
        <LoginTransition
          from={loginFrom}
          getReturnRect={() => buttonLogo.current?.getBoundingClientRect() ?? null}
          onClosed={() => setLoginFrom(null)}
          run={startLogin}
        />
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast"
            role="status"
            initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <p className="sr-only" aria-live="polite">
        {current && currentRoom ? `${current.name}, канал ${currentRoom.name}: ${currentRoom.members.length} в голосе` : ''}
      </p>
    </main>
  );
}
