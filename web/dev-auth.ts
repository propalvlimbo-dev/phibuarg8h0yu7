/**
 * Discord login for `npm run dev`, inside the Vite server itself — no Go toolchain needed locally
 * (e.g. on Windows with Smart App Control, which blocks the unsigned Go compiler).
 *
 * Mirrors api/cmd/server/auth.go exactly: same endpoints, cookies, signed session format and errors.
 * Production (Docker) keeps using the Go server.
 *
 *   GET  /api/auth/status    → { configured, loggedIn }
 *   GET  /api/auth/login     → Discord consent screen
 *   GET  /api/auth/callback  → sets gs_session, redirects to /cabinet
 *   POST /api/auth/logout    → 204
 *   GET  /api/me             → { user, subscription } | 401
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import type { Logger, Plugin } from 'vite';

const DISCORD_API = 'https://discord.com/api/v10';
const DISCORD_AUTH_URL = 'https://discord.com/oauth2/authorize';
const SESSION_COOKIE = 'gs_session';
const STATE_COOKIE = 'gs_oauth_state';
const SESSION_LIFETIME = 30 * 24 * 60 * 60; // seconds

type Config = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  sessionSecret: Buffer;
  secure: boolean;
};

type Session = { id: string; u: string; g?: string; a?: string; exp: number };

/** Same KEY=VALUE parser as the Go server (comments, `export `, quotes). */
function readDotEnv(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return out;
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).replace(/^export\s+/, '').trim();
    let value = line.slice(eq + 1).trim();
    if (value.length >= 2 && ((value[0] === '"' && value.endsWith('"')) || (value[0] === "'" && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadConfig(envFile: string, logger: Logger): Config {
  const file = readDotEnv(envFile);
  const get = (key: string) => (process.env[key] ?? file[key] ?? '').trim();

  const redirectUri = get('DISCORD_REDIRECT_URI') || 'http://localhost:5173/api/auth/callback';
  let secret = get('SESSION_SECRET');
  if (secret.length < 32) {
    secret = crypto.randomBytes(32).toString('base64url');
    if (fs.existsSync(envFile) && !get('SESSION_SECRET')) {
      const current = fs.readFileSync(envFile, 'utf8');
      fs.appendFileSync(envFile, `${current && !current.endsWith('\n') ? '\n' : ''}SESSION_SECRET=${secret}\n`);
      logger.info('[auth] SESSION_SECRET was missing: generated one and saved it to .env');
    }
  }

  const cfg: Config = {
    clientId: get('DISCORD_CLIENT_ID'),
    clientSecret: get('DISCORD_CLIENT_SECRET'),
    redirectUri,
    sessionSecret: Buffer.from(secret),
    secure: redirectUri.startsWith('https://'),
  };
  if (cfg.clientId && cfg.clientSecret) {
    logger.info(`[auth] Discord login enabled, redirect URI ${cfg.redirectUri}`);
  } else {
    logger.warn(`[auth] Discord login is not configured: put DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET into ${envFile}`);
  }
  return cfg;
}

// ---------- session cookie: base64url(json).base64url(hmac-sha256) ----------

const mac = (cfg: Config, body: string) => crypto.createHmac('sha256', cfg.sessionSecret).update(body).digest('base64url');

function sign(cfg: Config, s: Session) {
  const body = Buffer.from(JSON.stringify(s)).toString('base64url');
  return `${body}.${mac(cfg, body)}`;
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function readSession(cfg: Config, req: IncomingMessage): Session | null {
  const value = cookies(req)[SESSION_COOKIE];
  if (!value) return null;
  const dot = value.indexOf('.');
  if (dot < 0) return null;
  const body = value.slice(0, dot);
  if (!safeEqual(value.slice(dot + 1), mac(cfg, body))) return null;
  try {
    const s = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Session;
    if (!s.id || Date.now() / 1000 > s.exp) return null;
    return s;
  } catch {
    return null;
  }
}

// ---------- http helpers ----------

function cookies(req: IncomingMessage): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

function cookie(cfg: Config, name: string, value: string, cookiePath: string, maxAge: number) {
  return `${name}=${value}; Path=${cookiePath}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${cfg.secure ? '; Secure' : ''}`;
}

function redirect(res: ServerResponse, to: string, setCookies: string[] = []) {
  res.statusCode = 302;
  if (setCookies.length) res.setHeader('Set-Cookie', setCookies);
  res.setHeader('Location', to);
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function avatarURL(id: string, hash?: string) {
  if (!hash) {
    let n = 0n;
    try {
      n = BigInt(id);
    } catch {
      /* default avatar 0 */
    }
    return `https://cdn.discordapp.com/embed/avatars/${Number((n >> 22n) % 6n)}.png`;
  }
  return `https://cdn.discordapp.com/avatars/${id}/${hash}.${hash.startsWith('a_') ? 'gif' : 'png'}?size=128`;
}

async function discordJSON<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'User-Agent': 'GirlScan (https://github.com/propalvlimbo-dev/phibuarg8h0yu7, 1.0)', Accept: 'application/json', ...init.headers },
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`discord ${new URL(url).pathname}: ${res.status} ${text.trim()}`);
  return JSON.parse(text) as T;
}

// ---------- handlers ----------

async function callback(cfg: Config, url: URL, req: IncomingMessage, res: ServerResponse, logger: Logger) {
  const clearState = cookie(cfg, STATE_COOKIE, '', '/api/auth', -1);
  const fail = (code: string) => redirect(res, `/?auth_error=${code}`, [clearState]);

  if (url.searchParams.get('error')) return fail('denied');
  const state = url.searchParams.get('state') ?? '';
  const saved = cookies(req)[STATE_COOKIE] ?? '';
  if (!state || !saved || !safeEqual(saved, state)) return fail('state');
  const code = url.searchParams.get('code');
  if (!code) return fail('failed');

  try {
    const token = await discordJSON<{ access_token?: string }>(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: cfg.redirectUri }).toString(),
    });
    if (!token.access_token) throw new Error('empty access token');
    const user = await discordJSON<{ id?: string; username: string; global_name?: string | null; avatar?: string | null }>(
      `${DISCORD_API}/users/@me`,
      { headers: { Authorization: `Bearer ${token.access_token}` } },
    );
    if (!user.id) throw new Error('discord user without id');

    const session: Session = { id: user.id, u: user.username, exp: Math.floor(Date.now() / 1000) + SESSION_LIFETIME };
    if (user.global_name) session.g = user.global_name;
    if (user.avatar) session.a = user.avatar;
    logger.info(`[auth] logged in: ${user.username}`);
    redirect(res, '/cabinet', [clearState, cookie(cfg, SESSION_COOKIE, sign(cfg, session), '/', SESSION_LIFETIME)]);
  } catch (err) {
    logger.error(`[auth] Discord login failed: ${err instanceof Error ? `${err.message}${err.cause ? ` (${String(err.cause)})` : ''}` : String(err)}`);
    fail('failed');
  }
}

