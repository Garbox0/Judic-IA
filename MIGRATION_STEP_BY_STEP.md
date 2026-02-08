# 🚀 Migración Paso a Paso (Con RLS)

## ✅ Qué hacer AHORA

Tu base de datos tiene RLS protegiendo campos de suscripción. **No hay problema**, vamos a hacerlo en 2 pasos seguros.

---

## 📋 PASO 1: Migración Simple (Campos y Funciones)

Esta parte NO toca datos de usuarios, solo agrega campos nuevos y funciones.

### Ejecutar:

1. **Supabase Dashboard** → SQL Editor → New Query
2. **Copiar y pegar** TODO el contenido de: `20260208_phase1_simple.sql`
3. **Run** (Ctrl+Enter)

### Verificar:

```sql
-- Ver campos nuevos
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name IN ('quota_reset_at', 'trial_ends_at', 'grace_period_ends_at', 'deleted_at');

-- Deberías ver los 4 campos
```

**Si todo sale bien**, continuá al Paso 2.
**Si hay error**, copiá el error completo y decime.

---

## 📋 PASO 2: Actualización de Datos (Uno a Uno)

Ahora vamos a actualizar los datos de usuarios existentes **UNA QUERY A LA VEZ**.

### 2.1 Ver Estado Actual

```sql
SELECT plan_tier, subscription_status, COUNT(*) as count
FROM profiles
GROUP BY plan_tier, subscription_status;
```

**¿Ves 'starter' en los resultados?**
- ✅ **SÍ** → Continuá con 2.2
- ❌ **NO** → Saltá al Paso 3 (ya está migrado)

### 2.2 Migrar 'starter' → 'trial' (solo activos)

```sql
UPDATE profiles
SET plan_tier = 'trial'
WHERE plan_tier = 'starter'
AND subscription_status IN ('demo', 'active')
AND (trial_ends_at IS NULL OR trial_ends_at > NOW());
```

**Resultado esperado:** `UPDATE X` (donde X = cantidad de usuarios migrados)

### 2.3 Migrar 'starter' → 'free' (inactivos)

```sql
UPDATE profiles
SET plan_tier = 'free'
WHERE plan_tier = 'starter'
AND (
    subscription_status = 'inactive'
    OR (subscription_status = 'demo' AND trial_ends_at <= NOW())
);
```

**Resultado esperado:** `UPDATE Y`

### 2.4 Limpiar subscription_status

```sql
-- Activar trials válidos
UPDATE profiles
SET subscription_status = 'active'
WHERE subscription_status = 'demo'
AND trial_ends_at > NOW();

-- Marcar como inactive los expirados
UPDATE profiles
SET subscription_status = 'inactive'
WHERE subscription_status = 'demo'
AND trial_ends_at <= NOW();
```

### 2.5 Verificación Final

```sql
-- Ya no debería haber 'starter'
SELECT plan_tier, COUNT(*) as count
FROM profiles
GROUP BY plan_tier;
```

**Deberías ver:**
- `trial`: X usuarios
- `free`: Y usuarios
- `professional`: Z usuarios
- **NO** debería aparecer `starter`

---

## 📋 PASO 3: Constraints (Opcional)

Esto es opcional porque puede fallar si RLS lo bloquea. **No es crítico**.

```sql
-- Eliminar constraint viejo
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_plan_tier_check;

-- Agregar nuevo constraint
ALTER TABLE profiles ADD CONSTRAINT profiles_plan_tier_check
CHECK (plan_tier IN ('trial', 'free', 'professional', 'enterprise'));
```

**Si falla con error de permisos:** No pasa nada, podés crear usuarios nuevos igual.

---

## ✅ Verificación Total

```sql
-- 1. Verificar campos existen
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'profiles' AND column_name = 'trial_ends_at'
) as trial_ends_at_exists;
-- Debería retornar: true

-- 2. Verificar funciones existen
SELECT COUNT(*) as funciones_creadas
FROM pg_proc
WHERE proname IN ('reset_user_quotas', 'increment_quota', 'reset_all_monthly_quotas');
-- Debería retornar: 3

-- 3. Verificar índices
SELECT COUNT(*) as indices_nuevos
FROM pg_indexes
WHERE tablename = 'profiles'
AND indexname LIKE 'idx_profiles%';
-- Debería retornar: 6 o más

-- 4. Verificar no hay 'starter'
SELECT COUNT(*) as usuarios_starter
FROM profiles
WHERE plan_tier = 'starter';
-- Debería retornar: 0
```

---

## 🎯 Siguiente Paso

Una vez que TODO lo de arriba funcione:

1. **Actualizar código** → Seguir [INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md) desde Paso 4
2. **Testing local** → Verificar que quotas funcionen
3. **Deploy** → Subir a producción

---

## 🐛 Si algo sale mal

### Error: "must be owner of table profiles"

**Solución:** Estás intentando hacer algo que RLS bloquea. Omitilo y continuá.

Las operaciones críticas (campos, funciones, índices) ya están en el Paso 1.

### Error: "column trial_ends_at already exists"

**Perfecto!** Significa que el rename ya se ejecutó. Continuá.

### Error: "constraint profiles_plan_tier_check already exists"

**Perfecto!** Ya existe. Continuá.

### Quedan usuarios con plan_tier 'starter'

**Solución:** Ejecutá manualmente las queries del Paso 2 una por una, verificando cada resultado.

---

## 📞 Necesitás ayuda?

Decime:
1. ¿En qué paso estás?
2. ¿Qué error te da?
3. Copiame el resultado de la query que falló

Te ayudo en vivo 🚀
