import Badge from '../atomos/Badge';
import Spinner from '../atomos/Spinner';

interface SyncStatusProps {
  isSyncing: boolean;
  progress: number;
  lastSync: Date | null;
}

function formatearTiempoRelativo(fecha: Date): string {
  const diffMs = Date.now() - fecha.getTime();
  const minutos = Math.floor(diffMs / 60000);
  if (minutos < 1) return 'hace instantes';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} d`;
}

export default function SyncStatus({ isSyncing, progress, lastSync }: SyncStatusProps) {
  if (isSyncing) {
    return (
      <div className="flex items-center gap-2">
        <Spinner size="sm" />
        <span className="text-sm text-gray-700">Sincronizando... {progress}%</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge color={lastSync ? 'success' : 'neutral'}>{lastSync ? 'Al dia' : 'Sin datos'}</Badge>
      <span className="text-sm text-gray-500">
        {lastSync ? `Ultima: ${formatearTiempoRelativo(lastSync)}` : 'Aun no se ha sincronizado'}
      </span>
    </div>
  );
}
