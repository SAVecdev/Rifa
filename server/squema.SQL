-- Esquema corregido para Supabase / PostgreSQL
-- Base para un sistema de rifas con roles: administrador, supervisor, vendedor, cliente

CREATE TABLE area (
    id bigserial PRIMARY KEY,
    nombre varchar(255) NOT NULL,
    descripcion text,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE usuario (
    id bigserial PRIMARY KEY,
    nombre varchar(255) NOT NULL,
    correo varchar(255) NOT NULL UNIQUE,
    password_hash varchar(255) NOT NULL,
    direccion varchar(255),
    rol text NOT NULL CHECK (rol IN ('administrador', 'supervisor', 'vendedor', 'cliente')),
    saldo numeric(12,2) NOT NULL DEFAULT 0,
    activo boolean NOT NULL DEFAULT true,
    foto_perfil varchar(255),
    telefono varchar(20),
    id_area bigint REFERENCES area(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE imagenes (
    id bigserial PRIMARY KEY,
    nombre varchar(255),
    ruta text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tipo_rifa (
    id bigserial PRIMARY KEY,
    nombre varchar(255) NOT NULL,
    descripcion text,
    -- vamos a agregar 2 campos para definir los colores para personalizar la plataforma de rifas
    color_primario varchar(7) NOT NULL DEFAULT '#000000', -- Color en formato hexadecimal
    color_secundario varchar(7) NOT NULL DEFAULT '#FFFFFF', -- Color en formato hexadecimal
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rifa (
    id bigserial PRIMARY KEY,
    nombre varchar(255) NOT NULL,
    sorteos integer NOT NULL DEFAULT 1,
    id_imagen bigint REFERENCES imagenes(id),
    id_tipo bigint REFERENCES tipo_rifa(id),
    fecha_hora_juego timestamptz NOT NULL,
    fecha_hora_finalizacion timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE factura (
    id bigserial PRIMARY KEY,
    numero_factura varchar(50) NOT NULL,
    id_usuario bigint NOT NULL REFERENCES usuario(id),
    eliminada boolean NOT NULL DEFAULT false,
    fecha_eliminada timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id_usuario, numero_factura)
);

CREATE TABLE configuracion_factura (
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
    modelo_factura varchar(30) NOT NULL DEFAULT 'clasica',
    mostrar_logo boolean NOT NULL DEFAULT true,
    mostrar_premios boolean NOT NULL DEFAULT true,
    orden_premios jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (tamano_letra BETWEEN 8 AND 36),
    CHECK (modelo_factura IN ('clasica', 'compacta', 'resumen', 'agrupada'))
);

CREATE TABLE venta (
    id bigserial PRIMARY KEY,
    id_usuario bigint NOT NULL REFERENCES usuario(id),
    id_rifa bigint NOT NULL REFERENCES rifa(id),
    id_factura bigint REFERENCES factura(id),
    fecha timestamptz NOT NULL DEFAULT now(),
    numero varchar(6) NOT NULL,
    cantidad integer NOT NULL DEFAULT 1,
    valor numeric(12,2) NOT NULL,
    total numeric(12,2) NOT NULL,
    premio_01 numeric(12,2),
    premio_02 numeric(12,2),
    premio_03 numeric(12,2),
    premio_04 numeric(12,2),
    premio_05 numeric(12,2),
    premio_06 numeric(12,2),
    premio_07 numeric(12,2),
    premio_08 numeric(12,2),
    premio_09 numeric(12,2),
    premio_10 numeric(12,2),
    pagada boolean NOT NULL DEFAULT false,
    fecha_pago timestamptz,
    eliminada boolean NOT NULL DEFAULT false,
    fecha_eliminada timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE numero_ganadores (
    id bigserial PRIMARY KEY,
    id_rifa bigint NOT NULL REFERENCES rifa(id),
    nivel_premio integer NOT NULL,
    numero_ganador varchar(255) NOT NULL,
    sorteo integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ganadores (
    id bigserial PRIMARY KEY,
    id_usuario bigint NOT NULL REFERENCES usuario(id),
    id_factura bigint REFERENCES factura(id),
    id_numero_ganador bigint REFERENCES numero_ganadores(id),
    numerol varchar(10) NOT NULL,
    fecha date NOT NULL,
    saldo_premio numeric(12,2) NOT NULL DEFAULT 0,
    nivel_premio integer NOT NULL,
    id_area bigint REFERENCES area(id),
    pagada boolean NOT NULL DEFAULT false,
    fecha_hora_pago timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE opciones_premios (
    id bigserial PRIMARY KEY,
    id_tipo_rifa bigint NOT NULL REFERENCES tipo_rifa(id),
    id_area bigint NOT NULL REFERENCES area(id),
    nivel_premio integer NOT NULL,
    saldo_ganado numeric(12,2) NOT NULL,
    valor_premio numeric(12,2) NOT NULL,
    descripcion text,
    digitos integer NOT NULL,
    UNIQUE (id_tipo_rifa, id_area, nivel_premio, digitos, saldo_ganado)
);

CREATE TABLE session (
    id bigserial PRIMARY KEY,
    id_usuario bigint NOT NULL REFERENCES usuario(id),
    token_sesion varchar(255) NOT NULL,
    ip varchar(45),
    user_agent text,
    navegador varchar(100),
    sistema_operativo varchar(100),
    fecha_inicio timestamptz NOT NULL DEFAULT now(),
    ultimo_acceso timestamptz NOT NULL DEFAULT now(),
    fecha_cierre timestamptz,
    estado text NOT NULL CHECK (estado IN ('activa', 'expirada', 'cerrada')),
    duracion_minutos integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE transacciones (
    id bigserial PRIMARY KEY,
    id_usuario bigint NOT NULL REFERENCES usuario(id),
    tipo text NOT NULL CHECK (tipo IN ('recarga', 'retiro', 'pago_premio')),
    monto numeric(12,2) NOT NULL,
    fecha timestamptz NOT NULL DEFAULT now(),
    estado text NOT NULL CHECK (estado IN ('pendiente', 'completada', 'fallida')),
    descripcion varchar(255),
    id_area bigint REFERENCES area(id)
);

CREATE TABLE estadisticas_diarias (
    fecha date NOT NULL,
    id_usuario bigint NOT NULL REFERENCES usuario(id),
    ventas_monto numeric(12,2) NOT NULL DEFAULT 0,
    ventas_cantidad integer NOT NULL DEFAULT 0,
    premios_totales numeric(12,2) NOT NULL DEFAULT 0,
    premios_pagados numeric(12,2) NOT NULL DEFAULT 0,
    premios_pendientes numeric(12,2) NOT NULL DEFAULT 0,
    recargas numeric(12,2) NOT NULL DEFAULT 0,
    retiros numeric(12,2) NOT NULL DEFAULT 0,
    ventas_hoy numeric(12,2) NOT NULL DEFAULT 0,
    pagos_hoy numeric(12,2) NOT NULL DEFAULT 0,
    PRIMARY KEY (fecha, id_usuario)
);

CREATE TABLE logo_rifa (
    id bigserial PRIMARY KEY,
    id_tipo_rifa bigint NOT NULL REFERENCES tipo_rifa(id),
    id_area bigint NOT NULL REFERENCES area(id),
    id_imagen bigint NOT NULL REFERENCES imagenes(id),
    id_usuario bigint NOT NULL REFERENCES usuario(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cupos_area_rifa (
    id bigserial PRIMARY KEY,
    id_area bigint NOT NULL REFERENCES area(id),
    id_tipo_rifa bigint NOT NULL REFERENCES tipo_rifa(id),
    c_2digitos numeric(12,2) NOT NULL DEFAULT 0,
    c_3digitos numeric(12,2) NOT NULL DEFAULT 0,
    c_4digitos numeric(12,2) NOT NULL DEFAULT 0,
    c_5digitos numeric(12,2) NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id_area, id_tipo_rifa)
);

-- Función para actualizar columnas updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_area_updated_at
BEFORE UPDATE ON area
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_usuario_updated_at
BEFORE UPDATE ON usuario
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_configuracion_factura_updated_at
BEFORE UPDATE ON configuracion_factura
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_rifa_updated_at
BEFORE UPDATE ON rifa
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_venta_updated_at
BEFORE UPDATE ON venta
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION fn_calcular_premios_venta()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.premio_01 IS NULL THEN
        SELECT
            MAX(CASE WHEN op.nivel_premio = 1 THEN op.valor_premio * NEW.cantidad END),
            MAX(CASE WHEN op.nivel_premio = 2 THEN op.valor_premio * NEW.cantidad END),
            MAX(CASE WHEN op.nivel_premio = 3 THEN op.valor_premio * NEW.cantidad END),
            MAX(CASE WHEN op.nivel_premio = 4 THEN op.valor_premio * NEW.cantidad END),
            MAX(CASE WHEN op.nivel_premio = 5 THEN op.valor_premio * NEW.cantidad END),
            MAX(CASE WHEN op.nivel_premio = 6 THEN op.valor_premio * NEW.cantidad END),
            MAX(CASE WHEN op.nivel_premio = 7 THEN op.valor_premio * NEW.cantidad END),
            MAX(CASE WHEN op.nivel_premio = 8 THEN op.valor_premio * NEW.cantidad END),
            MAX(CASE WHEN op.nivel_premio = 9 THEN op.valor_premio * NEW.cantidad END),
            MAX(CASE WHEN op.nivel_premio = 10 THEN op.valor_premio * NEW.cantidad END)
        INTO
            NEW.premio_01, NEW.premio_02, NEW.premio_03, NEW.premio_04, NEW.premio_05,
            NEW.premio_06, NEW.premio_07, NEW.premio_08, NEW.premio_09, NEW.premio_10
        FROM opciones_premios op
        INNER JOIN usuario u ON u.id = NEW.id_usuario
        INNER JOIN rifa r ON r.id = NEW.id_rifa
        WHERE op.id_tipo_rifa = r.id_tipo
          AND op.id_area = u.id_area
          AND op.saldo_ganado = NEW.valor
          AND op.digitos = LENGTH(NEW.numero);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calcular_premios_venta
BEFORE INSERT ON venta
FOR EACH ROW
EXECUTE FUNCTION fn_calcular_premios_venta();

CREATE OR REPLACE FUNCTION fn_sync_ganadores_insert()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO ganadores (
        id_usuario,
        id_factura,
        id_numero_ganador,
        numerol,
        fecha,
        saldo_premio,
        nivel_premio,
        id_area,
        pagada,
        fecha_hora_pago
    )
    SELECT
        v.id_usuario,
        v.id_factura,
        NEW.id,
        v.numero,
        v.fecha,
        COALESCE(
            CASE NEW.nivel_premio
                WHEN 1 THEN v.premio_01
                WHEN 2 THEN v.premio_02
                WHEN 3 THEN v.premio_03
                WHEN 4 THEN v.premio_04
                WHEN 5 THEN v.premio_05
                WHEN 6 THEN v.premio_06
                WHEN 7 THEN v.premio_07
                WHEN 8 THEN v.premio_08
                WHEN 9 THEN v.premio_09
                WHEN 10 THEN v.premio_10
                ELSE 0::numeric
            END,
            0::numeric
        ) AS saldo_premio,
        NEW.nivel_premio,
        u.id_area,
        false,
        NULL
    FROM venta v
    INNER JOIN usuario u ON u.id = v.id_usuario
    WHERE v.id_rifa = NEW.id_rifa
      AND v.eliminada = false
      AND NEW.numero_ganador LIKE '%' || v.numero || '%';

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_sync_ganadores_update()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM ganadores
    WHERE id_numero_ganador = OLD.id;

    INSERT INTO ganadores (
        id_usuario,
        id_factura,
        id_numero_ganador,
        numerol,
        fecha,
        saldo_premio,
        nivel_premio,
        id_area,
        pagada,
        fecha_hora_pago
    )
    SELECT
        v.id_usuario,
        v.id_factura,
        NEW.id,
        v.numero,
        v.fecha,
        COALESCE(
            CASE NEW.nivel_premio
                WHEN 1 THEN v.premio_01
                WHEN 2 THEN v.premio_02
                WHEN 3 THEN v.premio_03
                WHEN 4 THEN v.premio_04
                WHEN 5 THEN v.premio_05
                WHEN 6 THEN v.premio_06
                WHEN 7 THEN v.premio_07
                WHEN 8 THEN v.premio_08
                WHEN 9 THEN v.premio_09
                WHEN 10 THEN v.premio_10
                ELSE 0::numeric
            END,
            0::numeric
        ) AS saldo_premio,
        NEW.nivel_premio,
        u.id_area,
        false,
        NULL
    FROM venta v
    INNER JOIN usuario u ON u.id = v.id_usuario
    WHERE v.id_rifa = NEW.id_rifa
      AND v.eliminada = false
      AND NEW.numero_ganador LIKE '%' || v.numero || '%';

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_sync_ganadores_delete()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM ganadores
    WHERE id_numero_ganador = OLD.id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_numero_ganadores_after_insert
AFTER INSERT ON numero_ganadores
FOR EACH ROW
EXECUTE FUNCTION fn_sync_ganadores_insert();

CREATE TRIGGER trg_numero_ganadores_after_update
AFTER UPDATE ON numero_ganadores
FOR EACH ROW
EXECUTE FUNCTION fn_sync_ganadores_update();

CREATE TRIGGER trg_numero_ganadores_after_delete
AFTER DELETE ON numero_ganadores
FOR EACH ROW
EXECUTE FUNCTION fn_sync_ganadores_delete();

CREATE OR REPLACE FUNCTION fn_finalizar_rifa_al_registrar_ganador()
RETURNS TRIGGER AS $$
BEGIN
        UPDATE rifa
        SET fecha_hora_finalizacion = now()
        WHERE id = NEW.id_rifa
            AND fecha_hora_finalizacion IS NULL;

        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_numero_ganadores_finaliza_rifa
AFTER INSERT ON numero_ganadores
FOR EACH ROW
EXECUTE FUNCTION fn_finalizar_rifa_al_registrar_ganador();

CREATE OR REPLACE FUNCTION eliminar_factura(p_id_factura bigint)
RETURNS factura
LANGUAGE plpgsql
AS $$
DECLARE
    v_factura factura;
BEGIN
    UPDATE factura
    SET eliminada = true,
        fecha_eliminada = now()
    WHERE id = p_id_factura
      AND eliminada = false
    RETURNING * INTO v_factura;

    IF v_factura.id IS NULL THEN
        RAISE EXCEPTION 'Factura no encontrada o ya eliminada';
    END IF;

    UPDATE venta
    SET eliminada = true,
        fecha_eliminada = now()
    WHERE id_factura = p_id_factura
      AND eliminada = false;

    RETURN v_factura;
END;
$$;

CREATE OR REPLACE FUNCTION restaurar_factura(p_id_factura bigint)
RETURNS factura
LANGUAGE plpgsql
AS $$
DECLARE
    v_factura factura;
BEGIN
    UPDATE factura
    SET eliminada = false,
        fecha_eliminada = NULL
    WHERE id = p_id_factura
      AND eliminada = true
    RETURNING * INTO v_factura;

    IF v_factura.id IS NULL THEN
        RAISE EXCEPTION 'Factura no encontrada o no eliminada';
    END IF;

    UPDATE venta
    SET eliminada = false,
        fecha_eliminada = NULL
    WHERE id_factura = p_id_factura
      AND eliminada = true;

    RETURN v_factura;
END;
$$;

CREATE OR REPLACE FUNCTION confirmar_ventas_pendientes(
    p_id_usuario bigint,
    p_numero_factura varchar,
    p_ventas jsonb
)
RETURNS TABLE (id_factura bigint, numero_factura varchar, total numeric)
LANGUAGE plpgsql
AS $$
DECLARE
    v_id_factura bigint;
    v_total numeric(12,2);
BEGIN
    IF jsonb_typeof(p_ventas) <> 'array' OR jsonb_array_length(p_ventas) = 0 THEN
        RAISE EXCEPTION 'La factura debe contener al menos una venta';
    END IF;

    IF p_numero_factura !~ '^[A-Z][0-9]{3,}$' THEN
        RAISE EXCEPTION 'El numero de factura debe tener el formato A001';
    END IF;

    PERFORM pg_advisory_xact_lock(p_id_usuario);

        SELECT f.id INTO v_id_factura
        FROM factura AS f
        WHERE f.id_usuario = p_id_usuario
            AND f.numero_factura = p_numero_factura;

    IF v_id_factura IS NOT NULL THEN
        SELECT COALESCE(SUM(total), 0) INTO v_total FROM venta WHERE id_factura = v_id_factura;
        RETURN QUERY SELECT v_id_factura, p_numero_factura, v_total;
        RETURN;
    END IF;

    INSERT INTO factura (numero_factura, id_usuario)
    VALUES (p_numero_factura, p_id_usuario)
    RETURNING id INTO v_id_factura;

    INSERT INTO venta (
        id_usuario,
        id_rifa,
        id_factura,
        fecha,
        numero,
        cantidad,
        valor,
        total,
        pagada,
        fecha_pago,
        eliminada
    )
    SELECT
        p_id_usuario,
        (venta_pendiente->>'id_rifa')::bigint,
        v_id_factura,
        now(),
        venta_pendiente->>'numero',
        COALESCE((venta_pendiente->>'cantidad')::integer, 1),
        (venta_pendiente->>'valor')::numeric(12,2),
        (venta_pendiente->>'valor')::numeric(12,2) * COALESCE((venta_pendiente->>'cantidad')::integer, 1),
        false,
        NULL,
        false
    FROM jsonb_array_elements(p_ventas) AS venta_pendiente;

    SELECT COALESCE(SUM((venta_pendiente->>'valor')::numeric(12,2) * COALESCE((venta_pendiente->>'cantidad')::integer, 1)), 0)
    INTO v_total
    FROM jsonb_array_elements(p_ventas) AS venta_pendiente;

    RETURN QUERY SELECT v_id_factura, p_numero_factura, v_total;
END;
$$;

-- Relacion muchos-a-muchos: un vendedor puede estar asignado a varios supervisores.
CREATE TABLE supervisor_vendedor (
    id bigserial PRIMARY KEY,
    id_supervisor bigint NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    id_vendedor bigint NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id_supervisor, id_vendedor)
);

-- Índices útiles para búsquedas
CREATE INDEX idx_usuario_correo ON usuario(correo);
CREATE INDEX idx_usuario_rol ON usuario(rol);
CREATE INDEX idx_rifa_fecha ON rifa(fecha_hora_juego);
CREATE INDEX idx_venta_id_rifa ON venta(id_rifa);
CREATE INDEX idx_venta_id_usuario ON venta(id_usuario);
CREATE INDEX idx_numero_ganadores_rifa ON numero_ganadores(id_rifa);
CREATE INDEX idx_ganadores_id_usuario ON ganadores(id_usuario);
CREATE INDEX idx_session_usuario ON session(id_usuario);
CREATE INDEX idx_supervisor_vendedor_supervisor ON supervisor_vendedor(id_supervisor);
CREATE INDEX idx_supervisor_vendedor_vendedor ON supervisor_vendedor(id_vendedor);

