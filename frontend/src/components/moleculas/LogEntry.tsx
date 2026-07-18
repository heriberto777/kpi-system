import Badge from '../atomos/Badge';
import { SyncLog } from '../../types';

interface LogEntryProps {
  log: SyncLog;
  onClick?: (log: SyncLog) => void;
}

const ESTADO_COLOR: Record<SyncLog['estado'], 'success' | 'error' | 'warning' | 'info'> = {
  completado: 'success',
  error: 'error',
  en_proceso: 'warning',
  iniciado: 'info',
};

export default function LogEntry({ log, onClick }: LogEntryProps) {
  return (
    <tr
      className={onClick ? 'cursor-pointer hover:bg-gray-50' : ''}
      onClick={() => onClick?.(log)}
    >
      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">
        {new Date(log.fecha_inicio).toLocaleString('es-DO')}
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-sm font-medium text-gray-900">{log.tipo_tabla}</td>
      <td className="whitespace-nowrap px-4 py-2">
        <Badge color={ESTADO_COLOR[log.estado]}>{log.estado}</Badge>
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{log.registros_procesados}</td>
      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">
        {log.disparado_manualmente ? 'Manual' : 'Automatico'}
      </td>
    </tr>
  );
}
