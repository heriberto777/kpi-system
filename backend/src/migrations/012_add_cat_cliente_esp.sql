-- ============================================
-- 012: campo cat_cliente_esp en stg_clientes y dim_clientes
-- Segmento especial del cliente (ver catelli.CUBO_EXACTUS_FACTURA_LINEA_ORIGINAL.CAT_CLIENTE_ESP):
-- ruta especial (U_SEMANA: MC1/MD1/WC1/WD1) si existe, si no el codigo del vendedor asignado.
-- ============================================

ALTER TABLE stg_clientes
    ADD COLUMN IF NOT EXISTS cat_cliente_esp VARCHAR(200);

ALTER TABLE dim_clientes
    ADD COLUMN IF NOT EXISTS cat_cliente_esp VARCHAR(200);
