ALTER TABLE configuracion_factura
ADD COLUMN IF NOT EXISTS modelo_factura varchar(30) NOT NULL DEFAULT 'clasica';

ALTER TABLE configuracion_factura
DROP CONSTRAINT IF EXISTS configuracion_factura_modelo_factura_check;

ALTER TABLE configuracion_factura
ADD CONSTRAINT configuracion_factura_modelo_factura_check
CHECK (modelo_factura IN ('clasica', 'compacta', 'resumen', 'agrupada'));

NOTIFY pgrst, 'reload schema';