CREATE TABLE IF NOT EXISTS tipo_rifa_area (
    id bigserial PRIMARY KEY,
    id_tipo_rifa bigint NOT NULL REFERENCES tipo_rifa(id) ON DELETE CASCADE,
    id_area bigint NOT NULL REFERENCES area(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id_tipo_rifa, id_area)
);

CREATE INDEX IF NOT EXISTS idx_tipo_rifa_area_id_tipo_rifa
    ON tipo_rifa_area (id_tipo_rifa);

CREATE INDEX IF NOT EXISTS idx_tipo_rifa_area_id_area
    ON tipo_rifa_area (id_area);
