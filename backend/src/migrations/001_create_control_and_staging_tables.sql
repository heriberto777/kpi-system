-- ============================================
-- 001: TABLAS DE CONTROL ETL + STAGING
-- ============================================

-- --------------------------------------------
-- CONTROL: sync_logs
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS sync_logs (
    id_sync SERIAL PRIMARY KEY,
    tipo_tabla VARCHAR(50) NOT NULL, -- clientes, articulos, ventas, kpis, materialized_views
    fecha_inicio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_fin TIMESTAMP,
    estado VARCHAR(20) NOT NULL DEFAULT 'iniciado', -- iniciado, en_proceso, completado, error
    registros_procesados INT DEFAULT 0,
    registros_insertados INT DEFAULT 0,
    registros_actualizados INT DEFAULT 0,
    registros_error INT DEFAULT 0,
    mensaje_error TEXT,
    disparado_manualmente BOOLEAN NOT NULL DEFAULT FALSE
);

-- --------------------------------------------
-- CONTROL: sync_metadata
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS sync_metadata (
    id SERIAL PRIMARY KEY,
    nombre_tabla VARCHAR(100) UNIQUE NOT NULL,
    ultima_sincronizacion TIMESTAMP,
    proximo_intento TIMESTAMP,
    estado VARCHAR(20) DEFAULT 'pendiente'
);

-- --------------------------------------------
-- CONTROL: cron_settings (habilitar/deshabilitar/horario de jobs desde Settings)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS cron_settings (
    id SERIAL PRIMARY KEY,
    nombre_job VARCHAR(100) UNIQUE NOT NULL, -- sync_clientes, sync_articulos, sync_ventas, calcular_kpis, refresh_views, telegram_resumen
    cron_expresion VARCHAR(50) NOT NULL,
    habilitado BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------
-- STAGING: stg_clientes (se trunca en cada sincronizacion)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS stg_clientes (
    codigo_cliente VARCHAR(50),
    nombre_cliente VARCHAR(300),
    categoria_cliente VARCHAR(50),
    u_cluster VARCHAR(20),
    vendedor_asignado VARCHAR(200),
    cat_cliente_esp VARCHAR(200),
    estado VARCHAR(20),
    fecha_creacion DATE
);

-- --------------------------------------------
-- STAGING: stg_articulos
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS stg_articulos (
    codigo_articulo VARCHAR(100),
    descripcion VARCHAR(500),
    clasificacion_1 VARCHAR(50),
    clasificacion_2 VARCHAR(50),
    descripcion_subcategoria VARCHAR(500),
    u_surtido_n INT,
    articulo_del_proveedor VARCHAR(200),
    precio_unitario NUMERIC(10, 2)
);

-- --------------------------------------------
-- STAGING: stg_facturas
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS stg_facturas (
    id_factura VARCHAR(100),
    codigo_cliente VARCHAR(50),
    fecha_factura DATE,
    estado_factura VARCHAR(20)
);

-- --------------------------------------------
-- STAGING: stg_factura_lineas
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS stg_factura_lineas (
    id_factura VARCHAR(100),
    codigo_articulo VARCHAR(100),
    cantidad INT,
    precio_unitario NUMERIC(10, 2),
    monto_total NUMERIC(12, 2)
);

-- --------------------------------------------
-- STAGING: stg_universo_cliente (desde dbo.universo_cliente en el ERP)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS stg_universo_cliente (
    anno_mes VARCHAR(7),
    retail VARCHAR(50),
    universo INT,
    estado VARCHAR(20)
);

-- --------------------------------------------
-- STAGING: stg_objetivos_distribucion (desde dbo.distribuccion en el ERP)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS stg_objetivos_distribucion (
    anno_mes VARCHAR(7),
    retail VARCHAR(50),
    clasificacion_2 VARCHAR(50),
    objetivo_clientes INT,
    objetivo_monto NUMERIC(15, 2),
    estado VARCHAR(20)
);

-- --------------------------------------------
-- STAGING: stg_vendedor (desde CATELLI.VENDEDOR + CATELLI.CLIENTE en el ERP)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS stg_vendedor (
    codigo_vendedor VARCHAR(50),
    nombre_vendedor VARCHAR(300),
    cantidad_cliente INT,
    vendedor_supervisor VARCHAR(50),
    retail_asignado VARCHAR(50),
    al_vendedor VARCHAR(50),
    tipo_vendedor VARCHAR(50)
);

-- --------------------------------------------
-- STAGING: stg_clasificacion (desde CATELLI.CLASIFICACION en el ERP)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS stg_clasificacion (
    codigo_clasificacion VARCHAR(50),
    descripcion_clasificacion VARCHAR(500),
    nivel_jerarquia VARCHAR(50)
);
