-- ============================================
-- 015: Semilla de dim_surtido_mandatorio_posicion
-- Catalogo real confirmado por el negocio (hoja "parametros_surtido": Grupo x Silver/Bronze/Gold).
-- Los grupos 13 y 22 no existen en la hoja (igual que el Surtido existente, que tambien los
-- excluye). El grupo 18 quedo sin ningun cluster confirmado (celdas cortadas/ilegibles en la
-- hoja original) -- pendiente de confirmar con el negocio, no se siembra a proposito.
-- ============================================

INSERT INTO dim_surtido_mandatorio_posicion (posicion_surtido, u_cluster, es_obligatorio) VALUES
    (1, 'BRONZE', TRUE), (1, 'SILVER', TRUE), (1, 'GOLD', TRUE),
    (2, 'BRONZE', TRUE), (2, 'SILVER', TRUE), (2, 'GOLD', TRUE),
    (3, 'BRONZE', TRUE), (3, 'SILVER', TRUE), (3, 'GOLD', TRUE),
    (4, 'BRONZE', TRUE), (4, 'SILVER', TRUE), (4, 'GOLD', TRUE),
    (5, 'BRONZE', TRUE), (5, 'SILVER', TRUE), (5, 'GOLD', TRUE),
    (6, 'BRONZE', TRUE), (6, 'SILVER', TRUE), (6, 'GOLD', TRUE),
    (7, 'BRONZE', TRUE), (7, 'SILVER', TRUE),
    (8, 'BRONZE', TRUE), (8, 'SILVER', TRUE), (8, 'GOLD', TRUE),
    (9, 'BRONZE', TRUE), (9, 'SILVER', TRUE),
    (10, 'BRONZE', TRUE), (10, 'SILVER', TRUE), (10, 'GOLD', TRUE),
    (11, 'BRONZE', TRUE), (11, 'SILVER', TRUE), (11, 'GOLD', TRUE),
    (12, 'BRONZE', TRUE), (12, 'SILVER', TRUE), (12, 'GOLD', TRUE),
    (14, 'BRONZE', TRUE), (14, 'SILVER', TRUE),
    (15, 'BRONZE', TRUE), (15, 'SILVER', TRUE),
    (16, 'BRONZE', TRUE), (16, 'SILVER', TRUE),
    (17, 'BRONZE', TRUE), (17, 'SILVER', TRUE),
    (19, 'BRONZE', TRUE),
    (20, 'BRONZE', TRUE),
    (21, 'SILVER', TRUE),
    (23, 'SILVER', TRUE)
ON CONFLICT (posicion_surtido, u_cluster) DO NOTHING;
