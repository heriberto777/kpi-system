import { useEffect, useState } from 'react';
import Card from '../atomos/Card';
import Select from '../atomos/Select';
import Spinner from '../atomos/Spinner';
import Badge from '../atomos/Badge';
import KPICard from '../moleculas/KPICard';
import { kpiApi } from '../../api/kpi.api';
import { formatearMoneda, numero } from '../../utils/number';
import { Retail, VendedorOption, VentasVendedorData } from '../../types';

const RETAIL_OPTIONS: Array<{ value: Retail; label: string }> = [
  { value: 'COLMADO', label: 'Colmado' },
  { value: 'AUTOSERVICIO', label: 'Autoservicio' },
  { value: 'MAYORISTA', label: 'Mayorista' },
  { value: 'OTROS', label: 'Otros' },
];

export default function VentasPorVendedor() {
  const [vendedores, setVendedores] = useState<VendedorOption[]>([]);
  const [supervisores, setSupervisores] = useState<string[]>([]);
  const [mesesDisponibles, setMesesDisponibles] = useState<string[]>([]);
  const [vendedorSeleccionado, setVendedorSeleccionado] = useState('');
  const [retailSeleccionado, setRetailSeleccionado] = useState<Retail | ''>('');
  const [supervisorSeleccionado, setSupervisorSeleccionado] = useState('');
  const [mesSeleccionado, setMesSeleccionado] = useState('');
  const [ventas, setVentas] = useState<VentasVendedorData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void kpiApi.getVendedores().then(setVendedores);
    void kpiApi.getSupervisores().then(setSupervisores);
    void kpiApi.getMesesDisponibles().then(setMesesDisponibles);
  }, []);

  useEffect(() => {
    let cancelado = false;
    setIsLoading(true);
    kpiApi
      .getVentasPorVendedor({
        vendedor: vendedorSeleccionado || undefined,
        retail: retailSeleccionado || undefined,
        supervisor: supervisorSeleccionado || undefined,
        mes: mesSeleccionado || undefined,
      })
      .then((data) => {
        if (!cancelado) setVentas(data);
      })
      .finally(() => {
        if (!cancelado) setIsLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [vendedorSeleccionado, retailSeleccionado, supervisorSeleccionado, mesSeleccionado]);

  const vendedorOptions = vendedores.map((v) => ({
    value: v.codigo_vendedor,
    label: v.nombre_vendedor ? `${v.nombre_vendedor} (${v.codigo_vendedor})` : v.codigo_vendedor,
  }));
  const supervisorOptions = supervisores.map((s) => ({ value: s, label: s }));

  const mesMostrado = mesSeleccionado || ventas[0]?.anno_mes || null;

  const cuotaTotal = ventas.reduce((acc, v) => acc + numero(v.cuota_monto), 0);
  const ventaTotal = ventas.reduce((acc, v) => acc + numero(v.venta_neta), 0);
  const alcanceTotal = cuotaTotal > 0 ? (ventaTotal / cuotaTotal) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-64">
            <Select
              label="Vendedor"
              placeholder="Todos los vendedores"
              options={vendedorOptions}
              value={vendedorSeleccionado}
              onChange={(e) => setVendedorSeleccionado(e.target.value)}
            />
          </div>
          <div className="w-48">
            <Select
              label="Retail"
              placeholder="Todos los retail"
              options={RETAIL_OPTIONS}
              value={retailSeleccionado}
              onChange={(e) => setRetailSeleccionado(e.target.value as Retail | '')}
            />
          </div>
          <div className="w-40">
            <Select
              label="Supervisor"
              placeholder="Todos"
              options={supervisorOptions}
              value={supervisorSeleccionado}
              onChange={(e) => setSupervisorSeleccionado(e.target.value)}
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KPICard titulo="Cuota" valor={formatearMoneda(cuotaTotal)} />
            <KPICard titulo="Ventas" valor={formatearMoneda(ventaTotal)} />
            <KPICard titulo="Alcance" valor={`${alcanceTotal.toFixed(2)}%`} />
          </div>

          <Card>
            <h3 className="mb-1 text-sm font-semibold text-gray-700">Ventas por Vendedor</h3>
            <p className="mb-3 text-xs text-gray-400">
              Cuota = suma de dbo.cuota (todas las subcategorías) para ese vendedor+retail+mes. Dropsize = venta neta
              / facturas. Proyección y Diario usan días hábiles (ver Parámetros → Días Hábiles).
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Sup</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Retail</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Vend.</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Nombre</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Cuota</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Venta Neta</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Falta</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Alcance</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">% Dev.</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Venta Bruta</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Dropsize</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Proyección</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Alcance Proy.</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Diario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ventas.length === 0 && (
                    <tr>
                      <td colSpan={14} className="px-4 py-6 text-center text-sm text-gray-400">
                        No hay datos de ventas disponibles
                      </td>
                    </tr>
                  )}
                  {ventas.map((row) => (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{row.supervisor ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{row.retail}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-700">{row.vendedor}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-700">
                        {row.nombre_vendedor ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">
                        {row.cuota_monto == null ? '—' : formatearMoneda(row.cuota_monto)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm font-medium text-gray-900">
                        {formatearMoneda(row.venta_neta)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">
                        {row.falta == null || numero(row.falta) <= 0 ? '—' : formatearMoneda(row.falta)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm font-medium text-gray-900">
                        {row.alcance_porcentaje == null ? '—' : `${numero(row.alcance_porcentaje).toFixed(2)}%`}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">
                        {row.pct_devolucion == null ? '—' : `-${numero(row.pct_devolucion).toFixed(2)}%`}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">
                        {formatearMoneda(row.venta_bruta)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">
                        {row.dropsize == null ? '—' : formatearMoneda(row.dropsize)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">
                        {row.proyeccion == null ? '—' : formatearMoneda(row.proyeccion)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">
                        {row.alcance_proyeccion_porcentaje == null
                          ? '—'
                          : `${numero(row.alcance_proyeccion_porcentaje).toFixed(2)}%`}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">
                        {row.diario == null ? '—' : formatearMoneda(row.diario)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {ventas.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 font-semibold">
                      <td colSpan={4} className="px-4 py-2 text-sm text-gray-700">
                        {ventas.length} vendedor(es)
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">{formatearMoneda(cuotaTotal)}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{formatearMoneda(ventaTotal)}</td>
                      <td colSpan={2} className="px-4 py-2 text-sm text-gray-900">
                        {alcanceTotal.toFixed(2)}%
                      </td>
                      <td colSpan={6}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
