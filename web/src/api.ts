import { useCallback, useEffect, useState } from 'react';

export type Me = {
  user: { id: string; username: string; displayName: string; avatarUrl: string };
  subscription: { active: boolean; plan: string | null };
};

export type MeState =
  | { status: 'loading' }
  | { status: 'ready'; me: Me; demo?: boolean }
  | { status: 'guest' }
  | { status: 'error' };

// Shown only in `npm run dev` when the Go API isn't running, so the cabinet can still be previewed.
const demoMe: Me = {
  user: { id: '0', username: 'demo', displayName: 'Демо-пользователь', avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png' },
  subscription: { active: false, plan: null },
};

export function useMe() {
  const [state, setState] = useState<MeState>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const res = await fetch('/api/me', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
      if (res.status === 401) return setState({ status: 'guest' });
      if (!res.ok) throw new Error(String(res.status));
      setState({ status: 'ready', me: (await res.json()) as Me });
    } catch {
      setState(import.meta.env.DEV ? { status: 'ready', me: demoMe, demo: true } : { status: 'error' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { state, reload: load };
}

export type AuthStatus = { configured: boolean; loggedIn: boolean };

export async function authStatus(): Promise<AuthStatus | null> {
  try {
    const res = await fetch('/api/auth/status', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
    if (!res.ok) return null;
    return (await res.json()) as AuthStatus;
  } catch {
    return null;
  }
}

export async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } catch {
    /* offline: the cookie simply stays until it expires */
  }
}
