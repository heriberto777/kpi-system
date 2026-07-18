import { useEffect, useState } from 'react';
import Card from '../atomos/Card';
import Button from '../atomos/Button';
import Badge from '../atomos/Badge';
import Spinner from '../atomos/Spinner';
import AlertBanner from '../moleculas/AlertBanner';
import { configApi } from '../../api/config.api';
import { SubcategoriaConfigData } from '../../types';

export default function ParametrosSubcategorias() {
  const [subcategorias, setSubcategorias] = useState<SubcategoriaConfigData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  async function cargar() {
    setIsLoading(true);
    try {
      setSubcategorias(await configApi.getSubcategorias());
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void cargar();
  }, []);

  async function alternar(sub: SubcategoriaConfigData) {
    setGuardando(sub.clasificacion_2);
    setMensaje(null);
    try {
      const actualizado = await configApi.setSubcategoriaActiva(sub.clasificacion_2, !sub.activo);
      setSubcategorias((prev) =>
        prev.map((s) => (s.clasificacion_2 === sub.clasificacion_2 ? actualizado : s))
      );
      // Se refrescan las vistas de inmediato: el toggle cambia las tablas base al instante, pero
      // las pantallas de KPIs leen vistas materializadas que solo se actualizan al refrescarlas.
      await configApi.refrescarVistas();
      setMensaje({
        tipo: 'success',
        texto: `${sub.clasificacion_2} ahora esta ${actualizado.activo ? 'activa' : 'inactiva'} (vistas refrescadas)`,
      });
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo cambiar el estado de la subcategoria' });
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

      <Card>
        <h3 className="mb-1 text-sm font-semibold text-gray-700">Subcategorias mostradas en Distribucion</h3>
        <p className="mb-3 text-xs text-gray-400">
          Solo las subcategorias activas aparecen en las tablas de Distribucion (Global y Por Vendedor). El cambio
          aplica de inmediato a los meses ya sincronizados y a los que traiga el ERP en el futuro.
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Codigo</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Descripcion</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Estado</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Accion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {subcategorias.map((sub) => (
                <tr key={sub.clasificacion_2}>
                  <td className="whitespace-nowrap px-4 py-2 text-sm font-medium text-gray-900">
                    {sub.clasificacion_2}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{sub.descripcion ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-sm">
                    <Badge color={sub.activo ? 'success' : 'neutral'}>{sub.activo ? 'Activa' : 'Inactiva'}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-sm">
                    <Button
                      variant="secondary"
                      disabled={guardando === sub.clasificacion_2}
                      onClick={() => void alternar(sub)}
                    >
                      {guardando === sub.clasificacion_2 ? 'Guardando...' : sub.activo ? 'Desactivar' : 'Activar'}
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
