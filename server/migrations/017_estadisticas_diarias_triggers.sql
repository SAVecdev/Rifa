CREATE OR REPLACE FUNCTION fn_estadisticas_aplicar_delta(
    p_fecha date,
    p_id_usuario bigint,
    p_ventas_monto numeric DEFAULT 0,
    p_ventas_cantidad integer DEFAULT 0,
    p_premios_totales numeric DEFAULT 0,
    p_premios_pagados numeric DEFAULT 0,
    p_premios_pendientes numeric DEFAULT 0,
    p_ventas_hoy numeric DEFAULT 0,
    p_pagos_hoy numeric DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_fecha IS NULL OR p_id_usuario IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO estadisticas_diarias (
        fecha,
        id_usuario,
        ventas_monto,
        ventas_cantidad,
        premios_totales,
        premios_pagados,
        premios_pendientes,
        ventas_hoy,
        pagos_hoy
    )
    VALUES (
        p_fecha,
        p_id_usuario,
        COALESCE(p_ventas_monto, 0),
        COALESCE(p_ventas_cantidad, 0),
        COALESCE(p_premios_totales, 0),
        COALESCE(p_premios_pagados, 0),
        COALESCE(p_premios_pendientes, 0),
        COALESCE(p_ventas_hoy, 0),
        COALESCE(p_pagos_hoy, 0)
    )
    ON CONFLICT (fecha, id_usuario) DO UPDATE SET
        ventas_monto = estadisticas_diarias.ventas_monto + EXCLUDED.ventas_monto,
        ventas_cantidad = estadisticas_diarias.ventas_cantidad + EXCLUDED.ventas_cantidad,
        premios_totales = estadisticas_diarias.premios_totales + EXCLUDED.premios_totales,
        premios_pagados = estadisticas_diarias.premios_pagados + EXCLUDED.premios_pagados,
        premios_pendientes = estadisticas_diarias.premios_pendientes + EXCLUDED.premios_pendientes,
        ventas_hoy = estadisticas_diarias.ventas_hoy + EXCLUDED.ventas_hoy,
        pagos_hoy = estadisticas_diarias.pagos_hoy + EXCLUDED.pagos_hoy;
END;
$$;

CREATE OR REPLACE FUNCTION fn_estadisticas_venta_delta(
    p_venta venta,
    p_factor integer
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_monto numeric(12,2);
    v_fecha_venta date;
    v_fecha_hoy date;
    v_fecha_pago date;
BEGIN
    IF p_venta.id_usuario IS NULL OR p_venta.eliminada THEN
        RETURN;
    END IF;

    v_monto := COALESCE(p_venta.total, 0) * p_factor;
    v_fecha_venta := p_venta.fecha::date;
    v_fecha_hoy := p_venta.created_at::date;
    v_fecha_pago := COALESCE(p_venta.fecha_pago, p_venta.fecha)::date;

    PERFORM fn_estadisticas_aplicar_delta(
        v_fecha_venta,
        p_venta.id_usuario,
        v_monto,
        p_factor,
        0,
        0,
        0,
        0,
        CASE WHEN p_venta.pagada AND v_fecha_pago = v_fecha_venta THEN v_monto ELSE 0 END
    );

    IF v_fecha_hoy <> v_fecha_venta THEN
        PERFORM fn_estadisticas_aplicar_delta(
            v_fecha_hoy,
            p_venta.id_usuario,
            0,
            0,
            0,
            0,
            0,
            v_monto,
            0
        );
    ELSE
        PERFORM fn_estadisticas_aplicar_delta(
            v_fecha_hoy,
            p_venta.id_usuario,
            0,
            0,
            0,
            0,
            0,
            v_monto,
            0
        );
    END IF;

    IF p_venta.pagada AND v_fecha_pago <> v_fecha_venta THEN
        PERFORM fn_estadisticas_aplicar_delta(
            v_fecha_pago,
            p_venta.id_usuario,
            0,
            0,
            0,
            0,
            0,
            0,
            v_monto
        );
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION fn_estadisticas_venta_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM fn_estadisticas_venta_delta(OLD, -1);
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        PERFORM fn_estadisticas_venta_delta(OLD, -1);
    END IF;

    PERFORM fn_estadisticas_venta_delta(NEW, 1);
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_estadisticas_ganador_delta(
    p_ganador ganadores,
    p_factor integer
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_monto numeric(12,2);
BEGIN
    v_monto := COALESCE(p_ganador.saldo_premio, 0) * p_factor;

    PERFORM fn_estadisticas_aplicar_delta(
        p_ganador.fecha,
        p_ganador.id_usuario,
        0,
        0,
        v_monto,
        CASE WHEN p_ganador.pagada THEN v_monto ELSE 0 END,
        CASE WHEN p_ganador.pagada THEN 0 ELSE v_monto END,
        0,
        0
    );
END;
$$;

CREATE OR REPLACE FUNCTION fn_estadisticas_ganador_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM fn_estadisticas_ganador_delta(OLD, -1);
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        PERFORM fn_estadisticas_ganador_delta(OLD, -1);
    END IF;

    PERFORM fn_estadisticas_ganador_delta(NEW, 1);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_estadisticas_venta ON venta;
CREATE TRIGGER trg_estadisticas_venta
AFTER INSERT OR UPDATE OR DELETE ON venta
FOR EACH ROW
EXECUTE FUNCTION fn_estadisticas_venta_trigger();

DROP TRIGGER IF EXISTS trg_estadisticas_ganador ON ganadores;
CREATE TRIGGER trg_estadisticas_ganador
AFTER INSERT OR UPDATE OR DELETE ON ganadores
FOR EACH ROW
EXECUTE FUNCTION fn_estadisticas_ganador_trigger();

NOTIFY pgrst, 'reload schema';
