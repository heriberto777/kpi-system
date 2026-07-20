import { useEffect, useState } from 'react';
import Card from '../atomos/Card';
import Button from '../atomos/Button';
import Input from '../atomos/Input';
import Select from '../atomos/Select';
import Spinner from '../atomos/Spinner';
import AlertBanner from '../moleculas/AlertBanner';
import { configApi } from '../../api/config.api';
import { surtidoMandatorioApi } from '../../api/surtidoMandatorio.api';
import { ConfigSurtidoMandatorioData, ObjetivoSurtidoMandatorioData, PosicionSurtidoMandatorioData } from '../../types';

const CLUSTER_OPTIONS = [
  { value: 'BRONZE', label: 'Bronze' },
  { value: 'SILVER', label: 'Silver' },
  { value: 'GOLD', label: 'Gold' },
];

export default function ParametrosSurtidoMandatorio() {
  const [objetivos, setObjetivos] = useState<ObjetivoSurtidoMandatorioData[]>([]);
  const [ediciones, setEdiciones] = useState<Record<string, { base_objetivo: number; colocaciones_meta: number }>>({});
  const [posiciones, setPosiciones] = useState<PosicionSurtidoMandatorioData[]>([]);
  const [config, setConfig] = useState<ConfigSurtidoMandatorioData | null>(null);
  const [clienteActivoMinimo, setClienteActivoMinimo] = useState<number | ''>('');
  const [isLoading, setIsLoading] = useState(true);
  const [guardandoObjetivo, setGuardandoObjetivo] = useState<string | null>(null);
  const [guardandoConfig, setGuardandoConfig] = useState(false);
  const [eliminandoPosicion, setEliminandoPosicion] = useState<number | null>(null);
  const [nuevaPosicion, setNuevaPosicion] = useState<number | ''>('');
  const [nuevoCluster, setNuevoCluster] = useState('BRONZE');
  const [agregandoPosicion, setAgregandoPosicion] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  async function cargar() {
    setIsLoading(true);
    try {
      const [objetivosData, posicionesData, configData] = await Promise.all([
        surtidoMandatorioApi.getObjetivos(),
        surtidoMandatorioApi.getPosiciones(),
        surtidoMandatorioApi.getConfig(),
      ]);
      setObjetivos(objetivosData);
      setEdiciones(
        Object.fromEntries(
          objetivosData.map((o) => [o.u_cluster, { base_objetivo: o.base_objetivo, colocaciones_meta: o.colocaciones_meta }])
        )
      );
      setPosiciones(posicionesData);
      setConfig(configData);
      setClienteActivoMinimo(configData.cliente_activo_minimo);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void cargar();
  }, []);

  async function guardarObjetivo(uCluster: string) {
    setGuardandoObjetivo(uCluster);
    setMensaje(null);
    try {
      const actualizado = await surtidoMandatorioApi.updateObjetivo(uCluster, ediciones[uCluster]);
      setObjetivos((prev) => prev.map((o) => (o.u_cluster === uCluster ? actualizado : o)));
      await configApi.refrescarVistas();
      setMensaje({ tipo: 'success', texto: `Objetivo de ${uCluster} actualizado (vistas refrescadas)` });
    } catch {
      setMensaje({ tipo: 'error', texto: `No se pudo guardar el objetivo de ${uCluster}` });
    } finally {
      setGuardandoObjetivo(null);
    }
  }

  async function agregarPosicion() {
    if (nuevaPosicion === '') return;
    setAgregandoPosicion(true);
    setMensaje(null);
    try {
      await surtidoMandatorioApi.setPosicion(Number(nuevaPosicion), nuevoCluster, true);
      setNuevaPosicion('');
      await configApi.refrescarVistas();
      setMensaje({ tipo: 'success', texto: 'Posición agregada (vistas refrescadas)' });
      await cargar();
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo agregar la posición' });
    } finally {
      setAgregandoPosicion(false);
    }
  }

  async function alternarPosicion(pos: PosicionSurtidoMandatorioData) {
    setMensaje(null);
    try {
      await surtidoMandatorioApi.setPosicion(pos.posicion_surtido, pos.u_cluster, !pos.es_obligatorio);
      await configApi.refrescarVistas();
      await cargar();
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo actualizar la posición' });
    }
  }

  async function eliminarPosicion(id: number) {
    setEliminandoPosicion(id);
    setMensaje(null);
    try {
      await surtidoMandatorioApi.deletePosicion(id);
      await configApi.refrescarVistas();
      await cargar();
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo eliminar la posición' });
    } finally {
      setEliminandoPosicion(null);
    }
  }

  async function guardarConfig() {
    if (clienteActivoMinimo === '') return;
    setGuardandoConfig(true);
    setMensaje(null);
    try {
      const actualizado = await surtidoMandatorioApi.updateConfig(Number(clienteActivoMinimo));
      setConfig(actualizado);
      await configApi.refrescarVistas();
      setMensaje({ tipo: 'success', texto: 'Configuración actualizada (vistas refrescadas)' });
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo guardar la configuración' });
    } finally {
      setGuardandoConfig(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {mensaje && <AlertBanner tipo={mensaje.tipo} mensaje={mensaje.texto} onDismiss={() => setMensaje(null)} />}

      <Card>
        <h3 className="mb-1 text-sm font-semibold text-gray-700">Objetivos por cluster</h3>
        <p className="mb-3 text-xs text-gray-400">
          Base = meta de posiciones por cliente (usada en "Logro %"). Colocaciones Meta = meta operativa de un
          cliente ideal (usada en "Proyección al 98%"). Son números independientes entre sí.
        </p>
        <div className="flex flex-col divide-y divide-gray-100">
          {objetivos.map((o) => (
            <div key={o.u_cluster} className="flex flex-wrap items-end gap-3 py-3">
              <div className="w-24 text-sm font-medium text-gray-900">{o.u_cluster}</div>
              <div className="w-40">
                <Input
                  label="Base"
                  type="number"
                  min={0}
                  value={ediciones[o.u_cluster]?.base_objetivo ?? ''}
                  onChange={(e) =>
                    setEdiciones((prev) => ({
                      ...prev,
                      [o.u_cluster]: { ...prev[o.u_cluster], base_objetivo: Number(e.target.value) },
                    }))
                  }
                />
              </div>
              <div className="w-40">
                <Input
                  label="Colocaciones Meta"
                  type="number"
                  min={0}
                  value={ediciones[o.u_cluster]?.colocaciones_meta ?? ''}
                  onChange={(e) =>
                    setEdiciones((prev) => ({
                      ...prev,
                      [o.u_cluster]: { ...prev[o.u_cluster], colocaciones_meta: Number(e.target.value) },
                    }))
                  }
                />
              </div>
              <Button disabled={guardandoObjetivo === o.u_cluster} onClick={() => void guardarObjetivo(o.u_cluster)}>
                {guardandoObjetivo === o.u_cluster ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="mb-1 text-sm font-semibold text-gray-700">Cliente activo</h3>
        <p className="mb-3 text-xs text-gray-400">
          Mínimo de unidades (de TODAS las compras del mes, no solo de posiciones obligatorias) para que un cliente
          cuente como "activo" en el denominador de "Total Activaciones".
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Input
              label="Mínimo de unidades"
              type="number"
              min={1}
              value={clienteActivoMinimo}
              onChange={(e) => setClienteActivoMinimo(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
          <Button disabled={guardandoConfig || clienteActivoMinimo === ''} onClick={() => void guardarConfig()}>
            {guardandoConfig ? 'Guardando...' : 'Guardar'}
          </Button>
          {config && <span className="text-xs text-gray-400">Valor actual: {config.cliente_activo_minimo}</span>}
        </div>
      </Card>

      <Card>
        <h3 className="mb-1 text-sm font-semibold text-gray-700">Posiciones obligatorias</h3>
        <p className="mb-3 text-xs text-gray-400">
          Qué posiciones de surtido (1-21) cuentan como obligatorias para cada cluster. Arranca vacío a propósito:
          agrega aquí las combinaciones que correspondan.
        </p>

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="w-32">
            <Input
              label="Posición"
              type="number"
              min={1}
              value={nuevaPosicion}
              onChange={(e) => setNuevaPosicion(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
          <div className="w-40">
            <Select
              label="Cluster"
              options={CLUSTER_OPTIONS}
              value={nuevoCluster}
              onChange={(e) => setNuevoCluster(e.target.value)}
            />
          </div>
          <Button disabled={nuevaPosicion === '' || agregandoPosicion} onClick={() => void agregarPosicion()}>
            {agregandoPosicion ? 'Agregando...' : 'Agregar'}
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Posición</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Cluster</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Obligatoria</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {posiciones.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">
                    Sin posiciones registradas
                  </td>
                </tr>
              )}
              {posiciones.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-700">{p.posicion_surtido}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{p.u_cluster}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-sm">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={p.es_obligatorio} onChange={() => void alternarPosicion(p)} />
                    </label>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-sm">
                    <Button
                      variant="danger"
                      disabled={eliminandoPosicion === p.id}
                      onClick={() => void eliminarPosicion(p.id)}
                    >
                      {eliminandoPosicion === p.id ? 'Eliminando...' : 'Eliminar'}
                    </Button>
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
