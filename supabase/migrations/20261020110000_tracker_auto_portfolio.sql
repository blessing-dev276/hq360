-- Auto portfolio (spec feature D). A finished tracker item becomes a portfolio
-- entry only with recorded client consent, only when it is Complete and the
-- expert marked it Portfolio ready. The rules live in the database so no code
-- path can skip them, and withdrawing consent removes the entries at once.

ALTER TABLE public.client_trackers
  ADD COLUMN consent_at timestamptz,
  ADD COLUMN consent_method text CHECK (consent_method IS NULL OR char_length(consent_method) BETWEEN 2 AND 300),
  -- Whether the entry may name the client or book.
  ADD COLUMN consent_allows_naming boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT client_trackers_consent_recorded
    CHECK (NOT portfolio_consent OR (consent_at IS NOT NULL AND consent_method IS NOT NULL));

ALTER TABLE public.tracker_items
  -- Person approved case study text (2 to 3 sentences); never raw item notes.
  ADD COLUMN portfolio_blurb text NOT NULL DEFAULT '' CHECK (char_length(portfolio_blurb) <= 900);

ALTER TABLE public.expert_profiles
  ADD COLUMN portfolio_auto_publish boolean NOT NULL DEFAULT false;

ALTER TABLE public.expert_portfolio_items
  ADD COLUMN source_tracker_item_id uuid UNIQUE REFERENCES public.tracker_items(id) ON DELETE CASCADE,
  ADD COLUMN video_url text;
ALTER TABLE public.expert_portfolio_items DROP CONSTRAINT IF EXISTS expert_portfolio_items_status_check;
ALTER TABLE public.expert_portfolio_items ADD CONSTRAINT expert_portfolio_items_status_check
  CHECK (status IN ('draft', 'pending', 'approved', 'rejected'));

CREATE FUNCTION public.tracker_portfolio_allowed(p_item uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tracker_items i
    JOIN public.client_trackers t ON t.id = i.tracker_id
    WHERE i.id = p_item AND t.portfolio_consent AND t.status <> 'archived'
      AND i.status = 'done' AND i.portfolio_ready
  );
$$;

CREATE FUNCTION public.expert_portfolio_tracker_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.source_tracker_item_id IS NOT NULL AND NOT public.tracker_portfolio_allowed(NEW.source_tracker_item_id) THEN
    RAISE EXCEPTION 'portfolio entry needs client consent and a complete, portfolio ready item'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER expert_portfolio_tracker_guard BEFORE INSERT OR UPDATE ON public.expert_portfolio_items
FOR EACH ROW EXECUTE FUNCTION public.expert_portfolio_tracker_guard();

-- Consent withdrawn or tracker archived: remove every entry from that tracker.
CREATE FUNCTION public.tracker_consent_withdrawn() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (OLD.portfolio_consent AND NOT NEW.portfolio_consent) OR NEW.status = 'archived' THEN
    DELETE FROM public.expert_portfolio_items p
    USING public.tracker_items i
    WHERE p.source_tracker_item_id = i.id AND i.tracker_id = NEW.id;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER tracker_consent_withdrawn AFTER UPDATE OF portfolio_consent, status ON public.client_trackers
FOR EACH ROW EXECUTE FUNCTION public.tracker_consent_withdrawn();

-- An item reopened or unmarked by the expert leaves the portfolio too.
CREATE FUNCTION public.tracker_item_left_portfolio() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status <> 'done' OR NOT NEW.portfolio_ready THEN
    DELETE FROM public.expert_portfolio_items WHERE source_tracker_item_id = NEW.id;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER tracker_item_left_portfolio AFTER UPDATE OF status, portfolio_ready ON public.tracker_items
FOR EACH ROW EXECUTE FUNCTION public.tracker_item_left_portfolio();

REVOKE ALL ON FUNCTION public.tracker_portfolio_allowed(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tracker_portfolio_allowed(uuid) TO service_role;
