-- ============================================
-- 008: INDICES
-- ============================================

-- sync_logs
CREATE INDEX IF NOT EXISTS idx_sync_logs_fecha ON sync_logs (fecha_inicio DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_tipo ON sync_logs (tipo_tabla);
CREATE INDEX IF NOT EXISTS idx_sync_logs_estado ON sync_logs (estado);

-- dim_tiempo
CREATE INDEX IF NOT EXISTS idx_dim_tiempo_ano_mes ON dim_tiempo (ano, mes);

-- dim_clientes
CREATE INDEX IF NOT EXISTS idx_dim_clientes_cluster ON dim_clientes (u_cluster);
CREATE INDEX IF NOT EXISTS idx_dim_clientes_retail ON dim_clientes (retail);
CREATE INDEX IF NOT EXISTS idx_dim_clientes_vendedor ON dim_clientes (vendedor_asignado);
CREATE INDEX IF NOT EXISTS idx_dim_clientes_estado ON dim_clientes (estado);

-- dim_articulos
CREATE INDEX IF NOT EXISTS idx_dim_articulos_surtido ON dim_articulos (u_surtido_n);
CREATE INDEX IF NOT EXISTS idx_dim_articulos_subcategoria ON dim_articulos (clasificacion_2);

-- dim_surtido_obligatorio
CREATE INDEX IF NOT EXISTS idx_surtido_cluster ON dim_surtido_obligatorio (u_cluster);
CREATE INDEX IF NOT EXISTS idx_surtido_grupo ON dim_surtido_obligatorio (u_surtido_n);

-- dim_universo_cliente
CREATE INDEX IF NOT EXISTS idx_dim_universo_anno_mes ON dim_universo_cliente (anno_mes);
CREATE INDEX IF NOT EXISTS idx_dim_universo_retail ON dim_universo_cliente (retail);

-- dim_objetivos_distribucion
CREATE INDEX IF NOT EXISTS idx_dim_objetivos_anno_mes ON dim_objetivos_distribucion (anno_mes);
CREATE INDEX IF NOT EXISTS idx_dim_objetivos_retail ON dim_objetivos_distribucion (retail);
CREATE INDEX IF NOT EXISTS idx_dim_objetivos_subcategoria ON dim_objetivos_distribucion (clasificacion_2);

-- dim_vendedor
CREATE INDEX IF NOT EXISTS idx_dim_vendedor_codigo ON dim_vendedor (codigo_vendedor);
CREATE INDEX IF NOT EXISTS idx_dim_vendedor_supervisor ON dim_vendedor (vendedor_supervisor);
CREATE INDEX IF NOT EXISTS idx_dim_vendedor_retail ON dim_vendedor (retail_asignado);

-- fact_ventas
CREATE INDEX IF NOT EXISTS idx_fact_ventas_cliente ON fact_ventas (id_cliente);
CREATE INDEX IF NOT EXISTS idx_fact_ventas_fecha ON fact_ventas (id_fecha);
CREATE INDEX IF NOT EXISTS idx_fact_ventas_articulo ON fact_ventas (id_articulo);
CREATE INDEX IF NOT EXISTS idx_fact_ventas_retail ON fact_ventas (retail);
CREATE INDEX IF NOT EXISTS idx_fact_ventas_cluster ON fact_ventas (u_cluster);
CREATE INDEX IF NOT EXISTS idx_fact_ventas_vendedor ON fact_ventas (vendedor);
CREATE INDEX IF NOT EXISTS idx_fact_ventas_fecha_cliente ON fact_ventas (id_fecha, id_cliente);
CREATE INDEX IF NOT EXISTS idx_fact_ventas_subcategoria ON fact_ventas (clasificacion_2);
