# GirlScan

React + TypeScript frontend, three.js intro (crystal lens scan), CSS 3D room orbit, and Go API.

## Interface

- **Intro** — a faceted glass magnifier (three.js, bloom) scans 4 points, leaving a thin light trail and particles, then shrinks into the icon above the console. Click or press any key to skip. Respects `prefers-reduced-motion`.
- **Console** — one large block with a rotatable 3D orbit of voice rooms: drag / swipe, arrow keys, click a side room, or use the pager.
- **ВОЙТИ** — opens `VITE_DISCORD_INVITE` if it is set at build time (otherwise it is a stub).

Code: `web/src/scene/lensScene.ts` (WebGL intro), `web/src/components/RoomOrbit.tsx` (3D orbit), `web/src/rooms.ts` (data / placeholder rooms).

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
