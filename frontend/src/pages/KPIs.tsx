import { useState } from 'react';
import DashboardTemplate from '../components/templates/DashboardTemplate';
import KPIMonitor from '../components/organismos/KPIMonitor';
import KPIPorVendedor from '../components/organismos/KPIPorVendedor';
import KPIPorCluster from '../components/organismos/KPIPorCluster';
import VentasPorVendedor from '../components/organismos/VentasPorVendedor';
import { useKPIData } from '../hooks/useKPIData';

type Vista = 'retail' | 'vendedor' | 'cluster' | 'ventas';

const TABS: Array<{ value: Vista; label: string }> = [
  { value: 'retail', label: 'Retail' },
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'cluster', label: 'Cluster' },
  { value: 'ventas', label: 'Ventas por Vendedor' },
];

export default function KPIs() {
  useKPIData();
  const [vista, setVista] = useState<Vista>('retail');

  return (
    <DashboardTemplate titulo="KPIs de Ventas" descripcion="Distribucion, surtido y ventas por cliente, vendedor y cluster.">
      <div className="mb-6 flex gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setVista(tab.value)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              vista === tab.value
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {vista === 'retail' && <KPIMonitor />}
      {vista === 'vendedor' && <KPIPorVendedor />}
      {vista === 'cluster' && <KPIPorCluster />}
      {vista === 'ventas' && <VentasPorVendedor />}
    </DashboardTemplate>
  );
}
