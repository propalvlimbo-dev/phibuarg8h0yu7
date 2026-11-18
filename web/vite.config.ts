export default {
  server: {
    allowedHosts: true,
    proxy: {
      '/api': 'http://127.0.0.1:8080',
    },
  },
};
