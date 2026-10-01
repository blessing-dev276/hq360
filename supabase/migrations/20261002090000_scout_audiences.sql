-- Business and creator prospects have their own records; author/book tables remain unchanged.
CREATE TABLE public.scout_audience_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience text NOT NULL,
  source text NOT NULL CHECK (source IN ('maps','web')),
  label text NOT NULL,
  query text NOT NULL,
  location text NOT NULL DEFAULT '',
  page integer NOT NULL DEFAULT 1 CHECK (page BETWEEN 1 AND 10),
  requested_max integer NOT NULL CHECK (requested_max BETWEEN 1 AND 20),
  item_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.scout_audience_batches(audience, created_at DESC);
CREATE TABLE public.scout_audience_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('maps','web')),
  source_key text NOT NULL,
  name text NOT NULL,
  source_url text NOT NULL,
  website_url text,
  description text,
  category text,
  address text,
  phone text,
  rating numeric CHECK (rating BETWEEN 0 AND 5),
  review_count integer CHECK (review_count >= 0),
  contact_email text,
  contact_source_url text,
  contact_status text NOT NULL DEFAULT 'unverified' CHECK (contact_status IN ('unverified','verified')),
  shortlisted boolean NOT NULL DEFAULT false,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source, source_key)
);
CREATE TABLE public.scout_audience_batch_leads (
  batch_id uuid NOT NULL REFERENCES public.scout_audience_batches ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.scout_audience_leads ON DELETE CASCADE,
  PRIMARY KEY(batch_id, lead_id)
);
ALTER TABLE public.scout_audience_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_audience_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_audience_batch_leads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scout_audience_batches, public.scout_audience_leads, public.scout_audience_batch_leads FROM anon, authenticated;
GRANT ALL ON public.scout_audience_batches, public.scout_audience_leads, public.scout_audience_batch_leads TO service_role;

-- A retry with the same request UUID returns the original batch; storage is atomic.
CREATE FUNCTION public.scout_save_audience_batch(p_id uuid, p_audience text, p_source text, p_label text, p_query text, p_location text, p_page integer, p_limit integer, p_items jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item jsonb; v_lead uuid; v_count integer;
BEGIN
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) > 20 THEN RAISE EXCEPTION 'Invalid result set'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(p_id::text));
  IF EXISTS(SELECT 1 FROM scout_audience_batches WHERE id=p_id) THEN RETURN p_id; END IF;
  INSERT INTO scout_audience_batches(id,audience,source,label,query,location,page,requested_max)
    VALUES(p_id,p_audience,p_source,p_label,p_query,p_location,p_page,p_limit);
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO scout_audience_leads(source,source_key,name,source_url,website_url,description,category,address,phone,rating,review_count)
      VALUES(p_source,v_item->>'source_key',v_item->>'name',v_item->>'source_url',v_item->>'website_url',v_item->>'description',v_item->>'category',v_item->>'address',v_item->>'phone',(v_item->>'rating')::numeric,(v_item->>'review_count')::integer)
      ON CONFLICT(source,source_key) DO UPDATE SET name=EXCLUDED.name, source_url=EXCLUDED.source_url,
        website_url=COALESCE(EXCLUDED.website_url,scout_audience_leads.website_url), description=EXCLUDED.description,
        category=EXCLUDED.category,address=EXCLUDED.address,phone=EXCLUDED.phone,rating=EXCLUDED.rating,review_count=EXCLUDED.review_count,updated_at=now()
      RETURNING id INTO v_lead;
    INSERT INTO scout_audience_batch_leads(batch_id,lead_id) VALUES(p_id,v_lead) ON CONFLICT DO NOTHING;
  END LOOP;
  SELECT count(*) INTO v_count FROM scout_audience_batch_leads WHERE batch_id=p_id;
  UPDATE scout_audience_batches SET item_count=v_count WHERE id=p_id;
  RETURN p_id;
END $$;
REVOKE ALL ON FUNCTION public.scout_save_audience_batch(uuid,text,text,text,text,text,integer,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.scout_save_audience_batch(uuid,text,text,text,text,text,integer,integer,jsonb) TO service_role;
