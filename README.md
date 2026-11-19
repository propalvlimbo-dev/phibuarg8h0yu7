# GirlScan

React + TypeScript frontend (minimal Apple-style glass UI with a rotatable 3D room carousel) and Go API.

## Interface

- Three voice rooms as glass cards on a 3D carousel — drag / swipe anywhere on the page, arrow keys, click a side card, or use the page dots.
- **Logo**: a Discord-style ring magnifier (`web/src/components/Logo.tsx`, favicon `web/public/favicon.svg`), shown next to the wordmark.
- **Animated background**: WebGL Threads from [React Bits](https://github.com/DavidHDev/react-bits) by David Haz (MIT + Commons Clause, licence in `web/src/backgrounds/`), with a gentle mouse reaction.
- **Discord button** (periodic shine; on hover it slowly grows, and the extruded 3D Discord mark makes one smooth turn to the right — its back face is the GirlScan magnifier, revealed mid-turn behind a solid edge) opens `VITE_DISCORD_INVITE` if it is set at build time (otherwise it is a stub).

Code: `web/src/components/RoomOrbit.tsx` (3D carousel), `web/src/components/DiscordButton.tsx`, `web/src/rooms.ts` (data / placeholder rooms), `web/src/styles.css` (glass material).

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
