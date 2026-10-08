-- Each trainee is randomly assigned one trainer, once, on first sign in. The
-- assigned trainer (not every trainer) sees that trainee's profile and chats.
ALTER TABLE public.profiles
  ADD COLUMN trainer_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN trainer_assigned_at timestamptz;
CREATE INDEX profiles_trainer_idx ON public.profiles (trainer_id);

-- Atomic, one-time random pick. Returns the trainer id (existing or new), or
-- null when there are no trainers yet.
CREATE OR REPLACE FUNCTION public.assign_academy_trainer(p_trainee uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE picked uuid; current_trainer uuid;
BEGIN
  SELECT trainer_id INTO current_trainer FROM profiles
    WHERE id = p_trainee AND role = 'trainee' FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF current_trainer IS NOT NULL THEN RETURN current_trainer; END IF;
  SELECT id INTO picked FROM profiles
    WHERE role = 'trainer' AND id <> p_trainee ORDER BY random() LIMIT 1;
  IF picked IS NULL THEN RETURN NULL; END IF;
  UPDATE profiles SET trainer_id = picked, trainer_assigned_at = now() WHERE id = p_trainee;
  RETURN picked;
END $$;
REVOKE ALL ON FUNCTION public.assign_academy_trainer(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_academy_trainer(uuid) TO service_role;

-- Browser-side access follows the assignment.
CREATE OR REPLACE FUNCTION public.is_trainer_of(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles t JOIN public.profiles s ON s.trainer_id = t.id
    WHERE t.id = auth.uid() AND t.role = 'trainer' AND s.id = p_user
  );
$$;

DROP POLICY "profiles read own or trainer" ON public.profiles;
CREATE POLICY "profiles read own or assigned trainer" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_trainer_of(id) OR (role = 'trainer' AND public.is_trainer()));

-- Users may edit their name but never their role or trainer.
DROP POLICY "profiles update own" ON public.profiles;
CREATE POLICY "profiles update own" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    AND trainer_id IS NOT DISTINCT FROM (SELECT p.trainer_id FROM public.profiles p WHERE p.id = auth.uid())
  );

DROP POLICY "sessions read own or trainer" ON public.sessions;
CREATE POLICY "sessions read own or assigned trainer" ON public.sessions
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_trainer_of(user_id));
