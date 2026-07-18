import { useEffect, useState } from 'react';
import Card from '../atomos/Card';
import Select from '../atomos/Select';
import Badge from '../atomos/Badge';
import Spinner from '../atomos/Spinner';
import { configApi } from '../../api/config.api';
import { kpiApi } from '../../api/kpi.api';
import { CuotaVendedorConfigData, ObjetivoDistribucionConfigData, UniversoClienteConfigData } from '../../types';
import { formatearMoneda, numero } from '../../utils/number';

export default function ParametrosObjetivos() {
  const [meses, setMeses] = useState<string[]>([]);
  const [mes, setMes] = useState<string>('');
  const [objetivos, setObjetivos] = useState<ObjetivoDistribucionConfigData[]>([]);
  const [universo, setUniverso] = useState<UniversoClienteConfigData[]>([]);
  const [cuotas, setCuotas] = useState<CuotaVendedorConfigData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void kpiApi.getMesesDisponibles().then(setMeses);
  }, []);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      configApi.getObjetivosDistribucion(mes || undefined),
      configApi.getUniversoCliente(mes || undefined),
      configApi.getCuotaVendedor(mes || undefined),
    ])
      .then(([obj, univ, cuota]) => {
        setObjetivos(obj);
        setUniverso(univ);
        setCuotas(cuota);
      })
      .finally(() => setIsLoading(false));
  }, [mes]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Objetivos y universo (solo lectura)</h3>
            <p className="text-xs text-gray-400">
              Estos valores se alimentan directamente del ERP en cada sincronizacion diaria. Si necesitas cambiar un
              objetivo, un universo o una cuota, se edita en el ERP — la app solo los refleja.
            </p>
          </div>
          <div className="w-48">
            <Select
              options={meses.map((m) => ({ value: m, label: m }))}
              placeholder="Mes mas reciente"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner size="lg" />
          </div>
        ) : (
          <>
            <h4 className="mb-2 mt-4 text-xs font-semibold uppercase text-gray-500">Universo de clientes</h4>
            <div className="mb-6 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Mes</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Retail</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Universo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {universo.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-400">
                        Sin datos
                      </td>
                    </tr>
                  )}
                  {universo.map((u) => (
                    <tr key={u.id}>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{u.anno_mes}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-700">{u.retail}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm font-medium text-gray-900">
                        {numero(u.universo).toLocaleString('es-DO')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h4 className="mb-2 text-xs font-semibold uppercase text-gray-500">Objetivos de distribucion</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Retail</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Subcategoria</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Objetivo clientes</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Objetivo $</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Activa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {objetivos.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-400">
                        Sin datos
                      </td>
                    </tr>
                  )}
                  {objetivos.map((o) => (
                    <tr key={o.id}>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-700">{o.retail}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-700">{o.clasificacion_2}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">
                        {o.objetivo_clientes ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">
                        {o.objetivo_monto == null ? '—' : formatearMoneda(o.objetivo_monto)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm">
                        <Badge color={o.activo ? 'success' : 'neutral'}>{o.activo ? 'Si' : 'No'}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h4 className="mb-2 mt-6 text-xs font-semibold uppercase text-gray-500">Cuota $ por vendedor (dbo.cuota)</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Vendedor</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Retail</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Subcategoria</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Cuota $</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cuotas.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">
                        Sin datos
                      </td>
                    </tr>
                  )}
                  {cuotas.slice(0, 200).map((c) => (
                    <tr key={c.id}>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-700">{c.vendedor}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{c.retail}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{c.clasificacion_2}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm font-medium text-gray-900">
                        {c.cuota_monto == null ? '—' : formatearMoneda(c.cuota_monto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
