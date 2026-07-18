-- ============================================
-- 003: TABLA DE HECHOS
-- ============================================

CREATE TABLE IF NOT EXISTS fact_ventas (
    id_venta SERIAL PRIMARY KEY,
    id_factura VARCHAR(100) NOT NULL,
    id_cliente INT NOT NULL REFERENCES dim_clientes (id_cliente),
    id_articulo INT NOT NULL REFERENCES dim_articulos (id_articulo),
    id_fecha DATE NOT NULL REFERENCES dim_tiempo (id_fecha),
    cantidad INT NOT NULL,
    monto NUMERIC(12, 2),

    -- Campos desnormalizados para performance de lectura
    codigo_cliente VARCHAR(50),
    codigo_articulo VARCHAR(100),
    retail VARCHAR(50),
    u_cluster VARCHAR(20),
    vendedor VARCHAR(200),
    clasificacion_2 VARCHAR(50),
    u_surtido_n INT,

    UNIQUE (id_factura, id_articulo)
);
