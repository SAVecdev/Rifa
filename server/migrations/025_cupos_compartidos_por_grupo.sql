-- Modelo correcto para "algunas areas comparten un mismo cupo y otras son unicas"
-- No se usa NULL en id_area para el caso global.
-- Se crea un grupo de areas compartidas por tipo de rifa.

CREATE TABLE IF NOT EXISTS tipo_rifa_area_grupo (
    id bigserial PRIMARY KEY,
    id_tipo_rifa bigint NOT NULL REFERENCES tipo_rifa(id) ON DELETE CASCADE,
    nombre text NOT NULL DEFAULT 'grupo_compartido',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tipo_rifa_area_grupo_relacion (
    id bigserial PRIMARY KEY,
    id_tipo_rifa bigint NOT NULL REFERENCES tipo_rifa(id) ON DELETE CASCADE,
    id_area bigint NOT NULL REFERENCES area(id) ON DELETE CASCADE,
    id_grupo_compartido bigint NOT NULL REFERENCES tipo_rifa_area_grupo(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id_tipo_rifa, id_area),
    UNIQUE (id_tipo_rifa, id_grupo_compartido, id_area)
);

CREATE TABLE IF NOT EXISTS cupos_area_rifa_compartido (
    id bigserial PRIMARY KEY,
    id_tipo_rifa bigint NOT NULL REFERENCES tipo_rifa(id) ON DELETE CASCADE,
    id_grupo_compartido bigint NOT NULL REFERENCES tipo_rifa_area_grupo(id) ON DELETE CASCADE,
    c_2digitos numeric(12,2) NOT NULL DEFAULT 0,
    c_3digitos numeric(12,2) NOT NULL DEFAULT 0,
    c_4digitos numeric(12,2) NOT NULL DEFAULT 0,
    c_5digitos numeric(12,2) NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id_tipo_rifa, id_grupo_compartido)
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cupos_area_rifa_compartido_updated_at ON cupos_area_rifa_compartido;
CREATE TRIGGER trg_cupos_area_rifa_compartido_updated_at
BEFORE UPDATE ON cupos_area_rifa_compartido
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Ejemplo de uso:
-- 1) Crear un grupo compartido para el tipo 7
-- INSERT INTO tipo_rifa_area_grupo (id_tipo_rifa, nombre) VALUES (7, 'grupo_area_1_2_3');
-- 2) Asociar las areas que comparten ese grupo
-- INSERT INTO tipo_rifa_area_grupo_relacion (id_tipo_rifa, id_area, id_grupo_compartido) VALUES
--   (7, 1, 1),
--   (7, 2, 1),
--   (7, 3, 1);
-- 3) Configurar el cupo compartido para ese grupo
-- INSERT INTO cupos_area_rifa_compartido (id_tipo_rifa, id_grupo_compartido, c_2digitos, c_3digitos, c_4digitos, c_5digitos)
-- VALUES (7, 1, 90, 90, 90, 90);

-- Las areas no incluidas en ningun grupo siguen usando la tabla normal cupos_area_rifa
-- y cada area tiene su cupo individual por tipo.
