import { ReactNode } from 'react';
import AdminLayout from './AdminLayout';

interface DashboardTemplateProps {
  titulo: string;
  descripcion?: string;
  children: ReactNode;
}

export default function DashboardTemplate({ titulo, descripcion, children }: DashboardTemplateProps) {
  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{titulo}</h1>
        {descripcion && <p className="mt-1 text-sm text-gray-500">{descripcion}</p>}
      </div>
      {children}
    </AdminLayout>
  );
}
