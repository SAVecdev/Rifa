-- Relacion muchos-a-muchos: un vendedor puede estar asignado a varios supervisores.
CREATE TABLE IF NOT EXISTS supervisor_vendedor (
    id bigserial PRIMARY KEY,
    id_supervisor bigint NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    id_vendedor bigint NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id_supervisor, id_vendedor)
);

CREATE INDEX IF NOT EXISTS idx_supervisor_vendedor_supervisor ON supervisor_vendedor(id_supervisor);
CREATE INDEX IF NOT EXISTS idx_supervisor_vendedor_vendedor ON supervisor_vendedor(id_vendedor);

NOTIFY pgrst, 'reload schema';
