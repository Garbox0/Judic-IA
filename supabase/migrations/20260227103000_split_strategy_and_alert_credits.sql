-- ============================================================
-- HARDENING: Split credit domains (strategy vs alerts)
-- Date: 2026-02-27
-- Goal:
--   1) Keep strategy credits and alert credits fully separated.
--   2) Enforce non-negative balances and valid purchase states.
--   3) Provide atomic RPCs for credit mutations.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Profiles: ensure columns + integrity constraints
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS research_reports_extra integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS alert_credits_extra integer NOT NULL DEFAULT 0;

UPDATE public.profiles
SET
  research_reports_used = COALESCE(research_reports_used, 0),
  research_reports_extra = COALESCE(research_reports_extra, 0),
  alert_credits_extra = COALESCE(alert_credits_extra, 0)
WHERE
  research_reports_used IS NULL
  OR research_reports_extra IS NULL
  OR alert_credits_extra IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN research_reports_used SET DEFAULT 0,
  ALTER COLUMN research_reports_used SET NOT NULL,
  ALTER COLUMN research_reports_extra SET DEFAULT 0,
  ALTER COLUMN research_reports_extra SET NOT NULL,
  ALTER COLUMN alert_credits_extra SET DEFAULT 0,
  ALTER COLUMN alert_credits_extra SET NOT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_research_reports_used_nonnegative_chk;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_research_reports_used_nonnegative_chk
  CHECK (research_reports_used >= 0);

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_research_reports_extra_nonnegative_chk;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_research_reports_extra_nonnegative_chk
  CHECK (research_reports_extra >= 0);

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_alert_credits_extra_nonnegative_chk;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_alert_credits_extra_nonnegative_chk
  CHECK (alert_credits_extra >= 0);

-- ------------------------------------------------------------
-- 2) Purchases: normalize states and guard values
-- ------------------------------------------------------------
ALTER TABLE public.credit_purchases
  ALTER COLUMN status SET DEFAULT 'pending';

UPDATE public.credit_purchases
SET status = 'pending'
WHERE status IS NULL;

ALTER TABLE public.credit_purchases
  DROP CONSTRAINT IF EXISTS credit_purchases_status_check;

ALTER TABLE public.credit_purchases
  ADD CONSTRAINT credit_purchases_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'pending'::text,
        'approved'::text,
        'rejected'::text
      ]
    )
  );

ALTER TABLE public.credit_purchases
  DROP CONSTRAINT IF EXISTS credit_purchases_credits_positive_chk;

ALTER TABLE public.credit_purchases
  ADD CONSTRAINT credit_purchases_credits_positive_chk
  CHECK (credits > 0);

ALTER TABLE public.credit_purchases
  DROP CONSTRAINT IF EXISTS credit_purchases_amount_positive_chk;

ALTER TABLE public.credit_purchases
  ADD CONSTRAINT credit_purchases_amount_positive_chk
  CHECK (amount_ars > 0);

ALTER TABLE public.alert_credit_purchases
  ALTER COLUMN status SET DEFAULT 'pending';

UPDATE public.alert_credit_purchases
SET status = 'pending'
WHERE status IS NULL;

ALTER TABLE public.alert_credit_purchases
  DROP CONSTRAINT IF EXISTS alert_credit_purchases_status_check;

ALTER TABLE public.alert_credit_purchases
  ADD CONSTRAINT alert_credit_purchases_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'pending'::text,
        'approved'::text,
        'rejected'::text
      ]
    )
  );

ALTER TABLE public.alert_credit_purchases
  DROP CONSTRAINT IF EXISTS alert_credit_purchases_credits_positive_chk;

ALTER TABLE public.alert_credit_purchases
  ADD CONSTRAINT alert_credit_purchases_credits_positive_chk
  CHECK (credits > 0);

ALTER TABLE public.alert_credit_purchases
  DROP CONSTRAINT IF EXISTS alert_credit_purchases_amount_positive_chk;

