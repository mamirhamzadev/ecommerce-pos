import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/plus-jakarta-sans/wght.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import 'react-toastify/dist/ReactToastify.css';
import App from './App';
import { APP_NAME } from './appName';
import './index.css';
import { store } from './redux/store';
import './toastify-theme.css';
import AuthProvider from './providers/AuthProvider';
import { ToastContainer } from 'react-toastify';

document.title = APP_NAME;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
      <ToastContainer
        position="top-right"
        autoClose={4500}
        hideProgressBar
        newestOnTop
        closeOnClick
        pauseOnHover
        draggable
        limit={5}
        stacked
        theme="dark"
        toastClassName="app-toast"
        style={{ zIndex: 20000 }}
      />
    </Provider>
  </React.StrictMode>,
);
