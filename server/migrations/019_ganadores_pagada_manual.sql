-- venta.pagada indica que el cliente pago el ticket (siempre true), no que el premio fue pagado.
-- Los triggers de sincronizacion copiaban ese valor a ganadores.pagada, marcando premios como
-- pagados automaticamente al registrar el numero ganador. Ahora siempre inician como pendientes.

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

NOTIFY pgrst, 'reload schema';
