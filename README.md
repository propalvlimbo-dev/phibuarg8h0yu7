# GirlScan

React + TypeScript frontend (minimal Apple-style glass UI with a rotatable 3D carousel of Discord servers) and Go API.

## Interface

- Discord servers as liquid-glass cards on an endless 3D cylinder: the front card faces you, neighbours curve away along the cylinder and dissolve (fade + blur) towards the sides. Slots repeat the servers, so it spins forever in both directions even with a few servers. Drag / swipe anywhere on the page, mouse wheel / trackpad, arrow keys, click a side card or the page dots; when idle it gently auto-advances every ~5 s (pauses on hover/interaction). Dev preview with many servers: `http://localhost:5173/?demo=12`. Each card looks like Discord's voice-channel list: server header, the server's **first voice room** (speaker icon, emoji + name, `05 | 20` members/limit badge) and who is in it (avatar, nickname, mute/deafen icons, green speaking ring). The first room is public on the main page; the rest ("ещё N комнат") is for the personal account. Placeholder servers for now: Xivivide, Elysium and Lounge (real icons from the Discord CDN, coloured letter as a fallback); once the bot is live the page shows the currently active servers.
- **Logo**: a Discord-style ring magnifier (`web/src/components/Logo.tsx`, favicon `web/public/favicon.svg`), shown next to the wordmark.
- **Animated background**: WebGL Threads from [React Bits](https://github.com/DavidHDev/react-bits) by David Haz (MIT + Commons Clause, licence in `web/src/backgrounds/`), with a gentle mouse reaction.
- **Discord button** (periodic shine; on hover it slowly grows, and the extruded 3D Discord mark makes one smooth turn to the right — its back face is the GirlScan magnifier, revealed mid-turn behind a solid edge) starts the login transition: the logo flies to the centre of the screen over a glass veil, grows and starts a loading spin with a progress line (Esc or a click cancels and flies it back), meanwhile it checks `/api/auth/status` and redirects to Discord OAuth (or shows why it can't, then flies back).
- **Personal account** `/cabinet` (`web/src/pages/Cabinet.tsx`): glass sidebar with Overview (Discord avatar, name, access level, stats), Servers (first room open, the rest locked until the subscription), Subscription (placeholder, "Скоро"), Settings, Logout. Without a session it sends you back to `/`. In `npm run dev` without the Go API it shows demo data.

Code: `web/src/pages/Landing.tsx`, `web/src/pages/Cabinet.tsx`, `web/src/router.ts` (tiny history router), `web/src/api.ts` (`/api/me`, auth status, logout), `web/src/components/ServerOrbit.tsx` (3D carousel), `web/src/components/ServerCard.tsx` (Discord-style room card), `web/src/components/DiscordButton.tsx`, `web/src/servers.ts` (data model, placeholder servers, `GET /api/servers` in production), `web/src/styles.css` (glass material).

## Discord login

1. https://discord.com/developers/applications → **New Application** → tab **OAuth2**.
2. Copy **Client ID**, press **Reset Secret** and copy **Client Secret**.
3. **Redirects** → add `http://localhost:5173/api/auth/callback` (and `https://<domain>/api/auth/callback` for production) → **Save Changes**.
4. Copy `.env.example` to `.env` in the repo root and fill in `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `SESSION_SECRET` (optional: if missing, the server generates one and appends it to `.env`; for production also set `DISCORD_REDIRECT_URI`). `.env` is git-ignored — never commit it.

Flow: `GET /api/auth/login` → Discord (scope `identify` only) → `GET /api/auth/callback` → HMAC-signed HttpOnly cookie `gs_session` (30 days) → `/cabinet`. Other endpoints: `GET /api/auth/status`, `GET /api/me`, `POST /api/auth/logout`. No database yet: the Discord access token isn't stored, subscription is always `active: false` until billing exists.

## Production (recommended)

```bash
docker compose up --build
```

Open `http://localhost:8080`.

## Local development

**Windows, one click:** run `start.bat` from the repo root. On the first run it asks for the Discord Client Secret (or takes it as an argument: `start.bat <secret>`) and writes `.env`, installs Go via winget if needed, runs `npm install`, builds the API to `bin\girlscan-api.exe`, starts the API (127.0.0.1:8080) and Vite (5173) in their own windows and opens the browser. Close those two windows to stop.

Manually:

Terminal 1 — API (Go 1.23+, run from the repo root so it picks up `.env`):

```bash
go run ./api/cmd/server
```

Terminal 2 — React:

```bash
cd web
npm ci
npm run dev
```

Open the Vite URL. `/api` requests are proxied to Go on port `8080`.

The API returns only aggregate room data; it must not expose personal identities, gender roles, or member locations.
