ALTER TABLE opciones_premios
ADD COLUMN IF NOT EXISTS id_area bigint REFERENCES area(id);

-- Si ya existen opciones, asigna un area valida antes de ejecutar SET NOT NULL.
ALTER TABLE opciones_premios
DROP CONSTRAINT IF EXISTS opciones_premios_id_rifa_nivel_premio_key;

ALTER TABLE opciones_premios
ADD CONSTRAINT opciones_premios_id_rifa_id_area_nivel_premio_key
UNIQUE (id_rifa, id_area, nivel_premio);

ALTER TABLE opciones_premios
ALTER COLUMN id_area SET NOT NULL;