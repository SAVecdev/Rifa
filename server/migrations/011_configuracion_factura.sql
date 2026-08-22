CREATE TABLE IF NOT EXISTS configuracion_factura (
    id bigserial PRIMARY KEY,
    id_usuario bigint NOT NULL UNIQUE REFERENCES usuario(id),
    nombre_empresa varchar(255),
    identificacion_empresa varchar(100),
    telefono_empresa varchar(20),
    direccion_empresa varchar(255),
    mensaje_encabezado text,
    mensaje_pie text,
    tipo_letra varchar(100) NOT NULL DEFAULT 'sans-serif',
    tamano_letra integer NOT NULL DEFAULT 12,
    color_primario varchar(7) NOT NULL DEFAULT '#000000',
    color_secundario varchar(7) NOT NULL DEFAULT '#FFFFFF',
    mostrar_logo boolean NOT NULL DEFAULT true,
    mostrar_premios boolean NOT NULL DEFAULT true,
    orden_premios jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (tamano_letra BETWEEN 8 AND 36)
);

DROP TRIGGER IF EXISTS trg_configuracion_factura_updated_at ON configuracion_factura;

CREATE TRIGGER trg_configuracion_factura_updated_at
BEFORE UPDATE ON configuracion_factura
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

NOTIFY pgrst, 'reload schema';