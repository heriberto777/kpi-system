import { useEffect, useState } from 'react';
import Card from '../atomos/Card';
import Select from '../atomos/Select';
import Input from '../atomos/Input';
import Button from '../atomos/Button';
import Spinner from '../atomos/Spinner';
import AlertBanner from '../moleculas/AlertBanner';
import KPICard from '../moleculas/KPICard';
import { configApi } from '../../api/config.api';
import { kpiApi } from '../../api/kpi.api';
import { DiaNoLaborableData, ResumenDiasLaborablesData } from '../../types';

function mesActual(): string {
  return new Date().toISOString().slice(0, 7);
}

export default function ParametrosDiasHabiles() {
  const [meses, setMeses] = useState<string[]>([]);
  const [mes, setMes] = useState<string>(mesActual());
  const [dias, setDias] = useState<DiaNoLaborableData[]>([]);
  const [resumen, setResumen] = useState<ResumenDiasLaborablesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [nuevaDescripcion, setNuevaDescripcion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  useEffect(() => {
    void kpiApi.getMesesDisponibles().then(setMeses);
  }, []);

  async function cargar() {
    setIsLoading(true);
    try {
      const [diasData, resumenData] = await Promise.all([
        configApi.getDiasNoLaborables(mes),
        configApi.getResumenDiasLaborables(mes),
      ]);
      setDias(diasData);
      setResumen(resumenData);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes]);

  async function agregar() {
    if (!nuevaFecha) return;
    setGuardando(true);
    setMensaje(null);
    try {
      await configApi.addDiaNoLaborable(nuevaFecha, nuevaDescripcion || null);
      setNuevaFecha('');
      setNuevaDescripcion('');
      setMensaje({ tipo: 'success', texto: 'Dia no laborable agregado' });
      await cargar();
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo agregar el dia no laborable' });
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(fecha: string) {
    setEliminando(fecha);
    setMensaje(null);
    try {
      await configApi.deleteDiaNoLaborable(fecha);
      await cargar();
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo eliminar el dia no laborable' });
    } finally {
      setEliminando(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {mensaje && <AlertBanner tipo={mensaje.tipo} mensaje={mensaje.texto} onDismiss={() => setMensaje(null)} />}

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Días no laborables (feriados)</h3>
            <p className="text-xs text-gray-400">
              Días hábiles = lunes a viernes que no estén marcados aquí como feriado. Se usan para calcular
              "Proyección" y "Diario" en Ventas por Vendedor. Los fines de semana ya se excluyen automáticamente, no
              hace falta agregarlos.
            </p>
          </div>
          <div className="w-48">
            <Select
              options={meses.map((m) => ({ value: m, label: m }))}
              placeholder="Mes actual"
              value={mes}
              onChange={(e) => setMes(e.target.value || mesActual())}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner size="lg" />
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <KPICard titulo="Días laborables del mes" valor={resumen?.dias_laborables_mes ?? 0} />
              <KPICard titulo="Días laborables transcurridos" valor={resumen?.dias_laborables_transcurridos ?? 0} />
            </div>

            <div className="mb-4 flex flex-wrap items-end gap-3">
              <div className="w-44">
                <Input
                  label="Fecha"
                  type="date"
                  value={nuevaFecha}
                  onChange={(e) => setNuevaFecha(e.target.value)}
                />
              </div>
              <div className="w-64">
                <Input
                  label="Descripción (opcional)"
                  placeholder="Ej: Día del Trabajo (trasladado)"
                  value={nuevaDescripcion}
                  onChange={(e) => setNuevaDescripcion(e.target.value)}
                />
              </div>
              <Button disabled={!nuevaFecha || guardando} onClick={() => void agregar()}>
                {guardando ? 'Agregando...' : 'Agregar'}
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Fecha</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Descripción</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dias.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-400">
                        Sin días no laborables registrados para este mes
                      </td>
                    </tr>
                  )}
                  {dias.map((d) => (
                    <tr key={d.fecha}>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-700">{d.fecha}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{d.descripcion ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm">
                        <Button
                          variant="danger"
                          disabled={eliminando === d.fecha}
                          onClick={() => void eliminar(d.fecha)}
                        >
                          {eliminando === d.fecha ? 'Eliminando...' : 'Eliminar'}
                        </Button>
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
