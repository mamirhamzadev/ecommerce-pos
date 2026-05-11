/** From root `.env` `APP_NAME`, injected at build/dev via `vite.config.js`. */
export const APP_NAME =
  typeof import.meta.env.VITE_APP_NAME === 'string' &&
  import.meta.env.VITE_APP_NAME.trim()
    ? import.meta.env.VITE_APP_NAME.trim()
    : 'App';
