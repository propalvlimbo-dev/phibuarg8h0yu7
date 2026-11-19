import { fileURLToPath } from 'node:url';
import devAuth from './dev-auth.ts';

export default {
  plugins: [
    // Discord login for `npm run dev` (no Go needed locally); reads ../.env next to go.mod.
    devAuth({ envFile: fileURLToPath(new URL('../.env', import.meta.url)) }),
  ],
  server: {
    allowedHosts: true,
    proxy: {
      // Everything else under /api (servers, rooms…) goes to the Go API if it's running.
      '/api': 'http://127.0.0.1:8080',
    },
  },
};
