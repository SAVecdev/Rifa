ALTER TABLE logo_rifa
ADD COLUMN IF NOT EXISTS id_usuario bigint REFERENCES usuario(id);

-- Si logo_rifa ya tiene registros, asigna un usuario valido antes de ejecutar SET NOT NULL.
ALTER TABLE logo_rifa
ALTER COLUMN id_usuario SET NOT NULL;