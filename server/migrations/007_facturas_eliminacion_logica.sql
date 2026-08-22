ALTER TABLE factura
ADD COLUMN IF NOT EXISTS eliminada boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS fecha_eliminada timestamptz;

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