import { useEffect, useMemo, useState } from 'react';
import Card from '../atomos/Card';
import Button from '../atomos/Button';
import Input from '../atomos/Input';
import Spinner from '../atomos/Spinner';
import AlertBanner from '../moleculas/AlertBanner';
import { configApi } from '../../api/config.api';
import { Cluster, SurtidoObligatorioData } from '../../types';

export default function ParametrosSurtido() {
  const [grupos, setGrupos] = useState<SurtidoObligatorioData[]>([]);
  const [ediciones, setEdiciones] = useState<Record<number, { es_obligatorio: boolean; cantidad_articulos: number | null }>>(
    {}
  );
  const [isLoading, setIsLoading] = useState(true);
  const [guardando, setGuardando] = useState<number | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  async function cargar() {
    setIsLoading(true);
    try {
      const data = await configApi.getSurtidoObligatorio();
      setGrupos(data);
      const base: Record<number, { es_obligatorio: boolean; cantidad_articulos: number | null }> = {};
      for (const g of data) {
        base[g.id_surtido] = { es_obligatorio: g.es_obligatorio, cantidad_articulos: g.cantidad_articulos };
      }
      setEdiciones(base);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void cargar();
  }, []);

  const porCluster = useMemo(() => {
    const grupo = new Map<Cluster, SurtidoObligatorioData[]>();
    for (const g of grupos) {
      const lista = grupo.get(g.u_cluster) ?? [];
      lista.push(g);
      grupo.set(g.u_cluster, lista);
    }
    return Array.from(grupo.entries());
  }, [grupos]);

  async function guardar(idSurtido: number) {
    setGuardando(idSurtido);
    setMensaje(null);
    try {
      const actualizado = await configApi.updateSurtidoObligatorio(idSurtido, ediciones[idSurtido]);
      setGrupos((prev) => prev.map((g) => (g.id_surtido === idSurtido ? actualizado : g)));
      // Se refrescan las vistas de inmediato (ver misma nota en ParametrosSubcategorias).
      await configApi.refrescarVistas();
      setMensaje({
        tipo: 'success',
        texto: `Grupo ${actualizado.u_surtido_n} de ${actualizado.u_cluster} actualizado (vistas refrescadas)`,
      });
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo guardar el grupo de surtido' });
    } finally {
      setGuardando(null);
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

      {porCluster.map(([cluster, items]) => (
        <Card key={cluster}>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Surtido obligatorio — {cluster}</h3>
          <div className="flex flex-col divide-y divide-gray-100">
            {items.map((g) => (
              <div key={g.id_surtido} className="flex flex-wrap items-end gap-3 py-3">
                <div className="w-24 text-sm font-medium text-gray-900">Grupo {g.u_surtido_n}</div>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={ediciones[g.id_surtido]?.es_obligatorio ?? false}
                    onChange={(e) =>
                      setEdiciones((prev) => ({
                        ...prev,
                        [g.id_surtido]: { ...prev[g.id_surtido], es_obligatorio: e.target.checked },
                      }))
                    }
                  />
                  Obligatorio
                </label>
                <div className="w-40">
                  <Input
                    label="Cantidad articulos (ref.)"
                    type="number"
                    min={0}
                    value={ediciones[g.id_surtido]?.cantidad_articulos ?? ''}
                    onChange={(e) =>
                      setEdiciones((prev) => ({
                        ...prev,
                        [g.id_surtido]: {
                          ...prev[g.id_surtido],
                          cantidad_articulos: e.target.value === '' ? null : Number(e.target.value),
                        },
                      }))
                    }
                  />
                </div>
                <Button disabled={guardando === g.id_surtido} onClick={() => void guardar(g.id_surtido)}>
                  {guardando === g.id_surtido ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
