import DashboardTemplate from '../components/templates/DashboardTemplate';
import ETLDashboard from '../components/organismos/ETLDashboard';

export default function Dashboard() {
  return (
    <DashboardTemplate titulo="Panel de Control ETL" descripcion="Monitorea y controla las sincronizaciones automaticas.">
      <ETLDashboard />
    </DashboardTemplate>
  );
}
