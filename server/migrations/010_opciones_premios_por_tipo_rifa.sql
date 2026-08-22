ALTER TABLE opciones_premios
ADD COLUMN IF NOT EXISTS id_tipo_rifa bigint REFERENCES tipo_rifa(id);

UPDATE opciones_premios AS opcion
SET id_tipo_rifa = rifa.id_tipo
FROM rifa
WHERE opcion.id_rifa = rifa.id
  AND opcion.id_tipo_rifa IS NULL;

ALTER TABLE opciones_premios
ALTER COLUMN id_tipo_rifa SET NOT NULL;

ALTER TABLE opciones_premios
DROP CONSTRAINT IF EXISTS opciones_premios_id_rifa_fkey,
DROP CONSTRAINT IF EXISTS opciones_premios_id_rifa_id_area_nivel_digitos_saldo_key;

ALTER TABLE opciones_premios
DROP COLUMN IF EXISTS id_rifa;

ALTER TABLE opciones_premios
ADD CONSTRAINT opciones_premios_id_tipo_rifa_id_area_nivel_digitos_saldo_key
UNIQUE (id_tipo_rifa, id_area, nivel_premio, digitos, saldo_ganado);

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

NOTIFY pgrst, 'reload schema';