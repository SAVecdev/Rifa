ALTER TABLE factura DROP CONSTRAINT IF EXISTS factura_numero_factura_key;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'factura_id_usuario_numero_factura_key'
          AND conrelid = 'factura'::regclass
    ) THEN
        ALTER TABLE factura
        ADD CONSTRAINT factura_id_usuario_numero_factura_key UNIQUE (id_usuario, numero_factura);
    END IF;
END;
$$;

DROP FUNCTION IF EXISTS confirmar_ventas_pendientes(bigint, jsonb);

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

    IF p_numero_factura !~ '^A[0-9]{3}$' THEN
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
        id_usuario, id_rifa, id_factura, fecha, numero, cantidad, valor, total, pagada, fecha_pago, eliminada
    )
    SELECT
        p_id_usuario,
        (venta_pendiente->>'id_rifa')::bigint,
        v_id_factura,
        now(),
        venta_pendiente->>'numero',
        1,
        (venta_pendiente->>'valor')::numeric(12,2),
        (venta_pendiente->>'valor')::numeric(12,2),
        true,
        now(),
        false
    FROM jsonb_array_elements(p_ventas) AS venta_pendiente;

    SELECT COALESCE(SUM((venta_pendiente->>'valor')::numeric(12,2)), 0)
    INTO v_total
    FROM jsonb_array_elements(p_ventas) AS venta_pendiente;

    RETURN QUERY SELECT v_id_factura, p_numero_factura, v_total;
END;
$$;

NOTIFY pgrst, 'reload schema';