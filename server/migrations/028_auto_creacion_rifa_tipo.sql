-- Migration 028: Agregar configuracion para creacion automatica de rifas por tipo_rifa

ALTER TABLE tipo_rifa
ADD COLUMN IF NOT EXISTS dias_creacion_auto jsonb NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS hora_juego_auto TIME DEFAULT '18:00:00',
ADD COLUMN IF NOT EXISTS auto_creacion_activa BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS sorteos_auto INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN tipo_rifa.dias_creacion_auto IS 'Lista de dias de la semana para creacion automatica: 0=Domingo, 1=Lunes, 2=Martes, 3=Miercoles, 4=Jueves, 5=Viernes, 6=Sabado. Ej: [1,3,4,6]';
COMMENT ON COLUMN tipo_rifa.hora_juego_auto IS 'Hora por defecto del sorteo para rifas generadas automaticamente (ej: 18:00:00)';
COMMENT ON COLUMN tipo_rifa.auto_creacion_activa IS 'Indica si esta activa la generacion automatica de rifas para este tipo';
COMMENT ON COLUMN tipo_rifa.sorteos_auto IS 'Numero de sorteos configurados para la rifa creada';
