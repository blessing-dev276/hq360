-- Author Scout Academy: trainee practice room with an AI "demo author".
-- Server routes use the service role for writes; RLS still protects direct
-- client access with the anon key.

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'trainee' CHECK (role IN ('trainer', 'trainee')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.sessions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  persona TEXT NOT NULL,
  mood TEXT NOT NULL,
  challenge TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('cold', 'no')),
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  coaching JSONB,
  ended BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON public.sessions (user_id, created_at DESC);

CREATE TABLE public.demos (
  id TEXT PRIMARY KEY,
  session JSONB NOT NULL,
  shared_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  shared_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.usage_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('reply', 'hint', 'coach')),
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX usage_log_user_day_idx ON public.usage_log (user_id, kind, created_at DESC);

GRANT ALL ON public.profiles, public.sessions, public.demos, public.usage_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.usage_log_id_seq TO service_role;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.demos TO authenticated;

-- Role check that does not recurse through profiles RLS.
CREATE OR REPLACE FUNCTION public.is_trainer()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'trainer');
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles read own or trainer" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_trainer());
-- Users may edit their name but never promote themselves.
CREATE POLICY "profiles update own" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()));

CREATE POLICY "sessions read own or trainer" ON public.sessions
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_trainer());
CREATE POLICY "sessions insert own" ON public.sessions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "sessions update own" ON public.sessions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "sessions delete own" ON public.sessions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "demos read signed in" ON public.demos
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "demos insert trainer" ON public.demos
  FOR INSERT TO authenticated WITH CHECK (public.is_trainer());
CREATE POLICY "demos delete trainer" ON public.demos
  FOR DELETE TO authenticated USING (public.is_trainer());

-- usage_log: no policies, so only the service role (server) can touch it.

CREATE OR REPLACE FUNCTION public.sessions_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.sessions_touch_updated_at();

-- Every new sign up becomes a trainee. Promote yourself with:
--   UPDATE public.profiles SET role = 'trainer' WHERE email = 'you@example.com';
CREATE OR REPLACE FUNCTION public.handle_new_academy_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_academy
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_academy_user();
