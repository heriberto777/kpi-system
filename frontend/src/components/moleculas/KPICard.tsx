import { ReactNode } from 'react';
import Card from '../atomos/Card';

interface KPICardProps {
  titulo: string;
  valor: string | number;
  porcentaje?: number;
  tendencia?: 'up' | 'down' | 'flat';
  icono?: ReactNode;
}

const TENDENCIA_CLASES: Record<NonNullable<KPICardProps['tendencia']>, string> = {
  up: 'text-success',
  down: 'text-danger',
  flat: 'text-neutral',
};

const TENDENCIA_SIMBOLO: Record<NonNullable<KPICardProps['tendencia']>, string> = {
  up: '▲',
  down: '▼',
  flat: '►',
};

export default function KPICard({ titulo, valor, porcentaje, tendencia, icono }: KPICardProps) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">{titulo}</span>
        {icono && <span className="text-primary">{icono}</span>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-900">{valor}</span>
        {tendencia && porcentaje !== undefined && (
          <span className={`text-sm font-medium ${TENDENCIA_CLASES[tendencia]}`}>
            {TENDENCIA_SIMBOLO[tendencia]} {porcentaje.toFixed(1)}%
          </span>
        )}
      </div>
    </Card>
  );
}
