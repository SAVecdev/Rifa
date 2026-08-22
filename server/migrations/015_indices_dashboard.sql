CREATE INDEX IF NOT EXISTS idx_area_activo
ON area (activo);

CREATE INDEX IF NOT EXISTS idx_rifa_created_at
ON rifa (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_venta_dashboard
ON venta (pagada, eliminada, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_venta_id_factura
ON venta (id_factura);

NOTIFY pgrst, 'reload schema';
