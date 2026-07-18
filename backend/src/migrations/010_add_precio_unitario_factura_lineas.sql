-- ============================================
-- 010: agrega precio_unitario a stg_factura_lineas
-- (correccion de esquema ERP: CATELLI.FACTURA_LINEA expone precio_unitario
--  por linea, usado para calcular monto_total = cantidad * precio_unitario)
-- ============================================

ALTER TABLE stg_factura_lineas
    ADD COLUMN IF NOT EXISTS precio_unitario NUMERIC(10, 2);
