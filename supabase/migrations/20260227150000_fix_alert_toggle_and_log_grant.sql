-- ============================================================
-- FIX: set_case_alert_status no debe consumir crédito al
--      reactivar una alerta existente. Los créditos se consumen
--      únicamente al CREAR la alerta (en alerts/create route).
--
-- CONTEXTO: un usuario paga 1 crédito por crear un slot de alerta.
-- Pausar y reactivar esa alerta es gratis — es el mismo slot.
--
-- TAMBIÉN: Grant explícito de INSERT en case_alerts_log para
-- service_role (el alert engine inserta logs con ese rol).
-- ============================================================

-- 1) Reemplazar set_case_alert_status sin consumo de crédito
DROP FUNCTION IF EXISTS public.set_case_alert_status(uuid, boolean);

CREATE OR REPLACE FUNCTION public.set_case_alert_status(
  p_alert_id uuid,
  p_activate boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_current_status boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  SELECT is_active
  INTO v_current_status
  FROM public.case_alerts
  WHERE id = p_alert_id
    AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ALERT_NOT_FOUND';
  END IF;

  -- No-op if already in desired state
  IF COALESCE(v_current_status, false) = COALESCE(p_activate, false) THEN
    RETURN;
  END IF;

  UPDATE public.case_alerts
  SET
    is_active  = p_activate,
    updated_at = now()
  WHERE id = p_alert_id
    AND user_id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_case_alert_status(uuid, boolean) TO authenticated, service_role;

-- 2) Grant INSERT explícito en case_alerts_log para service_role
--    (el alert engine usa SUPABASE_SERVICE_ROLE_KEY — bypasea RLS
--     pero necesita el permiso de tabla a nivel de rol de Postgres)
GRANT INSERT ON public.case_alerts_log TO service_role;
