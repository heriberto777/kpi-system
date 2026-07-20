import { useEffect, useState } from 'react';
import Card from '../atomos/Card';
import Select from '../atomos/Select';
import Spinner from '../atomos/Spinner';
import Badge from '../atomos/Badge';
import KPICard from '../moleculas/KPICard';
import { kpiApi } from '../../api/kpi.api';
import { surtidoMandatorioApi } from '../../api/surtidoMandatorio.api';
import { numero } from '../../utils/number';
import {
  ResumenGlobalGeneralData,
  ResumenGlobalPorVendedorData,
  SurtidoMandatorioCoberturaData,
  SurtidoMandatorioResumenVendedorData,
  VendedorOption,
} from '../../types';

function fmt(valor: number | null | undefined, decimales = 2): string {
  return valor == null ? '—' : valor.toFixed(decimales);
}

function fmtPct(valor: number | null | undefined): string {
  return valor == null ? '—' : `${valor.toFixed(2)}%`;
}

function promedio(valores: number[]): number | null {
  const validos = valores.filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
  if (validos.length === 0) return null;
  return validos.reduce((acc, v) => acc + v, 0) / validos.length;
}

export default function SurtidoMandatorioResumen() {
  const [vendedores, setVendedores] = useState<VendedorOption[]>([]);
  const [bimestresDisponibles, setBimestresDisponibles] = useState<string[]>([]);
  const [vendedorSeleccionado, setVendedorSeleccionado] = useState('');
  const [bimestreSeleccionado, setBimestreSeleccionado] = useState('');
  const [resumen, setResumen] = useState<SurtidoMandatorioResumenVendedorData[]>([]);
  const [cobertura, setCobertura] = useState<SurtidoMandatorioCoberturaData[]>([]);
  const [globalPorVendedor, setGlobalPorVendedor] = useState<ResumenGlobalPorVendedorData | null>(null);
  const [globalGeneral, setGlobalGeneral] = useState<ResumenGlobalGeneralData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void kpiApi.getVendedores().then(setVendedores);
    void surtidoMandatorioApi.getBimestresDisponibles().then(setBimestresDisponibles);
  }, []);

  useEffect(() => {
    let cancelado = false;
    setIsLoading(true);
    Promise.all([
      surtidoMandatorioApi.getResumenPorVendedor({
        vendedor: vendedorSeleccionado || undefined,
        bimestre: bimestreSeleccionado || undefined,
      }),
      surtidoMandatorioApi.getCoberturaPorVendedor({
        vendedor: vendedorSeleccionado || undefined,
        bimestre: bimestreSeleccionado || undefined,
      }),
      surtidoMandatorioApi.getResumenGlobalPorVendedor(bimestreSeleccionado || undefined),
      surtidoMandatorioApi.getResumenGlobalGeneral(bimestreSeleccionado || undefined),
    ])
      .then(([resumenData, coberturaData, globalPorVendedorData, globalGeneralData]) => {
        if (cancelado) return;
        setResumen(resumenData);
        setCobertura(coberturaData);
        setGlobalPorVendedor(globalPorVendedorData);
        setGlobalGeneral(globalGeneralData);
      })
      .finally(() => {
        if (!cancelado) setIsLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [vendedorSeleccionado, bimestreSeleccionado]);

  const vendedorOptions = vendedores.map((v) => ({
    value: v.codigo_vendedor,
    label: v.nombre_vendedor ? `${v.nombre_vendedor} (${v.codigo_vendedor})` : v.codigo_vendedor,
  }));

  const bimestreMostrado = bimestreSeleccionado || resumen[0]?.bimestre || null;

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
              label="Bimestre"
              placeholder="Mas reciente"
              options={bimestresDisponibles.map((b) => ({ value: b, label: b }))}
              value={bimestreSeleccionado}
              onChange={(e) => setBimestreSeleccionado(e.target.value)}
            />
          </div>
          {bimestreMostrado && <Badge color="info">Bimestre: {bimestreMostrado}</Badge>}
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="overflow-hidden p-0">
              <div className="bg-red-600 px-4 py-2 text-sm font-semibold text-white">Resultado Surtido Mandatorio</div>
              <div className="p-4">
                <p className="mb-3 text-xs text-gray-400">
                  Promedio SIN ponderar entre vendedores: cada uno pesa igual, sin importar cuantos clientes activos
                  tenga.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs uppercase text-gray-500">Act. Promedio</div>
                    <div className="text-lg font-bold text-gray-900">{fmt(globalPorVendedor?.act_promedio)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-gray-500">Logro</div>
                    <div className="text-lg font-bold text-gray-900">{fmtPct(globalPorVendedor?.logro)}</div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-xs uppercase text-gray-500">Colocaciones</div>
                    <div className="font-semibold text-gray-900">{globalPorVendedor?.colocaciones ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-gray-500">Restan 70%</div>
                    <div className="font-semibold text-gray-900">{fmt(globalPorVendedor?.restan_70)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-gray-500">Restan 45%</div>
                    <div className="font-semibold text-gray-900">{fmt(globalPorVendedor?.restan_45)}</div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded bg-blue-50 p-2 text-center">
                    <div className="text-xs font-semibold uppercase text-blue-700">Bronze</div>
                    <div className="font-bold text-blue-900">{fmtPct(globalPorVendedor?.bronze_logro_pct)}</div>
                  </div>
                  <div className="rounded bg-blue-50 p-2 text-center">
                    <div className="text-xs font-semibold uppercase text-blue-700">Silver</div>
                    <div className="font-bold text-blue-900">{fmtPct(globalPorVendedor?.silver_logro_pct)}</div>
                  </div>
                  <div className="rounded bg-blue-50 p-2 text-center">
                    <div className="text-xs font-semibold uppercase text-blue-700">Gold</div>
                    <div className="font-bold text-blue-900">{fmtPct(globalPorVendedor?.gold_logro_pct)}</div>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden p-0">
              <div className="bg-blue-700 px-4 py-2 text-sm font-semibold text-white">General</div>
              <div className="p-4">
                <p className="mb-3 text-xs text-gray-400">
                  Ponderado por volumen real: un vendedor con mas clientes activos pesa mas. Denominador = clientes
                  con ≥1 posicion activa (no clientes activos por Efectividad).
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs uppercase text-gray-500">Act. Promedio</div>
                    <div className="text-lg font-bold text-gray-900">{fmt(globalGeneral?.act_promedio)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-gray-500">Logro</div>
                    <div className="text-lg font-bold text-gray-900">{fmtPct(globalGeneral?.logro)}</div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-xs uppercase text-gray-500">Colocaciones</div>
                    <div className="font-semibold text-gray-900">{globalGeneral?.total_posiciones ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-gray-500">Restan 80%</div>
                    <div className="font-semibold text-gray-900">{fmt(globalGeneral?.restan_80)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-gray-500">Restan 70%</div>
                    <div className="font-semibold text-gray-900">{fmt(globalGeneral?.restan_70)}</div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

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
