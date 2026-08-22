ALTER TABLE configuracion_factura
DROP CONSTRAINT IF EXISTS configuracion_factura_modelo_factura_check;

UPDATE configuracion_factura
SET modelo_factura = 'clasica'
WHERE modelo_factura = 'loteria';

ALTER TABLE configuracion_factura
ADD CONSTRAINT configuracion_factura_modelo_factura_check
CHECK (modelo_factura IN ('clasica', 'compacta', 'resumen', 'agrupada'));

NOTIFY pgrst, 'reload schema';
