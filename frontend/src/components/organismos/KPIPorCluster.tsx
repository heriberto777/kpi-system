import { useEffect, useState } from 'react';
import Card from '../atomos/Card';
import Select from '../atomos/Select';
import Spinner from '../atomos/Spinner';
import Badge from '../atomos/Badge';
import KPICard from '../moleculas/KPICard';
import { kpiApi } from '../../api/kpi.api';
import { numero } from '../../utils/number';
import { Cluster, DistribucionData, SurtidoClusterData } from '../../types';

const CLUSTER_OPTIONS: Array<{ value: Cluster; label: string }> = [
  { value: 'BRONZE', label: 'Bronze' },
  { value: 'SILVER', label: 'Silver' },
  { value: 'GOLD', label: 'Gold' },
];

export default function KPIPorCluster() {
  const [clusterSeleccionado, setClusterSeleccionado] = useState<Cluster | ''>('');
  const [mesSeleccionado, setMesSeleccionado] = useState<string>('');
  const [mesesDisponibles, setMesesDisponibles] = useState<string[]>([]);
  const [distribucion, setDistribucion] = useState<DistribucionData[]>([]);
  const [surtido, setSurtido] = useState<SurtidoClusterData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void kpiApi.getMesesDisponibles().then(setMesesDisponibles);
  }, []);

  useEffect(() => {
    let cancelado = false;
    setIsLoading(true);
    Promise.all([
      kpiApi.getDistribucionPorCluster(clusterSeleccionado || undefined, mesSeleccionado || undefined),
      kpiApi.getSurtidoPorCluster(mesSeleccionado || undefined),
    ])
      .then(([distribucionData, surtidoData]) => {
        if (cancelado) return;
        setDistribucion(distribucionData);
        setSurtido(surtidoData);
      })
      .finally(() => {
        if (!cancelado) setIsLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [clusterSeleccionado, mesSeleccionado]);

  const mesMostrado = mesSeleccionado || distribucion[0]?.anno_mes || null;

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {surtido.map((row) => (
          <KPICard
            key={row.id}
            titulo={`Surtido ${row.u_cluster}`}
            valor={`${numero(row.surtido_promedio_porcentaje).toFixed(1)}%`}
          />
        ))}
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-56">
            <Select
              label="Cluster"
              placeholder="Todos los cluster"
              options={CLUSTER_OPTIONS}
              value={clusterSeleccionado}
              onChange={(e) => setClusterSeleccionado(e.target.value as Cluster | '')}
            />
          </div>
          <div className="w-40">
            <Select
              label="Mes"
              placeholder="Mas reciente"
              options={mesesDisponibles.map((m) => ({ value: m, label: m }))}
              value={mesSeleccionado}
              onChange={(e) => setMesSeleccionado(e.target.value)}
            />
          </div>
          {mesMostrado && <Badge color="info">Mes: {mesMostrado}</Badge>}
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Distribución por Cluster</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Cluster</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Subcategoría</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Total clientes</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Resultado</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Distribución %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {distribucion.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-400">
                    No hay datos de distribución disponibles
                  </td>
                </tr>
              )}
              {distribucion.slice(0, 100).map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-700">{row.u_cluster}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{row.subcategoria}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{row.total_clientes}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{row.resultado}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-sm font-medium text-gray-900">
                    {numero(row.distribucion_porcentaje).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Surtido por Cluster</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Cluster</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Total clientes</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Compradas</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Obligatorias</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Surtido promedio %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {surtido.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-700">{row.u_cluster}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{row.total_clientes}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{row.subcategorias_compradas}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{row.subcategorias_obligatorias}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-sm font-medium text-gray-900">
                    {numero(row.surtido_promedio_porcentaje).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