ALTER TABLE public.alert_credit_purchases
  ADD CONSTRAINT alert_credit_purchases_amount_positive_chk
  CHECK (amount_ars > 0);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.credit_purchases
    WHERE mp_payment_id IS NOT NULL
    GROUP BY mp_payment_id
    HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_purchases_mp_payment_id
      ON public.credit_purchases (mp_payment_id)
      WHERE mp_payment_id IS NOT NULL;
  ELSE
    RAISE NOTICE 'Skipping unique index uq_credit_purchases_mp_payment_id due to duplicated mp_payment_id values.';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.alert_credit_purchases
    WHERE mp_payment_id IS NOT NULL
    GROUP BY mp_payment_id
    HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_alert_credit_purchases_mp_payment_id
      ON public.alert_credit_purchases (mp_payment_id)
      WHERE mp_payment_id IS NOT NULL;
  ELSE
    RAISE NOTICE 'Skipping unique index uq_alert_credit_purchases_mp_payment_id due to duplicated mp_payment_id values.';
  END IF;
END
$$;

ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_credit_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own purchases"
  ON public.credit_purchases;

CREATE POLICY "Users can view own purchases"
  ON public.credit_purchases
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own alert credit purchases"
  ON public.alert_credit_purchases;

CREATE POLICY "Users can view own alert credit purchases"
  ON public.alert_credit_purchases
  FOR SELECT
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 3) Strategy credits RPCs (only strategy columns)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.add_research_credits(uuid, integer);

CREATE OR REPLACE FUNCTION public.add_research_credits(
  p_user_id uuid,
  p_credits integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(p_credits, 0) <= 0 THEN
    RAISE EXCEPTION 'INVALID_CREDITS_AMOUNT';
  END IF;

  UPDATE public.profiles
  SET research_reports_extra = research_reports_extra + p_credits
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.consume_research_report(uuid, integer);

CREATE OR REPLACE FUNCTION public.consume_research_report(
  p_user_id uuid,
  p_plan_limit integer
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used integer;
  v_extra integer;
BEGIN
  IF COALESCE(p_plan_limit, 0) < 0 THEN
    RETURN 'exhausted';
  END IF;

  SELECT research_reports_used, research_reports_extra
  INTO v_used, v_extra
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'exhausted';
  END IF;

  IF v_used < p_plan_limit THEN
    UPDATE public.profiles
    SET research_reports_used = v_used + 1
    WHERE id = p_user_id;
    RETURN 'monthly';
  END IF;

  IF v_extra > 0 THEN
    UPDATE public.profiles
    SET research_reports_extra = v_extra - 1
    WHERE id = p_user_id;
    RETURN 'extra';
  END IF;

  RETURN 'exhausted';
END;
$$;

-- ------------------------------------------------------------
-- 4) Alert credits RPCs (only alert columns)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.add_alert_credits(uuid, integer);

CREATE OR REPLACE FUNCTION public.add_alert_credits(
  p_user_id uuid,
  p_credits integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(p_credits, 0) <= 0 THEN
    RAISE EXCEPTION 'INVALID_CREDITS_AMOUNT';
  END IF;

  UPDATE public.profiles
  SET alert_credits_extra = alert_credits_extra + p_credits
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.consume_alert_credit(uuid, integer);

CREATE OR REPLACE FUNCTION public.consume_alert_credit(
  p_user_id uuid,
  p_amount integer DEFAULT 1
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_extra integer;
BEGIN
  IF COALESCE(p_amount, 0) <= 0 THEN
    RETURN 'consumed';
  END IF;

  SELECT alert_credits_extra
  INTO v_extra
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'profile_missing';
  END IF;

  IF v_extra < p_amount THEN
    RETURN 'exhausted';
  END IF;

  UPDATE public.profiles
  SET alert_credits_extra = v_extra - p_amount
  WHERE id = p_user_id;

  RETURN 'consumed';
END;
$$;

-- ------------------------------------------------------------
-- 5) Grants
-- ------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.credit_purchases TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.alert_credit_purchases TO service_role;

GRANT SELECT ON public.credit_purchases TO authenticated;
GRANT SELECT ON public.alert_credit_purchases TO authenticated;

GRANT EXECUTE ON FUNCTION public.add_research_credits(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_research_report(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_alert_credits(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_alert_credit(uuid, integer) TO service_role;
