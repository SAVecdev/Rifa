ALTER TABLE usuario
ADD COLUMN IF NOT EXISTS bloqueado_hasta timestamptz;

CREATE INDEX IF NOT EXISTS idx_usuario_bloqueado_hasta
ON usuario (bloqueado_hasta);