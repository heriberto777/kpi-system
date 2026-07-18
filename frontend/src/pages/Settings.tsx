import DashboardTemplate from '../components/templates/DashboardTemplate';
import SettingsOrganism from '../components/organismos/Settings';

export default function SettingsPage() {
  return (
    <DashboardTemplate titulo="Configuracion" descripcion="Administra los horarios de sincronizacion y revisa la configuracion del sistema.">
      <SettingsOrganism />
    </DashboardTemplate>
  );
}
