-- ============================================
-- 009: campo "activo" en dim_objetivos_distribucion (subcategorias curadas)
-- ============================================

ALTER TABLE dim_objetivos_distribucion
    ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT FALSE;

-- Lista curada manualmente (confirmada por el negocio). Se reafirma en cada corrida por si
-- se agregan meses nuevos, sin afectar otras subcategorias que se hayan activado a mano.
UPDATE dim_objetivos_distribucion
   SET activo = TRUE
 WHERE clasificacion_2 IN ('G11', 'G13', 'G21', 'G22', 'G32', 'G33', 'G44');
