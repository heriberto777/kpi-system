import { NavLink, useNavigate } from 'react-router-dom';
import { ReactNode } from 'react';
import Icon, { IconName } from '../atomos/Icon';
import Button from '../atomos/Button';
import { useAuth } from '../../hooks/useAuth';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard ETL', icon: 'refresh' },
  { to: '/kpis', label: 'KPIs', icon: 'chart' },
  { to: '/logs', label: 'Logs', icon: 'clock' },
  { to: '/parametros', label: 'Parámetros', icon: 'settings' },
  { to: '/surtido-mandatorio', label: 'Surtido Mandatorio', icon: 'users' },
  { to: '/settings', label: 'Configuracion', icon: 'settings' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  function manejarLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-gray-200 bg-white sm:flex">
        <div className="flex h-16 items-center border-b border-gray-200 px-6">
          <span className="text-base font-bold text-primary">KPI ETL Dashboard</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-50 text-primary' : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <Icon name={item.icon} className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-gray-200 p-3">
          <p className="mb-2 truncate px-3 text-xs text-gray-400">{usuario ?? 'admin'}</p>
          <Button variant="secondary" className="w-full" onClick={manejarLogout}>
            <Icon name="logout" className="h-4 w-4" /> Cerrar sesion
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 sm:hidden">
          <span className="text-base font-bold text-primary">KPI ETL</span>
          <Button variant="secondary" onClick={manejarLogout}>
            <Icon name="logout" className="h-4 w-4" />
          </Button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
