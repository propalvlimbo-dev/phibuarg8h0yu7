# GirlScan

React + TypeScript frontend (minimal Apple-style glass UI with a rotatable 3D room carousel) and Go API.

## Interface

- Three voice rooms as glass cards on a 3D carousel — drag / swipe anywhere on the page, arrow keys, click a side card, or use the page dots.
- **Discord button** (periodic shine; on hover it lifts smoothly, Clyde spins a full turn and its eyes light up) opens `VITE_DISCORD_INVITE` if it is set at build time (otherwise it is a stub).

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
