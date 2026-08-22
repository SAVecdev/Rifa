ALTER TABLE factura
ADD COLUMN IF NOT EXISTS eliminada boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS fecha_eliminada timestamptz;

ALTER TABLE venta
ADD COLUMN IF NOT EXISTS eliminada boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS fecha_eliminada timestamptz;

NOTIFY pgrst, 'reload schema';
