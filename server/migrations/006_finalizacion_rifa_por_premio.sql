ALTER TABLE rifa
ADD COLUMN IF NOT EXISTS fecha_hora_finalizacion timestamptz;

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

DROP TRIGGER IF EXISTS trg_numero_ganadores_finaliza_rifa ON numero_ganadores;

CREATE TRIGGER trg_numero_ganadores_finaliza_rifa
AFTER INSERT ON numero_ganadores
FOR EACH ROW
EXECUTE FUNCTION fn_finalizar_rifa_al_registrar_ganador();