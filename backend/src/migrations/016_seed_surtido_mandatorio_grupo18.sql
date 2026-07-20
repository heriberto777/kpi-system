-- ============================================
-- 016: Grupo 18 de Surtido Mandatorio, confirmado con el negocio: aplica solo a Silver.
-- Quedo pendiente en la migracion 015 porque las celdas de cluster de esa fila estaban
-- cortadas/ilegibles en la hoja original.
-- ============================================

INSERT INTO dim_surtido_mandatorio_posicion (posicion_surtido, u_cluster, es_obligatorio) VALUES
    (18, 'SILVER', TRUE)
ON CONFLICT (posicion_surtido, u_cluster) DO NOTHING;
