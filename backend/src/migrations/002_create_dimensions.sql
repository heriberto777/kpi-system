-- ============================================
-- 002: TABLAS DE DIMENSIONES
-- ============================================

-- --------------------------------------------
-- DIM_TIEMPO (Calendario)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS dim_tiempo (
    id_fecha DATE PRIMARY KEY,
    ano INT NOT NULL,
    mes INT NOT NULL,
    dia INT NOT NULL,
    trimestre INT NOT NULL,
    semana INT NOT NULL,
    nombre_mes VARCHAR(20) NOT NULL,
    nombre_dia VARCHAR(20) NOT NULL,
    es_fin_semana BOOLEAN NOT NULL
);

-- --------------------------------------------
-- DIM_CLIENTES
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS dim_clientes (
    id_cliente SERIAL PRIMARY KEY,
    codigo_cliente VARCHAR(50) UNIQUE NOT NULL,
    nombre_cliente VARCHAR(300) NOT NULL,
    categoria_cliente VARCHAR(50) NOT NULL,
    retail VARCHAR(50) NOT NULL, -- COLMADO, AUTOSERVICIO, MAYORISTA, OTROS
    u_cluster VARCHAR(20) NOT NULL, -- BRONZE, SILVER, GOLD
    vendedor_asignado VARCHAR(200),
    -- Segmento especial del cliente (catelli.CUBO_EXACTUS_FACTURA_LINEA_ORIGINAL.CAT_CLIENTE_ESP):
    -- ruta especial (U_SEMANA) si existe, si no el codigo del vendedor asignado.
    cat_cliente_esp VARCHAR(200),
    estado VARCHAR(20) NOT NULL DEFAULT 'Activo',
    fecha_creacion DATE,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------
-- DIM_ARTICULOS
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS dim_articulos (
    id_articulo SERIAL PRIMARY KEY,
    codigo_articulo VARCHAR(100) UNIQUE NOT NULL,
    descripcion VARCHAR(500),
    clasificacion_1 VARCHAR(50),
    clasificacion_2 VARCHAR(50) NOT NULL, -- SubCategoria: G21, G11, etc
    descripcion_subcategoria VARCHAR(500), -- Descripcion legible de clasificacion_2 (CATELLI.CLASIFICACION)
    u_surtido_n INT NOT NULL, -- Grupo 1-23
    articulo_del_proveedor VARCHAR(200),
    precio_unitario NUMERIC(10, 2),
    estado VARCHAR(20) NOT NULL DEFAULT 'Activo',
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------
-- DIM_SURTIDO_OBLIGATORIO
-- Mapea: CLUSTER -> GRUPO (U_SURTIDO_N)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS dim_surtido_obligatorio (
    id_surtido SERIAL PRIMARY KEY,
    u_cluster VARCHAR(20) NOT NULL,
    u_surtido_n INT NOT NULL,
    cantidad_articulos INT,
    es_obligatorio BOOLEAN NOT NULL DEFAULT TRUE,

    UNIQUE (u_cluster, u_surtido_n)
);

-- --------------------------------------------
-- DIM_CRITERIOS_DISTRIBUCION
-- Define umbrales de compra minima por RETAIL
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS dim_criterios_distribucion (
    id SERIAL PRIMARY KEY,
    retail VARCHAR(50) UNIQUE NOT NULL,
    minimo_compras INT NOT NULL,
    periodo_dias INT NOT NULL DEFAULT 30
);

-- --------------------------------------------
-- DIM_UNIVERSO_CLIENTE
-- Universo oficial de clientes por RETAIL y MES (desde dbo.universo_cliente del ERP)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS dim_universo_cliente (
    id SERIAL PRIMARY KEY,
    anno_mes VARCHAR(7) NOT NULL, -- YYYY-MM
    retail VARCHAR(50) NOT NULL,
    universo INT NOT NULL,
    estado VARCHAR(20),
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (anno_mes, retail)
);

-- --------------------------------------------
-- DIM_OBJETIVOS_DISTRIBUCION
-- Objetivos oficiales de distribucion por RETAIL, SUBCATEGORIA y MES
-- (desde dbo.distribuccion del ERP)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS dim_objetivos_distribucion (
    id SERIAL PRIMARY KEY,
    anno_mes VARCHAR(7) NOT NULL, -- YYYY-MM
    retail VARCHAR(50) NOT NULL,
    clasificacion_2 VARCHAR(50) NOT NULL,
    objetivo_clientes INT,
    objetivo_monto NUMERIC(15, 2),
    estado VARCHAR(20),
    -- Curado manualmente (no lo trae el ERP): que subcategorias se muestran en los reportes
    -- de Distribucion por defecto. El ETL solo lo fija en el INSERT inicial de cada
    -- (anno_mes, retail, clasificacion_2); nunca lo pisa en el UPDATE del UPSERT diario.
    activo BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (anno_mes, retail, clasificacion_2)
);

-- --------------------------------------------
-- DIM_VENDEDOR
-- Cantidad real de clientes asignados por vendedor (CATELLI.VENDEDOR + CATELLI.CLIENTE).
--
-- IMPORTANTE: la clave es (codigo_vendedor, retail_asignado), NO solo codigo_vendedor.
-- Un vendedor puede tener clientes repartidos en mas de un retail cuando maneja rutas
-- especiales (CLIENTE.U_SEMANA = MC1/MD1/WC1/WD1), asi que su cartera se parte en varias
-- filas (una por retail). Usar UNIQUE(codigo_vendedor) solamente pierde esas filas al
-- hacer UPSERT (se sobreescriben entre si).
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS dim_vendedor (
    id SERIAL PRIMARY KEY,
    codigo_vendedor VARCHAR(50) NOT NULL,
    nombre_vendedor VARCHAR(300),
    cantidad_cliente INT DEFAULT 0,
    vendedor_supervisor VARCHAR(50),
    retail_asignado VARCHAR(50) NOT NULL,
    al_vendedor VARCHAR(50),
    tipo_vendedor VARCHAR(50),
    estado VARCHAR(20) DEFAULT 'Activo',
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (codigo_vendedor, retail_asignado)
);

-- --------------------------------------------
-- DIM_CLASIFICACION
-- Descripcion legible de cada codigo de clasificacion (CATELLI.CLASIFICACION)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS dim_clasificacion (
    id SERIAL PRIMARY KEY,
    codigo_clasificacion VARCHAR(50) UNIQUE NOT NULL,
    descripcion_clasificacion VARCHAR(500),
    nivel_jerarquia VARCHAR(50),
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
