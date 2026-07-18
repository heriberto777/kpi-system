import { useState } from 'react';
import DashboardTemplate from '../components/templates/DashboardTemplate';
import ParametrosUmbrales from '../components/organismos/ParametrosUmbrales';
import ParametrosSubcategorias from '../components/organismos/ParametrosSubcategorias';
import ParametrosSurtido from '../components/organismos/ParametrosSurtido';
import ParametrosObjetivos from '../components/organismos/ParametrosObjetivos';
import ParametrosDiasHabiles from '../components/organismos/ParametrosDiasHabiles';

type Vista = 'umbrales' | 'subcategorias' | 'surtido' | 'objetivos' | 'dias-habiles';

const TABS: Array<{ value: Vista; label: string }> = [
  { value: 'umbrales', label: 'Umbrales' },
  { value: 'subcategorias', label: 'Subcategorías' },
  { value: 'surtido', label: 'Surtido Obligatorio' },
  { value: 'objetivos', label: 'Objetivos y Universo' },
  { value: 'dias-habiles', label: 'Días Hábiles' },
];

export default function Parametros() {
  const [vista, setVista] = useState<Vista>('umbrales');

  return (
    <DashboardTemplate
      titulo="Parámetros"
      descripcion="Umbrales de distribución, subcategorías activas, surtido obligatorio y días hábiles son editables aquí. Objetivos, universo y cuotas se alimentan del ERP y solo se visualizan."
    >
      <div className="mb-6 flex gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setVista(tab.value)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              vista === tab.value
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {vista === 'umbrales' && <ParametrosUmbrales />}
      {vista === 'subcategorias' && <ParametrosSubcategorias />}
      {vista === 'surtido' && <ParametrosSurtido />}
      {vista === 'objetivos' && <ParametrosObjetivos />}
      {vista === 'dias-habiles' && <ParametrosDiasHabiles />}
    </DashboardTemplate>
  );
}
