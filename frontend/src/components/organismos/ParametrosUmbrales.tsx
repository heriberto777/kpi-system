import { useEffect, useState } from 'react';
import Card from '../atomos/Card';
import Input from '../atomos/Input';
import Button from '../atomos/Button';
import Spinner from '../atomos/Spinner';
import AlertBanner from '../moleculas/AlertBanner';
import { configApi } from '../../api/config.api';
import { CriterioDistribucionData, Retail } from '../../types';

const RETAIL_LABELS: Record<Retail, string> = {
  COLMADO: 'Colmado',
  AUTOSERVICIO: 'Autoservicio',
  MAYORISTA: 'Mayorista',
  OTROS: 'Otros',
};

export default function ParametrosUmbrales() {
  const [criterios, setCriterios] = useState<CriterioDistribucionData[]>([]);
  const [ediciones, setEdiciones] = useState<Record<Retail, { minimo_compras: number; periodo_dias: number }>>(
    {} as Record<Retail, { minimo_compras: number; periodo_dias: number }>
  );
  const [isLoading, setIsLoading] = useState(true);
  const [guardando, setGuardando] = useState<Retail | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  async function cargar() {
    setIsLoading(true);
    try {
      const data = await configApi.getCriteriosDistribucion();
      setCriterios(data);
      const base: Record<Retail, { minimo_compras: number; periodo_dias: number }> = {} as Record<
        Retail,
        { minimo_compras: number; periodo_dias: number }
      >;
      for (const c of data) {
        base[c.retail] = { minimo_compras: c.minimo_compras, periodo_dias: c.periodo_dias };
      }
      setEdiciones(base);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void cargar();
  }, []);

  async function guardar(retail: Retail) {
    setGuardando(retail);
    setMensaje(null);
    try {
      const actualizado = await configApi.updateCriterioDistribucion(retail, ediciones[retail]);
      setCriterios((prev) => prev.map((c) => (c.retail === retail ? actualizado : c)));
      // Se refrescan las vistas de inmediato: sin esto, el cambio queda guardado pero no se ve
      // reflejado en ninguna pantalla hasta el proximo refresco (manual o del cron nocturno).
      await configApi.refrescarVistas();
      setMensaje({ tipo: 'success', texto: `Umbral de ${RETAIL_LABELS[retail]} actualizado y vistas refrescadas` });
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo guardar el umbral' });
    } finally {
      setGuardando(null);
    }
  }

  async function refrescarVistas() {
    setRefrescando(true);
    setMensaje(null);
    try {
      await configApi.refrescarVistas();
      setMensaje({ tipo: 'success', texto: 'Vistas materializadas refrescadas' });
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudieron refrescar las vistas' });
    } finally {
      setRefrescando(false);
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
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Umbral minimo de compras por Retail</h3>
            <p className="text-xs text-gray-400">
              Cantidad neta de unidades que un cliente debe comprar en una subcategoria dentro del mes para contar
              como "compro" en Distribucion (Global y Por Vendedor).
            </p>
          </div>
          <Button variant="secondary" disabled={refrescando} onClick={() => void refrescarVistas()}>
            {refrescando ? 'Refrescando...' : 'Refrescar vistas ahora'}
          </Button>
        </div>
        <div className="flex flex-col divide-y divide-gray-100">
          {criterios.map((c) => (
            <div key={c.retail} className="flex flex-wrap items-end gap-3 py-3">
              <div className="w-32 text-sm font-medium text-gray-900">{RETAIL_LABELS[c.retail]}</div>
              <div className="w-32">
                <Input
                  label="Minimo compras"
                  type="number"
                  min={1}
                  value={ediciones[c.retail]?.minimo_compras ?? ''}
                  onChange={(e) =>
                    setEdiciones((prev) => ({
                      ...prev,
                      [c.retail]: { ...prev[c.retail], minimo_compras: Number(e.target.value) },
                    }))
                  }
                />
              </div>
              <div className="w-32">
                <Input
                  label="Periodo (dias)"
                  type="number"
                  min={1}
                  value={ediciones[c.retail]?.periodo_dias ?? ''}
                  onChange={(e) =>
                    setEdiciones((prev) => ({
                      ...prev,
                      [c.retail]: { ...prev[c.retail], periodo_dias: Number(e.target.value) },
                    }))
                  }
                />
              </div>
              <Button disabled={guardando === c.retail} onClick={() => void guardar(c.retail)}>
                {guardando === c.retail ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
