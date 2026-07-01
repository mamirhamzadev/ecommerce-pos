const path = require('path');
const { defineConfig, loadEnv } = require('vite');
const react = require('@vitejs/plugin-react');

module.exports = defineConfig(async ({ mode }) => {
  const { default: tailwindcss } = await import('@tailwindcss/vite');
  const env = loadEnv(mode, __dirname, '');
  const appName = (env.APP_NAME || 'App').trim() || 'App';

  return {
    root: path.join(__dirname, 'client'),
    base: './',
    define: {
      'import.meta.env.VITE_APP_NAME': JSON.stringify(appName),
    },
    plugins: [react(), tailwindcss()],
    build: {
      outDir: path.join(__dirname, 'dist', 'renderer'),
      emptyOutDir: true,
    },
    server: {
      port: 5173,
      strictPort: true,
      host: '127.0.0.1',
    },
  };
});
