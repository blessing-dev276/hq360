INSERT INTO public.scout_sources(slug,name,kind,enabled,access_method,source_access_status)
VALUES
  ('booklife','BookLife','manual',false,'Public search index; direct catalogue crawling disallowed','manual_only'),
  ('onlinebookclub','OnlineBookClub','manual',false,'Public book search index and manual review','limited'),
  ('booknotification','BookNotification','manual',false,'Small public upcoming-release sample','limited')
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.scout_save_arc_batch(
  p_id uuid,
  p_source text,
  p_label text,
  p_genre text,
  p_items jsonb
)
RETURNS uuid LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF p_source NOT IN (
    'netgalley','booksirens','booksprout','storyorigin',
    'booklife','onlinebookclub','booknotification'
  ) OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)>10 THEN
    RAISE EXCEPTION 'Invalid discovery batch';
  END IF;
  INSERT INTO scout_batches(id,label,sources,genre,item_count)
  VALUES(p_id,p_label,ARRAY[p_source],nullif(p_genre,''),jsonb_array_length(p_items))
  ON CONFLICT(id) DO NOTHING;
  IF NOT FOUND THEN RETURN p_id; END IF;
  INSERT INTO scout_arc_listings(batch_id,source,source_url,title,author_name,publication_date,genre,evidence,discovery_method)
  SELECT p_id,p_source,x.source_url,x.title,x.author_name,x.publication_date,x.genre,x.evidence,x.discovery_method
  FROM jsonb_to_recordset(p_items) AS x(
    source_url text,title text,author_name text,publication_date date,
    genre text,evidence text,discovery_method text
  );
  RETURN p_id;
END $$;

REVOKE ALL ON FUNCTION public.scout_save_arc_batch(uuid,text,text,text,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.scout_save_arc_batch(uuid,text,text,text,jsonb)
  TO service_role;
