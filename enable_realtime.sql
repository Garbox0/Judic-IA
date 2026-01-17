-- FINAL REVISED SQL to Enable Realtime
-- This script uses a proper PL/pgSQL block to handle errors and logic safely.

-- 1. Ensure tables send the full row on updates
ALTER TABLE public.inquiries REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.attachments REPLICA IDENTITY FULL;

-- 2. Setup the Realtime Publication safely
DO $$
BEGIN
    -- Ensure the publication exists
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    -- Add tables to the publication
    -- We use separate BEGIN...EXCEPTION blocks for each table to handle "already exists" errors
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.inquiries;
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'Table inquiries already in publication.';
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'Table messages already in publication.';
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.attachments;
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'Table attachments already in publication.';
    END;
END $$;
