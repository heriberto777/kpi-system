import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Card from '../atomos/Card';
import Select from '../atomos/Select';
import Spinner from '../atomos/Spinner';
import Badge from '../atomos/Badge';
import KPICard from '../moleculas/KPICard';
import Icon from '../atomos/Icon';
import { useKPIContext } from '../../contexts/KPIContext';
import { Retail } from '../../types';
import { formatearMoneda, numero } from '../../utils/number';

const RETAIL_OPTIONS: Array<{ value: Retail; label: string }> = [
  { value: 'COLMADO', label: 'Colmado' },
  { value: 'AUTOSERVICIO', label: 'Autoservicio' },
  { value: 'MAYORISTA', label: 'Mayorista' },
  { value: 'OTROS', label: 'Otros' },
];

export default function KPIMonitor() {
  const {
    distribucion,
    resumenGeneral,
    isLoading,
    retailSeleccionado,
    filterByRetail,
    mesSeleccionado,
    mesesDisponibles,
    filterByMes,
    loadKPIs,
  } = useKPIContext();

  const mesMostrado = mesSeleccionado ?? resumenGeneral?.anno_mes ?? distribucion[0]?.anno_mes ?? null;

  const distribucionPorRetail = useMemo(() => {
    const grupos = new Map<string, { retail: string; suma: number; total: number }>();
    for (const row of distribucion) {
      const key = row.retail ?? 'N/A';
      const actual = grupos.get(key) ?? { retail: key, suma: 0, total: 0 };
      actual.suma += numero(row.distribucion_porcentaje);
      actual.total += 1;
      grupos.set(key, actual);
    }
    return Array.from(grupos.values()).map((g) => ({
      retail: g.retail,
      distribucion_porcentaje: g.total > 0 ? Number((g.suma / g.total).toFixed(2)) : 0,
    }));
  }, [distribucion]);

  const top10Skus = useMemo(() => {
    return [...distribucion]
      .sort((a, b) => numero(b.distribucion_porcentaje) - numero(a.distribucion_porcentaje))
      .slice(0, 10)
      .map((row) => ({ subcategoria: row.subcategoria, distribucion_porcentaje: numero(row.distribucion_porcentaje) }));
  }, [distribucion]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Monitor de KPIs</h2>
          {mesMostrado && <Badge color="info">Mes: {mesMostrado}</Badge>}
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <div className="w-full sm:w-40">
            <Select
              options={mesesDisponibles.map((m) => ({ value: m, label: m }))}
              placeholder="Mes mas reciente"
              value={mesSeleccionado ?? ''}
              onChange={(e) => {
                filterByMes(e.target.value || undefined);
                void loadKPIs();
              }}
            />
          </div>
          <div className="w-full sm:w-56">
            <Select
              options={RETAIL_OPTIONS}
              placeholder="Todos los retail"
              value={retailSeleccionado ?? ''}
              onChange={(e) => {
                filterByRetail((e.target.value || undefined) as Retail | undefined);
                void loadKPIs();
              }}
            />
          </div>
        </div>
      </div>

      {isLoading && !resumenGeneral ? (
        <div className="flex justify-center py-10">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard
              titulo="Surtido Promedio"
              valor={`${numero(resumenGeneral?.surtido_promedio).toFixed(1)}%`}
              icono={<Icon name="chart" />}
            />
            <KPICard
              titulo="Distribucion Promedio"
              valor={`${numero(resumenGeneral?.distribucion_promedio).toFixed(1)}%`}
              icono={<Icon name="chart" />}
            />
            <KPICard
              titulo="Clientes Activos"
              valor={numero(resumenGeneral?.clientes_activos_mes).toLocaleString('es-DO')}
              icono={<Icon name="users" />}
            />
            <KPICard
              titulo="Ultima Actualizacion"
              valor={
                resumenGeneral?.fecha_actualizacion
                  ? new Date(resumenGeneral.fecha_actualizacion).toLocaleString('es-DO')
                  : 'N/A'
              }
              icono={<Icon name="clock" />}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard
              titulo="Ventas del Mes"
              valor={formatearMoneda(resumenGeneral?.ventas_mes_monto)}
              icono={<Icon name="chart" />}
            />
            <KPICard
              titulo="% Logrado vs Cuota"
              valor={
                resumenGeneral?.logro_monto_porcentaje == null
                  ? 'N/A'
                  : `${numero(resumenGeneral.logro_monto_porcentaje).toFixed(1)}%`
              }
              icono={<Icon name="chart" />}
            />
            <KPICard
              titulo="Proyeccion de Ventas"
              valor={formatearMoneda(resumenGeneral?.proyeccion_ventas_monto)}
              icono={<Icon name="chart" />}
            />
            <KPICard
              titulo="Dropsize Promedio"
              valor={formatearMoneda(resumenGeneral?.dropsize_promedio)}
              icono={<Icon name="chart" />}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Distribucion % promedio por Retail</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={distribucionPorRetail}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="retail" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} unit="%" />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="distribucion_porcentaje" name="Distribucion %" stroke="#2563EB" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Top 10 SKUs por Distribucion</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={top10Skus} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis type="number" unit="%" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="subcategoria" width={70} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="distribucion_porcentaje" name="Distribucion %" fill="#10B981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <Card>
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Distribucion por Retail</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Retail</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Subcategoria</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Universo</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Compraron</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Distribucion %</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Objetivo</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Objetivo %</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Logro %</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Restan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {distribucion.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-6 text-center text-sm text-gray-400">
                        No hay datos de distribucion disponibles
                      </td>
                    </tr>
                  )}
                  {distribucion.slice(0, 50).map((row) => (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-700">{row.retail}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-700">{row.subcategoria}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{row.total_clientes}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{row.resultado}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm font-medium text-gray-900">
                        {numero(row.distribucion_porcentaje).toFixed(2)}%
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{row.objetivo_clientes ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">
                        {row.objetivo_porcentaje == null ? '—' : `${numero(row.objetivo_porcentaje).toFixed(2)}%`}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">
                        {row.logro_porcentaje == null ? '—' : `${numero(row.logro_porcentaje).toFixed(2)}%`}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">
                        {row.restan == null ? '—' : numero(row.restan) < 0 ? `(${Math.abs(numero(row.restan))})` : numero(row.restan)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
