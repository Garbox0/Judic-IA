-- 1. Ensure RLS is active on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing to avoid duplication errors
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- 3. Create robust policies for Profiles
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 4. Fix Storage Ownership (Ensures users own what they upload)
-- Make sure the 'avatars' bucket has owner-based delete/update
DROP POLICY IF EXISTS "User Update Own" ON storage.objects;
DROP POLICY IF EXISTS "User Delete Own" ON storage.objects;

CREATE POLICY "User Update Own"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'avatars' AND (auth.uid() = owner OR owner IS NULL) );

CREATE POLICY "User Delete Own"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'avatars' AND (auth.uid() = owner OR owner IS NULL) );

-- 5. Helper to allow profiles table to be updated by the system trigger if needed
-- (Security Definer functions are usually better, but we ensure basic access here)
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;
