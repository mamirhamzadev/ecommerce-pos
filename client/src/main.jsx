import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/plus-jakarta-sans/wght.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import App from './App';
import { APP_NAME } from './appName';
import './index.css';

document.title = APP_NAME;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
