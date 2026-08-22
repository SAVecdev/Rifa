-- Permite que el cupo de un tipo de rifa sea compartido entre todas las areas
ALTER TABLE cupos_area_rifa
ALTER COLUMN id_area DROP NOT NULL;

-- Un mismo tipo de rifa solo puede tener un cupo global compartido
CREATE UNIQUE INDEX IF NOT EXISTS cupos_area_rifa_tipo_global_unq
ON cupos_area_rifa (id_tipo_rifa)
WHERE id_area IS NULL;

-- Mantiene la regla de unicidad por area + tipo para cupos locales
CREATE UNIQUE INDEX IF NOT EXISTS cupos_area_rifa_area_tipo_unq
ON cupos_area_rifa (id_area, id_tipo_rifa)
WHERE id_area IS NOT NULL;

-- Si quieres mantener compatibilidad con datos existentes, este bloque
-- elimina cualquier duplicado previo por area/tipo antes de crear la restriccion definitiva.
-- Solo activa si tu base ya tiene registros duplicados.
-- DELETE FROM cupos_area_rifa a
-- USING cupos_area_rifa b
-- WHERE a.id < b.id
--   AND a.id_area IS NOT DISTINCT FROM b.id_area
--   AND a.id_tipo_rifa = b.id_tipo_rifa;
