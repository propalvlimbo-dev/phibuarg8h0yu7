# GirlScan

React + TypeScript frontend (minimal Apple-style glass UI with a rotatable 3D carousel of Discord servers) and Go API.

## Interface

- Discord servers as glass cards on a 3D carousel (open arc for a few servers, full ring from 7) — drag / swipe anywhere on the page, arrow keys, click a side card, or use the page dots. Each card looks like Discord's voice-channel list: server header, the server's **first voice room** (speaker icon, emoji + name, `05 | 20` members/limit badge) and who is in it (avatar, nickname, mute/deafen icons, green speaking ring). The first room is public on the main page; the rest ("ещё N комнат") is for the personal account. Placeholder servers for now: Xivivide, Elysium and Lounge (real icons from the Discord CDN, coloured letter as a fallback); once the bot is live the page shows the currently active servers.
- **Logo**: a Discord-style ring magnifier (`web/src/components/Logo.tsx`, favicon `web/public/favicon.svg`), shown next to the wordmark.
- **Animated background**: WebGL Threads from [React Bits](https://github.com/DavidHDev/react-bits) by David Haz (MIT + Commons Clause, licence in `web/src/backgrounds/`), with a gentle mouse reaction.
- **Discord button** (periodic shine; on hover it slowly grows, and the extruded 3D Discord mark makes one smooth turn to the right — its back face is the GirlScan magnifier, revealed mid-turn behind a solid edge) starts the login transition: the logo flies to the centre of the screen over a glass veil, grows and starts a loading spin with a progress line (Esc or a click cancels and flies it back). The Discord OAuth redirect is not wired yet.

Code: `web/src/components/ServerOrbit.tsx` (3D carousel), `web/src/components/ServerCard.tsx` (Discord-style room card), `web/src/components/DiscordButton.tsx`, `web/src/servers.ts` (data model, placeholder servers, `GET /api/servers` in production), `web/src/styles.css` (glass material).

## Production (recommended)

```bash
docker compose up --build
```

Open `http://localhost:8080`.

## Local development

Terminal 1 — API (Go 1.23+):

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
