import { useSelector } from 'react-redux';
import { DashboardHome } from '../components/dashboard/DashboardHome';

export default function DashboardHomePage() {
  const user = useSelector((state) => /** @type {any} */ (state)?.auth?.user);
  if (!user) {
    return null;
  }
  return <DashboardHome active isAdmin={user.role === 'admin'} />;
}
