INSERT INTO public.scout_sources(slug,name,kind,enabled,access_method,source_access_status)
VALUES ('netgalley','NetGalley','manual',false,'Public search index and manual confirmation','manual_only'),
('booksirens','BookSirens','manual',false,'Guest catalogue sample and manual confirmation','limited'),
('booksprout','Booksprout','manual',false,'Public search index and manual confirmation','manual_only'),
('storyorigin','StoryOrigin','manual',false,'Public review-copy links; no member harvesting','manual_only')
ON CONFLICT(slug) DO NOTHING;
CREATE TABLE public.scout_arc_listings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 batch_id uuid NOT NULL REFERENCES public.scout_batches(id) ON DELETE CASCADE,
 source text NOT NULL REFERENCES public.scout_sources(slug),
 source_url text NOT NULL,
 title text NOT NULL DEFAULT '',
 author_name text,
 publication_date date,
 genre text,
 evidence text NOT NULL DEFAULT '',
 discovery_method text NOT NULL CHECK(discovery_method IN ('public_catalog','search_index','manual')),
 book_id uuid REFERENCES public.scout_discovered_books(id) ON DELETE SET NULL,
 UNIQUE(batch_id,source_url)
);
ALTER TABLE public.scout_arc_listings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scout_arc_listings FROM anon, authenticated;
GRANT ALL ON public.scout_arc_listings TO service_role;
CREATE FUNCTION public.scout_save_arc_batch(p_id uuid,p_source text,p_label text,p_genre text,p_items jsonb)
RETURNS uuid LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF p_source NOT IN ('netgalley','booksirens','booksprout','storyorigin') OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)>10 THEN RAISE EXCEPTION 'Invalid discovery batch'; END IF;
 INSERT INTO scout_batches(id,label,sources,genre,item_count) VALUES(p_id,p_label,ARRAY[p_source],nullif(p_genre,''),jsonb_array_length(p_items)) ON CONFLICT(id) DO NOTHING;
 IF NOT FOUND THEN RETURN p_id; END IF;
 INSERT INTO scout_arc_listings(batch_id,source,source_url,title,author_name,publication_date,genre,evidence,discovery_method)
 SELECT p_id,p_source,x.source_url,x.title,x.author_name,x.publication_date,x.genre,x.evidence,x.discovery_method
 FROM jsonb_to_recordset(p_items) AS x(source_url text,title text,author_name text,publication_date date,genre text,evidence text,discovery_method text);
 RETURN p_id;
END $$;
REVOKE ALL ON FUNCTION public.scout_save_arc_batch(uuid,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.scout_save_arc_batch(uuid,text,text,text,jsonb) TO service_role;
