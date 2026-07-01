import { Navigate, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import { gatedRoutes, publicRoutes, shellRoutes } from './constants/routes';

export default function App() {
  return (
    <Routes>
      {publicRoutes.map(({ path, component: Component }) => (
        <Route key={path} path={path} element={<Component />} />
      ))}
      {gatedRoutes.map(({ path, component: Component }) => (
        <Route key={path} path={path} element={<Component />} />
      ))}
      <Route element={<Dashboard />}>
        {shellRoutes.map((route) => {
          const Component = route.component;
          if (route.index) {
            return <Route key="index" index element={<Component />} />;
          }
          return (
            <Route key={route.path} path={route.path} element={<Component />} />
          );
        })}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
