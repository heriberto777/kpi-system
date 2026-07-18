-- ============================================
-- 007: dim_subcategoria_config
-- Fuente unica de verdad de que subcategorias estan "activas" (se muestran en los reportes
-- de Distribucion). Antes esto era una lista hardcodeada en el INSERT de upsertDimObjetivos
-- (postgresql.service.ts), que solo se aplicaba al crear una fila nueva de
-- dim_objetivos_distribucion: un mes futuro nunca visto volvia a usar la lista vieja, ignorando
-- cualquier cambio hecho desde la UI. Esta tabla, no tocada por el ETL, es la que la UI edita;
-- upsertDimObjetivos ahora lee de aqui para decidir el activo por defecto de cada fila nueva.
-- ============================================

CREATE TABLE IF NOT EXISTS dim_subcategoria_config (
    clasificacion_2 VARCHAR(50) PRIMARY KEY,
    descripcion VARCHAR(500),
    activo BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed inicial: todas las clasificacion_2 vistas hasta ahora en dim_objetivos_distribucion,
-- con el mismo activo que ya tienen hoy (no cambia el comportamiento actual al desplegar).
-- bool_or: si la misma subcategoria aparece activa en algun retail/mes, queda activa en general.
INSERT INTO dim_subcategoria_config (clasificacion_2, descripcion, activo)
SELECT
    od.clasificacion_2,
    MAX(da.descripcion_subcategoria),
    bool_or(od.activo)
FROM dim_objetivos_distribucion od
LEFT JOIN dim_articulos da ON da.clasificacion_2 = od.clasificacion_2
GROUP BY od.clasificacion_2
ON CONFLICT (clasificacion_2) DO NOTHING;

-- Respaldo para instalaciones nuevas (dim_objetivos_distribucion vacia porque aun no corrio
-- ningun sync): mantiene la misma lista curada por defecto que ya se usaba antes de esta
-- migracion, para no dejar el sistema sin ninguna subcategoria activa tras el primer sync real.
INSERT INTO dim_subcategoria_config (clasificacion_2, activo)
SELECT clasificacion_2, TRUE
FROM (VALUES ('G11'), ('G13'), ('G21'), ('G22'), ('G32'), ('G33'), ('G44')) AS defaults(clasificacion_2)
ON CONFLICT (clasificacion_2) DO NOTHING;
