-- Balanced random trainer draw: a trainee is drawn at random from the
-- trainers with the fewest trainees right now, so no trainer gets a second
-- trainee while another still has none (counts never differ by more than one).
CREATE OR REPLACE FUNCTION public.assign_academy_trainer(p_trainee uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE picked uuid; current_trainer uuid;
BEGIN
  -- One draw at a time, so two sign ins can't both pick the same "emptiest" trainer.
  PERFORM pg_advisory_xact_lock(hashtext('assign_academy_trainer'));
  SELECT trainer_id INTO current_trainer FROM profiles
    WHERE id = p_trainee AND role = 'trainee' FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF current_trainer IS NOT NULL
     AND EXISTS (SELECT 1 FROM profiles WHERE id = current_trainer AND role = 'trainer') THEN
    RETURN current_trainer;
  END IF;
  SELECT t.id INTO picked
    FROM profiles t
    LEFT JOIN profiles s ON s.trainer_id = t.id AND s.role = 'trainee'
    WHERE t.role = 'trainer' AND t.id <> p_trainee
    GROUP BY t.id
    ORDER BY count(s.id), random()
    LIMIT 1;
  IF picked IS NULL THEN RETURN NULL; END IF;
  UPDATE profiles SET trainer_id = picked, trainer_assigned_at = now() WHERE id = p_trainee;
  RETURN picked;
END $$;
REVOKE ALL ON FUNCTION public.assign_academy_trainer(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_academy_trainer(uuid) TO service_role;
