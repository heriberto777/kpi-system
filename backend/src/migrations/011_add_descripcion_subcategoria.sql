-- ============================================
-- 011: agrega descripcion_subcategoria a stg_articulos y dim_articulos
-- (CATELLI.CLASIFICACION.DESCRIPCION enlazada por CLASIFICACION_2)
-- ============================================

ALTER TABLE stg_articulos
    ADD COLUMN IF NOT EXISTS descripcion_subcategoria VARCHAR(500);

ALTER TABLE dim_articulos
    ADD COLUMN IF NOT EXISTS descripcion_subcategoria VARCHAR(500);
