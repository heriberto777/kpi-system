import { useEffect, useState } from 'react';
import Card from '../atomos/Card';
import Select from '../atomos/Select';
import Spinner from '../atomos/Spinner';
import Badge from '../atomos/Badge';
import { kpiApi } from '../../api/kpi.api';
import { numero } from '../../utils/number';
import { DistribucionVendedorData, Retail, SurtidoVendedorData, VendedorOption } from '../../types';

const RETAIL_OPTIONS: Array<{ value: Retail; label: string }> = [
  { value: 'COLMADO', label: 'Colmado' },
  { value: 'AUTOSERVICIO', label: 'Autoservicio' },
  { value: 'MAYORISTA', label: 'Mayorista' },
  { value: 'OTROS', label: 'Otros' },
];

export default function KPIPorVendedor() {
  const [vendedores, setVendedores] = useState<VendedorOption[]>([]);
  const [mesesDisponibles, setMesesDisponibles] = useState<string[]>([]);
  const [vendedorSeleccionado, setVendedorSeleccionado] = useState<string>('');
  const [retailSeleccionado, setRetailSeleccionado] = useState<Retail | ''>('');
  const [mesSeleccionado, setMesSeleccionado] = useState<string>('');
  const [distribucion, setDistribucion] = useState<DistribucionVendedorData[]>([]);
  const [surtido, setSurtido] = useState<SurtidoVendedorData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void kpiApi.getVendedores().then(setVendedores);
    void kpiApi.getMesesDisponibles().then(setMesesDisponibles);
  }, []);

  useEffect(() => {
    let cancelado = false;
    setIsLoading(true);
    Promise.all([
      kpiApi.getDistribucionPorVendedor(
        vendedorSeleccionado || undefined,
        retailSeleccionado || undefined,
        mesSeleccionado || undefined
      ),
      kpiApi.getSurtidoPorVendedor(vendedorSeleccionado || undefined, mesSeleccionado || undefined),
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
  }, [vendedorSeleccionado, retailSeleccionado, mesSeleccionado]);

  const vendedorOptions = vendedores.map((v) => ({
    value: v.codigo_vendedor,
    label: v.nombre_vendedor ? `${v.nombre_vendedor} (${v.codigo_vendedor})` : v.codigo_vendedor,
  }));

  const mesMostrado = mesSeleccionado || distribucion[0]?.anno_mes || null;

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
          <div className="w-56">
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
          <Card>
            <h3 className="mb-1 text-sm font-semibold text-gray-700">Distribución por Vendedor</h3>
            <p className="mb-3 text-xs text-gray-400">
              Cuota = cartera del vendedor × objetivo % del retail (objetivo_clientes / universo). Logro = compraron
              / cuota. "Compraron" exige minimo 3 compras (Colmado) o 6 (Autoservicio/Mayorista) en el mes. Para
              ventas en pesos ($), ver la pestaña "Ventas por Vendedor".
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Vendedor</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Retail</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Subcategoría</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Cartera</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Compraron</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Distribución %</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Objetivo retail</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Objetivo %</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Cuota</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Logro %</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Faltan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {distribucion.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-4 py-6 text-center text-sm text-gray-400">
                        No hay datos de distribución disponibles
                      </td>
                    </tr>
                  )}
                  {distribucion.slice(0, 100).map((row) => (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-700">
                        {row.nombre_vendedor ?? row.vendedor}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{row.retail}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{row.subcategoria}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{row.total_clientes_vendedor}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{row.resultado}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm font-medium text-gray-900">
                        {row.distribucion_porcentaje === null ? '—' : `${numero(row.distribucion_porcentaje).toFixed(2)}%`}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{row.obj2 ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">
                        {row.objetivo_porcentaje == null ? '—' : `${numero(row.objetivo_porcentaje).toFixed(2)}%`}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{row.cuota ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm font-medium text-gray-900">
                        {row.logro_porcentaje === null ? '—' : `${numero(row.logro_porcentaje).toFixed(2)}%`}
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

          <Card>
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Surtido por Vendedor</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Vendedor</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Cluster</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Clientes</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Compradas</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Obligatorias</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Surtido %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {surtido.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-400">
                        No hay datos de surtido disponibles
                      </td>
                    </tr>
                  )}
                  {surtido.slice(0, 100).map((row) => (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-700">
                        {row.nombre_vendedor ?? row.vendedor}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{row.u_cluster}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{row.total_clientes_vendedor}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{row.subcategorias_compradas}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{row.subcategorias_obligatorias}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm font-medium text-gray-900">
                        {numero(row.surtido_porcentaje).toFixed(2)}%
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
