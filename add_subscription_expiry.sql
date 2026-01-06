-- Añadir columna de fecha de expiración de la suscripción
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS subscription_expiry TIMESTAMPTZ;

-- Comentario para documentación
COMMENT ON COLUMN profiles.subscription_expiry IS 'Fecha en la que la suscripción profesional expira y requiere renovación.';
