import { useState } from 'react';
import Icon from '../atomos/Icon';

type Tipo = 'success' | 'error' | 'warning';

interface AlertBannerProps {
  tipo: Tipo;
  mensaje: string;
  onDismiss?: () => void;
}

const TIPO_CLASES: Record<Tipo, string> = {
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  error: 'bg-red-50 text-red-800 border-red-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
};

const TIPO_ICONO: Record<Tipo, 'check' | 'error' | 'clock'> = {
  success: 'check',
  error: 'error',
  warning: 'clock',
};

export default function AlertBanner({ tipo, mensaje, onDismiss }: AlertBannerProps) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <div className={`flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm ${TIPO_CLASES[tipo]}`}>
      <div className="flex items-center gap-2">
        <Icon name={TIPO_ICONO[tipo]} className="h-5 w-5 flex-shrink-0" />
        <span>{mensaje}</span>
      </div>
      <button
        type="button"
        className="text-current opacity-60 hover:opacity-100"
        onClick={() => {
          setVisible(false);
          onDismiss?.();
        }}
        aria-label="Cerrar"
      >
        ✕
      </button>
    </div>
  );
}
