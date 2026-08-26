-- Migration 027: Agregar horario de venta por area

ALTER TABLE area
ADD COLUMN IF NOT EXISTS hora_inicio_venta TIME DEFAULT '07:00:00',
ADD COLUMN IF NOT EXISTS hora_fin_venta TIME DEFAULT '17:00:00',
ADD COLUMN IF NOT EXISTS horario_activo BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN area.hora_inicio_venta IS 'Hora de inicio permitida para ventas en esta area (ej: 07:00:00)';
COMMENT ON COLUMN area.hora_fin_venta IS 'Hora de fin permitida para ventas en esta area (ej: 17:00:00)';
COMMENT ON COLUMN area.horario_activo IS 'Indica si la restriccion de horario de venta esta activa para esta area';
