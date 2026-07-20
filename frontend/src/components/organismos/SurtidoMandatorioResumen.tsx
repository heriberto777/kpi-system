import { useEffect, useState } from 'react';
import Card from '../atomos/Card';
import Select from '../atomos/Select';
import Spinner from '../atomos/Spinner';
import Badge from '../atomos/Badge';
import KPICard from '../moleculas/KPICard';
import { kpiApi } from '../../api/kpi.api';
import { surtidoMandatorioApi } from '../../api/surtidoMandatorio.api';
import { numero } from '../../utils/number';
import { SurtidoMandatorioCoberturaData, SurtidoMandatorioResumenVendedorData, VendedorOption } from '../../types';

function promedio(valores: number[]): number | null {
  const validos = valores.filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
  if (validos.length === 0) return null;
  return validos.reduce((acc, v) => acc + v, 0) / validos.length;
}

export default function SurtidoMandatorioResumen() {
  const [vendedores, setVendedores] = useState<VendedorOption[]>([]);
  const [mesesDisponibles, setMesesDisponibles] = useState<string[]>([]);
  const [vendedorSeleccionado, setVendedorSeleccionado] = useState('');
  const [mesSeleccionado, setMesSeleccionado] = useState('');
  const [resumen, setResumen] = useState<SurtidoMandatorioResumenVendedorData[]>([]);
  const [cobertura, setCobertura] = useState<SurtidoMandatorioCoberturaData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void kpiApi.getVendedores().then(setVendedores);
    void kpiApi.getMesesDisponibles().then(setMesesDisponibles);
  }, []);

  useEffect(() => {
    let cancelado = false;
    setIsLoading(true);
    Promise.all([
      surtidoMandatorioApi.getResumenPorVendedor({
        vendedor: vendedorSeleccionado || undefined,
        mes: mesSeleccionado || undefined,
      }),
      surtidoMandatorioApi.getCoberturaPorVendedor({
        vendedor: vendedorSeleccionado || undefined,
        mes: mesSeleccionado || undefined,
      }),
    ])
      .then(([resumenData, coberturaData]) => {
        if (cancelado) return;
        setResumen(resumenData);
        setCobertura(coberturaData);
      })
      .finally(() => {
        if (!cancelado) setIsLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [vendedorSeleccionado, mesSeleccionado]);

  const vendedorOptions = vendedores.map((v) => ({
    value: v.codigo_vendedor,
    label: v.nombre_vendedor ? `${v.nombre_vendedor} (${v.codigo_vendedor})` : v.codigo_vendedor,
  }));

  const mesMostrado = mesSeleccionado || resumen[0]?.anno_mes || null;

  // Agregados sobre el conjunto filtrado actual (igual patron que VentasPorVendedor: sumar
  // crudos y derivar el % desde la suma, no promediar porcentajes ya calculados -- excepto
  // logro_porcentaje/proyecciones, que no se pueden re-derivar sin los crudos internos de cada
  // vendedor, asi que ahi se usa un promedio simple entre las filas visibles).
  const universoTotal = resumen.reduce((acc, r) => acc + numero(r.universo_total), 0);
  const cubiertosTotal = resumen.reduce((acc, r) => acc + numero(r.cubiertos_total), 0);
  const logroFechaAgregado = universoTotal > 0 ? (cubiertosTotal / universoTotal) * 100 : 0;
  const logroPromedio = promedio(resumen.map((r) => r.logro_porcentaje).filter((v): v is number => v !== null));
  const proyeccionDiariaPromedio = promedio(
    resumen.map((r) => r.proyeccion_diaria).filter((v): v is number => v !== null)
  );
  const proyeccion98Promedio = promedio(resumen.map((r) => r.proyeccion_98).filter((v): v is number => v !== null));

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-72">
            <Select
              label="Vendedor"
              placeholder="Todos los vendedores"
              options={vendedorOptions}
              value={vendedorSeleccionado}
              onChange={(e) => setVendedorSeleccionado(e.target.value)}
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

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <KPICard titulo="Logro %" valor={logroPromedio === null ? '—' : `${logroPromedio.toFixed(2)}%`} />
            <KPICard titulo="Logro a la fecha" valor={`${logroFechaAgregado.toFixed(2)}%`} />
            <KPICard
              titulo="Proyección diaria"
              valor={proyeccionDiariaPromedio === null ? '—' : proyeccionDiariaPromedio.toFixed(2)}
            />
            <KPICard titulo="Proyección al 98%" valor={proyeccion98Promedio === null ? '—' : proyeccion98Promedio.toFixed(2)} />
          </div>

          <Card>
            <h3 className="mb-1 text-sm font-semibold text-gray-700">Resumen por Vendedor</h3>
            <p className="mb-3 text-xs text-gray-400">
              Total Activaciones = posiciones activas de los 3 clusters / clientes activos (≥ mínimo de unidades,
              configurable en Parámetros). Logro % = Total Activaciones / Objetivo promedio. Proyección diaria y al
              98% usan días hábiles (ver Parámetros → Días Hábiles).
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Vendedor</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Universo</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Cubiertos</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Objetivo Prom.</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Total Activ.</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Logro %</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Logro a la fecha</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Proy. diaria</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Proy. 98%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {resumen.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-6 text-center text-sm text-gray-400">
                        No hay datos de Surtido Mandatorio disponibles
                      </td>
                    </tr>
                  )}
                  {resumen.slice(0, 100).map((row) => (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-700">
                        {row.nombre_vendedor ?? row.vendedor}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{row.universo_total}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{row.cubiertos_total}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">
                        {row.objetivo_promedio == null ? '—' : numero(row.objetivo_promedio).toFixed(2)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">
                        {row.total_activaciones == null ? '—' : numero(row.total_activaciones).toFixed(2)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm font-medium text-gray-900">
                        {row.logro_porcentaje == null ? '—' : `${numero(row.logro_porcentaje).toFixed(2)}%`}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">
                        {row.logro_a_la_fecha_porcentaje == null
                          ? '—'
                          : `${numero(row.logro_a_la_fecha_porcentaje).toFixed(2)}%`}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">
                        {row.proyeccion_diaria == null ? '—' : numero(row.proyeccion_diaria).toFixed(2)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">
                        {row.proyeccion_98 == null ? '—' : numero(row.proyeccion_98).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Cobertura por Cluster</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Vendedor</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Cluster</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Universo</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Cubiertos</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">% Cobertura</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Prom. Activ.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cobertura.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-400">
                        No hay datos de cobertura disponibles
                      </td>
                    </tr>
                  )}
                  {cobertura.slice(0, 100).map((row) => (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-700">
                        {row.nombre_vendedor ?? row.vendedor}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{row.u_cluster}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{row.universo}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{row.cubiertos}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm font-medium text-gray-900">
                        {row.universo > 0 ? `${((row.cubiertos / row.universo) * 100).toFixed(2)}%` : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">
                        {row.promedio_activaciones == null ? '—' : numero(row.promedio_activaciones).toFixed(2)}
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