export default function devAuth({ envFile }: { envFile: string }): Plugin {
  return {
    name: 'girlscan-dev-auth',
    apply: 'serve',
    configureServer(server) {
      const logger = server.config.logger;
      const cfg = loadConfig(path.resolve(envFile), logger);
      const configured = () => Boolean(cfg.clientId && cfg.clientSecret && cfg.redirectUri);

      // Registered directly (not returned), so it runs before Vite's /api proxy.
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const route = `${req.method} ${url.pathname}`;

        switch (route) {
          case 'GET /api/auth/status':
            return json(res, 200, { configured: configured(), loggedIn: readSession(cfg, req) !== null });

          case 'GET /api/auth/login': {
            if (!configured()) return redirect(res, '/?auth_error=not_configured');
            const state = crypto.randomBytes(32).toString('base64url');
            const q = new URLSearchParams({
              client_id: cfg.clientId,
              prompt: 'none', // skip the consent screen if the user already allowed GirlScan
              redirect_uri: cfg.redirectUri,
              response_type: 'code',
              scope: 'identify',
              state,
            });
            return redirect(res, `${DISCORD_AUTH_URL}?${q}`, [cookie(cfg, STATE_COOKIE, state, '/api/auth', 600)]);
          }

          case 'GET /api/auth/callback':
            void callback(cfg, url, req, res, logger);
            return;

          case 'POST /api/auth/logout': {
            const origin = req.headers.origin;
            if (origin && new URL(origin).host !== req.headers.host) return json(res, 403, { error: 'forbidden' });
            res.statusCode = 204;
            res.setHeader('Set-Cookie', cookie(cfg, SESSION_COOKIE, '', '/', -1));
            return res.end();
          }

          case 'GET /api/me': {
            const s = readSession(cfg, req);
            if (!s) return json(res, 401, { error: 'unauthorized' });
            return json(res, 200, {
              user: { id: s.id, username: s.u, displayName: s.g || s.u, avatarUrl: avatarURL(s.id, s.a) },
              subscription: { active: false, plan: null },
            });
          }

          default:
            return next();
        }
      });
    },
  };
}
