ALTER TABLE logo_rifa DROP CONSTRAINT IF EXISTS logo_rifa_id_rifa_fkey;

ALTER TABLE logo_rifa DROP COLUMN IF EXISTS id_rifa;

ALTER TABLE logo_rifa
ADD COLUMN IF NOT EXISTS id_tipo_rifa bigint REFERENCES tipo_rifa(id),
ADD COLUMN IF NOT EXISTS id_area bigint REFERENCES area(id);

ALTER TABLE logo_rifa
ALTER COLUMN id_tipo_rifa SET NOT NULL,
ALTER COLUMN id_area SET NOT NULL;