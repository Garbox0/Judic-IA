# 🔐 Guía de Migración con RLS (Row Level Security)

## ⚠️ Problema Detectado

Tu base de datos tiene **Row Level Security (RLS)** activada con triggers que protegen los campos de suscripción. Esto es **excelente para seguridad**, pero necesitamos ejecutar la migración con permisos especiales.

Error que recibiste:
```
ERROR: P0001: 🔴 Unauthorized: You cannot modify subscription fields directly.
CONTEXT: PL/pgSQL function protect_subscription_fields()
```

---

## 🎯 Soluciones (Elegí UNA)

### **Opción 1: SQL Editor con Service Role** (MÁS FÁCIL ⭐)

1. **Supabase Dashboard** → Tu proyecto → **SQL Editor**
2. **New Query**
3. **Pegá esto EXACTAMENTE** (todo junto):

```sql
-- ⚠️ IMPORTANTE: Esta línea ejecuta con permisos de admin (bypass RLS)
SET LOCAL role TO service_role;

-- Luego pegá TODO el contenido de:
-- supabase/migrations/20260208_phase1_cleanup_with_rls.sql
```

4. **Copiar TODO** el archivo `20260208_phase1_cleanup_with_rls.sql` y pegarlo **después** de esa primera línea
5. Click **Run** (Ctrl+Enter)
6. Verificar que no haya errores rojos

---

### **Opción 2: Deshabilitar RLS Temporalmente** (SI SABÉS LO QUE HACÉS)

**⚠️ CUIDADO:** Esto desactiva protecciones de seguridad temporalmente.

1. **Identificar el trigger protector:**

```sql
-- Ver triggers en profiles
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'profiles';
```

2. **Deshabilitar trigger temporalmente:**

```sql
-- Reemplazar 'nombre_del_trigger' con el que encontraste
ALTER TABLE profiles DISABLE TRIGGER nombre_del_trigger;
```

3. **Ejecutar migración normal:**

Copiar y pegar `20260208_phase1_cleanup_with_rls.sql` completo.

4. **Re-habilitar trigger:**

```sql
ALTER TABLE profiles ENABLE TRIGGER nombre_del_trigger;
```

---

### **Opción 3: Supabase CLI con Service Role**

Si tenés Supabase CLI instalado:

1. **Obtener Service Role Key:**
   - Dashboard → Settings → API
   - Copiar `service_role` secret (⚠️ NO la compartas)

2. **Ejecutar migración:**

```bash
# Linux/Mac
export SUPABASE_SERVICE_KEY="tu_service_role_key_aqui"
supabase db push --service-key $SUPABASE_SERVICE_KEY

# Windows PowerShell
$env:SUPABASE_SERVICE_KEY="tu_service_role_key_aqui"
supabase db push --service-key $env:SUPABASE_SERVICE_KEY
```

---

## ✅ Verificación Post-Migración

Después de ejecutar la migración, **verificá que todo funcionó**:

```sql
-- 1. Ver distribución de tiers (NO debería haber 'starter')
SELECT plan_tier, COUNT(*) as count
FROM profiles
GROUP BY plan_tier;

-- Resultado esperado:
-- trial: X
-- free: Y
-- professional: Z
-- (NO debería aparecer 'starter')

-- 2. Verificar que el campo trial_ends_at existe
SELECT COUNT(*) as usuarios_con_trial_date
FROM profiles
WHERE trial_ends_at IS NOT NULL;

-- 3. Verificar que las funciones SQL existen
SELECT proname FROM pg_proc
WHERE proname IN ('reset_user_quotas', 'increment_quota', 'reset_all_monthly_quotas');

-- Deberías ver las 3 funciones

-- 4. Verificar índices creados
SELECT indexname FROM pg_indexes
WHERE tablename = 'profiles'
AND indexname LIKE 'idx_profiles%';

-- Deberías ver al menos 5 índices nuevos
```

---

## 🐛 Troubleshooting

### Error: "role service_role does not exist"

**Solución:** Usá la versión `20260208_phase1_cleanup_with_rls.sql` que maneja RLS automáticamente.

### Error: "trigger protect_subscription_fields does not exist"

**Solución:** Perfecto, significa que tus triggers tienen otro nombre. Ejecutá esto para identificarlos:

```sql
SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'profiles';
```

Y modificá el script manualmente para deshabilitarlos.

### Error: "column demo_expires_at does not exist"

**Solución:** Ya tenés `trial_ends_at` (perfecto). El script detecta esto automáticamente.

### Los triggers se deshabilitaron pero no se re-habilitaron

**Solución:**

```sql
-- Ver triggers deshabilitados
SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'profiles'::regclass;

-- Re-habilitar manualmente (reemplazar nombre_trigger)
ALTER TABLE profiles ENABLE TRIGGER nombre_trigger;
```

---

## 🔒 Seguridad: ¿Por qué es seguro usar service_role?

- `SET LOCAL role` **solo afecta la transacción actual**
- Al terminar el script, los permisos vuelven a normal
- RLS sigue protegiendo modificaciones futuras
- Es el método oficial recomendado por Supabase para migraciones

---

## 📚 Siguiente Paso

Una vez que la migración se ejecute sin errores:

1. **Verificá** los queries de arriba
2. **Continuá** con [INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md) → Paso 4
3. **Actualizá** tu código para usar las nuevas funciones

---

## ❓ ¿Cuál Opción Elegir?

| Opción | Dificultad | Seguridad | Recomendado |
|--------|------------|-----------|-------------|
| **Opción 1: SET LOCAL** | Fácil | Alta | ✅ SÍ |
| Opción 2: Deshabilitar RLS | Media | Media | ⚠️ Solo si sabés |
| Opción 3: CLI | Alta | Alta | Solo si ya usás CLI |

**Recomendación:** Usá **Opción 1** (SQL Editor con `SET LOCAL role TO service_role`).

---

¿Necesitás ayuda ejecutando alguna de estas opciones? Decime cuál vas a usar y te guío paso a paso. 🚀
