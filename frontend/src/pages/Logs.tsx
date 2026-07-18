import DashboardTemplate from '../components/templates/DashboardTemplate';
import SyncHistory from '../components/organismos/SyncHistory';

export default function Logs() {
  return (
    <DashboardTemplate titulo="Historial de Sincronizaciones" descripcion="Consulta y filtra el historial completo de sincronizaciones ETL.">
      <SyncHistory />
    </DashboardTemplate>
  );
}
