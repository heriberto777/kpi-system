import DashboardTemplate from '../components/templates/DashboardTemplate';
import SurtidoMandatorioResumen from '../components/organismos/SurtidoMandatorioResumen';

export default function SurtidoMandatorio() {
  return (
    <DashboardTemplate
      titulo="Surtido Mandatorio"
      descripcion="Cobertura, logro y proyecciones de posiciones de surtido obligatorias por vendedor y cluster."
    >
      <SurtidoMandatorioResumen />
    </DashboardTemplate>
  );
}
