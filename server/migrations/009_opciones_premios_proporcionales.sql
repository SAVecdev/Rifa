ALTER TABLE opciones_premios
ADD COLUMN IF NOT EXISTS saldo_ganado numeric(12,2);

-- Si ya existen opciones, asigna un saldo valido antes de ejecutar SET NOT NULL.
ALTER TABLE opciones_premios
DROP CONSTRAINT IF EXISTS opciones_premios_id_rifa_id_area_nivel_premio_key;

ALTER TABLE opciones_premios
ADD CONSTRAINT opciones_premios_id_rifa_id_area_nivel_digitos_saldo_key
UNIQUE (id_rifa, id_area, nivel_premio, digitos, saldo_ganado);

ALTER TABLE opciones_premios
ALTER COLUMN saldo_ganado SET NOT NULL;

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
        WHERE op.id_rifa = NEW.id_rifa
          AND op.id_area = u.id_area
          AND op.saldo_ganado = NEW.valor
          AND op.digitos = LENGTH(NEW.numero);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calcular_premios_venta ON venta;

CREATE TRIGGER trg_calcular_premios_venta
BEFORE INSERT ON venta
FOR EACH ROW
EXECUTE FUNCTION fn_calcular_premios_venta();