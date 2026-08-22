ALTER TABLE cupos_area_rifa
ADD COLUMN IF NOT EXISTS id_tipo_rifa bigint REFERENCES tipo_rifa(id);

-- Conserva los cupos existentes tomando el tipo asociado a cada rifa.
UPDATE cupos_area_rifa AS cupo
SET id_tipo_rifa = rifa.id_tipo
FROM rifa
WHERE cupo.id_rifa = rifa.id
  AND cupo.id_tipo_rifa IS NULL;

ALTER TABLE cupos_area_rifa
ALTER COLUMN id_tipo_rifa SET NOT NULL;

ALTER TABLE cupos_area_rifa
DROP CONSTRAINT IF EXISTS cupos_area_rifa_id_rifa_fkey,
DROP CONSTRAINT IF EXISTS cupos_area_rifa_id_area_id_rifa_key;

ALTER TABLE cupos_area_rifa
DROP COLUMN IF EXISTS id_rifa;

ALTER TABLE cupos_area_rifa
ADD CONSTRAINT cupos_area_rifa_id_area_id_tipo_rifa_key UNIQUE (id_area, id_tipo_rifa);