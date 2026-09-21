-- Source access, durable crawl leases/cache, provenance, and human identity review.
ALTER TABLE public.scout_sources
 ADD COLUMN source_access_status text NOT NULL DEFAULT 'unknown' CHECK (source_access_status IN ('allowed','limited','manual_only','blocked','unknown')),
 ADD COLUMN robots_status text NOT NULL DEFAULT 'unknown',
 ADD COLUMN max_pages integer NOT NULL DEFAULT 2 CHECK (max_pages BETWEEN 1 AND 10),
 ADD COLUMN max_records integer NOT NULL DEFAULT 40 CHECK (max_records BETWEEN 1 AND 200),
 ADD COLUMN crawl_delay_ms integer NOT NULL DEFAULT 2000 CHECK (crawl_delay_ms BETWEEN 1000 AND 60000),
 ADD COLUMN next_crawl_at timestamptz,
 ADD COLUMN crawl_lease_until timestamptz,
 ADD COLUMN crawl_token uuid,
 ADD COLUMN records_discovered integer NOT NULL DEFAULT 0,
 ADD COLUMN books_added integer NOT NULL DEFAULT 0,
 ADD COLUMN authors_added integer NOT NULL DEFAULT 0,
 ADD COLUMN daily_records integer NOT NULL DEFAULT 0,
 ADD COLUMN daily_date date NOT NULL DEFAULT CURRENT_DATE;
UPDATE public.scout_sources SET source_access_status='allowed', sync_schedule='manual', collection_limit_per_day=200 WHERE slug='google_books';
UPDATE public.scout_sources SET source_access_status='limited', sync_schedule='manual', max_pages=1, max_records=40, collection_limit_per_day=40,
 terms_notes='Human-initiated low-volume Subjects API lookups only; select a genre. Robots prohibits /search.json. No scheduled harvesting. https://openlibrary.org/developers/api (reviewed 2026-09-21).'
 WHERE slug='open_library';
UPDATE public.scout_sources SET enabled=false, source_access_status='manual_only', sync_schedule='manual' WHERE kind <> 'api';
UPDATE public.scout_sources SET access_method='Public pages inspected; permission required for scouting scrape',
 terms_notes='Reviewed 2026-09-21: https://reedsy.com/robots.txt permits /discovery, but https://reedsy.com/about/tou requires permission for this use of scraped content. No automated requests until permission is obtained.'
 WHERE slug='reedsy_discovery';
INSERT INTO public.scout_sources(slug,name,kind,source_access_status,terms_notes) VALUES
 ('storygraph','StoryGraph','unimplemented','unknown','Site-specific permission review required.'),
 ('literary_magazines','Literary magazines','manual','unknown','Onboard each domain separately.'),
 ('university_presses','University presses','manual','unknown','Onboard each domain separately.'),
 ('book_reviews','Book review websites','manual','unknown','Onboard each domain separately.'),
 ('public_directories','Public book / author directories','manual','unknown','Onboard each domain separately.') ON CONFLICT DO NOTHING;

ALTER TABLE public.scout_authors DROP CONSTRAINT scout_authors_normalized_name_key;
CREATE INDEX ON public.scout_authors(normalized_name);
ALTER TABLE public.scout_authors
 ADD COLUMN source_slug text REFERENCES public.scout_sources(slug),
 ADD COLUMN source_url text,
 ADD COLUMN author_profile_url text,
 ADD COLUMN social_links jsonb NOT NULL DEFAULT '[]',
 ADD COLUMN confidence_score integer NOT NULL DEFAULT 0 CHECK(confidence_score BETWEEN 0 AND 100),
 ADD COLUMN identity_status text NOT NULL DEFAULT 'needs_review' CHECK(identity_status IN ('needs_review','verified','rejected','merged')),
 ADD COLUMN verified_at timestamptz,
 ADD COLUMN merged_into uuid REFERENCES public.scout_authors(id),
 ADD COLUMN outreach_suppressed boolean NOT NULL DEFAULT false,
 ADD COLUMN qualification jsonb NOT NULL DEFAULT '{}';
CREATE UNIQUE INDEX scout_author_profile ON public.scout_authors(source_slug,author_profile_url) WHERE author_profile_url IS NOT NULL AND merged_into IS NULL;
ALTER TABLE public.scout_discovered_books
 ADD COLUMN subtitle text,
 ADD COLUMN categories jsonb NOT NULL DEFAULT '[]',
 ADD COLUMN cover_image_url text,
 ADD COLUMN verification_status text NOT NULL DEFAULT 'needs_review',
 ADD COLUMN confidence_score integer NOT NULL DEFAULT 0 CHECK(confidence_score BETWEEN 0 AND 100);
CREATE INDEX ON public.scout_discovered_books(isbn);
CREATE INDEX ON public.scout_discovered_books(source_url);

CREATE TABLE public.scout_crawl_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_slug text NOT NULL REFERENCES public.scout_sources(slug),
 started_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 status text NOT NULL DEFAULT 'running' CHECK(status IN ('running','completed','failed','blocked')),
 pages integer NOT NULL DEFAULT 0, records integer NOT NULL DEFAULT 0, books_added integer NOT NULL DEFAULT 0,
 authors_added integer NOT NULL DEFAULT 0, errors jsonb NOT NULL DEFAULT '[]', batch_id uuid REFERENCES public.scout_batches(id)
);
CREATE INDEX ON public.scout_crawl_runs(source_slug,started_at DESC);
CREATE TABLE public.scout_page_cache (
 url text PRIMARY KEY, body text NOT NULL, expires_at timestamptz NOT NULL, fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.scout_book_sources (
 source_slug text NOT NULL REFERENCES public.scout_sources(slug), source_url text NOT NULL,
 book_id uuid NOT NULL REFERENCES public.scout_discovered_books(id), collected_at timestamptz NOT NULL DEFAULT now(),
 normalized_data jsonb NOT NULL, PRIMARY KEY(source_slug,source_url)
);
CREATE TABLE public.scout_batch_books (
 batch_id uuid NOT NULL REFERENCES public.scout_batches(id) ON DELETE CASCADE,
 book_id uuid NOT NULL REFERENCES public.scout_discovered_books(id) ON DELETE CASCADE,
 PRIMARY KEY(batch_id,book_id)
);
INSERT INTO public.scout_batch_books(batch_id,book_id) SELECT batch_id,id FROM public.scout_discovered_books WHERE batch_id IS NOT NULL;
CREATE TABLE public.scout_identity_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), author_id uuid NOT NULL REFERENCES public.scout_authors(id),
 candidate_id uuid REFERENCES public.scout_authors(id), confidence_score integer NOT NULL CHECK(confidence_score BETWEEN 0 AND 100),
 evidence jsonb NOT NULL DEFAULT '{}', decision text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(author_id,candidate_id)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['scout_crawl_runs','scout_page_cache','scout_book_sources','scout_identity_reviews','scout_batch_books'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated',t);
 EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;
-- Global lease serializes automated saving and domain requests across workers.
-- A run has a strict 90s budget; 5 minutes gives a safe recovery interval after crashes.
CREATE OR REPLACE FUNCTION public.scout_claim_source(p_slug text, p_scheduled boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE token uuid := gen_random_uuid(); s scout_sources;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('scout-crawl-claim'));
 IF EXISTS(SELECT 1 FROM scout_sources WHERE crawl_lease_until > now()) THEN RETURN NULL; END IF;
 UPDATE scout_crawl_runs SET status='failed',completed_at=now(),errors=errors || jsonb_build_array(jsonb_build_object('message','Worker interrupted; crawl lease expired','url','','at',now())) WHERE status='running' AND started_at<now()-interval '5 minutes';
 SELECT * INTO s FROM scout_sources WHERE slug=p_slug FOR UPDATE;
 IF NOT FOUND OR NOT s.enabled OR s.source_access_status NOT IN ('allowed','limited') THEN RETURN NULL; END IF;
 IF p_scheduled AND (s.slug='open_library' OR s.sync_schedule IS NULL OR s.sync_schedule NOT IN ('daily','weekly') OR s.next_crawl_at > now()) THEN RETURN NULL; END IF;
 UPDATE scout_sources SET crawl_token=token, crawl_lease_until=now()+interval '5 minutes',
 daily_records=CASE WHEN daily_date=CURRENT_DATE THEN daily_records ELSE 0 END,daily_date=CURRENT_DATE WHERE slug=p_slug;
 RETURN token;
END $$;
REVOKE ALL ON FUNCTION public.scout_claim_source(text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scout_claim_source(text,boolean) TO service_role;

-- Atomic, evidence-audited manual merge. Preserve source provenance and outreach history.
CREATE OR REPLACE FUNCTION public.scout_merge_authors(p_from uuid,p_into uuid,p_evidence text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b scout_discovered_books; target_book uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('scout-crawl-claim'));
 IF EXISTS(SELECT 1 FROM scout_sources WHERE crawl_lease_until>now()) THEN RAISE EXCEPTION 'Crawl in progress'; END IF;
 IF p_from=p_into OR length(trim(p_evidence))<10 THEN RAISE EXCEPTION 'Distinct authors and evidence required'; END IF;
 PERFORM 1 FROM scout_authors WHERE id IN (p_from,p_into) ORDER BY id FOR UPDATE;
 IF (SELECT count(*) FROM scout_authors WHERE id IN (p_from,p_into) AND identity_status NOT IN ('merged','rejected'))<>2 THEN RAISE EXCEPTION 'Invalid authors'; END IF;
 FOR b IN SELECT * FROM scout_discovered_books WHERE scout_author_id=p_from LOOP
 SELECT id INTO target_book FROM scout_discovered_books WHERE scout_author_id=p_into AND normalized_title=b.normalized_title;
 IF target_book IS NOT NULL THEN
 UPDATE scout_book_sources SET book_id=target_book WHERE book_id=b.id;
 INSERT INTO scout_review_counts(book_id,platform,review_count,rating,verified,source_url,retrieved_at)
 SELECT target_book,platform,review_count,rating,verified,source_url,retrieved_at FROM scout_review_counts WHERE book_id=b.id ON CONFLICT DO NOTHING;
 -- Keep old book/prospect rows as an audit trail; UI can follow merged_into.
 ELSE UPDATE scout_discovered_books SET scout_author_id=p_into WHERE id=b.id;
 END IF;
 END LOOP;
 UPDATE scout_authors SET outreach_suppressed=true WHERE id=p_into AND (EXISTS(SELECT 1 FROM scout_authors WHERE id=p_from AND outreach_suppressed) OR EXISTS(SELECT 1 FROM scout_prospects WHERE scout_author_id=p_from AND do_not_contact));
 UPDATE scout_authors SET merged_into=p_into WHERE merged_into=p_from;
 UPDATE scout_authors SET merged_into=p_into,identity_status='merged' WHERE id=p_from;
 UPDATE scout_prospects SET do_not_contact=true WHERE scout_author_id=p_from;
 UPDATE scout_authors SET identity_status='needs_review',verified_at=NULL WHERE id=p_into;
 INSERT INTO scout_identity_reviews(author_id,candidate_id,confidence_score,evidence,decision)
 VALUES(p_from,p_into,100,jsonb_build_object('manual_evidence',p_evidence),'merged')
 ON CONFLICT(author_id,candidate_id) DO UPDATE SET decision='merged',evidence=excluded.evidence;
END $$;
REVOKE ALL ON FUNCTION public.scout_merge_authors(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.scout_merge_authors(uuid,uuid,text) TO service_role;

-- Qualification never substitutes for human identity/contact verification.
CREATE OR REPLACE FUNCTION public.scout_outreach_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.status IN ('qualified','contacted','replied','interested') AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
 IF NOT EXISTS(SELECT 1 FROM scout_authors WHERE id=NEW.scout_author_id AND identity_status='verified' AND verified_at IS NOT NULL AND merged_into IS NULL) THEN
 RAISE EXCEPTION 'Manual identity verification required before qualification/outreach'; END IF;
 IF EXISTS(SELECT 1 FROM scout_prospects p JOIN scout_authors a ON a.id=p.scout_author_id WHERE a.id=NEW.scout_author_id AND p.do_not_contact AND p.id<>NEW.id) THEN RAISE EXCEPTION 'Author has a suppressed prospect'; END IF;
 IF EXISTS(SELECT 1 FROM scout_authors WHERE id=NEW.scout_author_id AND outreach_suppressed) THEN RAISE EXCEPTION 'Author outreach suppressed'; END IF;
 IF NEW.status='contacted' AND NEW.do_not_contact AND (TG_OP='INSERT' OR OLD.do_not_contact) THEN RAISE EXCEPTION 'Do not contact'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER scout_outreach_guard BEFORE INSERT OR UPDATE ON public.scout_prospects FOR EACH ROW EXECUTE FUNCTION public.scout_outreach_guard();

CREATE OR REPLACE FUNCTION public.scout_save_book(p_book jsonb,p_batch uuid,p_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a scout_authors; b scout_discovered_books; author_new boolean:=false; book_new boolean:=false;
BEGIN
 PERFORM 1 FROM scout_sources WHERE slug=p_book->>'source' FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM scout_sources WHERE slug=p_book->>'source' AND crawl_token=p_token AND crawl_lease_until>now() AND enabled AND source_access_status IN ('allowed','limited')) THEN RAISE EXCEPTION 'Invalid lease'; END IF;
 PERFORM 1 FROM scout_sources WHERE slug=p_book->>'source' FOR UPDATE;
 IF EXISTS(SELECT 1 FROM scout_sources WHERE slug=p_book->>'source' AND daily_records >= coalesce(collection_limit_per_day,200)) THEN RAISE EXCEPTION 'Daily record limit reached'; END IF;
 IF coalesce(p_book->>'source_url','')='' OR coalesce(p_book->>'book_title','')='' OR coalesce(p_book->>'author_name','')='' THEN RAISE EXCEPTION 'Missing provenance/title/author'; END IF;
 -- A canonical source URL identifies a record, never a name alone.
 SELECT books.* INTO b FROM scout_book_sources s JOIN scout_discovered_books books ON books.id=s.book_id WHERE s.source_slug=p_book->>'source' AND s.source_url=p_book->>'source_url';
 IF b.id IS NULL THEN
 SELECT * INTO b FROM scout_discovered_books WHERE source_slug=p_book->>'source' AND source_url=p_book->>'source_url' LIMIT 1;
 END IF;
 IF b.id IS NOT NULL THEN
 SELECT * INTO a FROM scout_authors WHERE id=b.scout_author_id;
 ELSE
 IF p_book->>'author_profile_url' IS NOT NULL THEN
 SELECT * INTO a FROM scout_authors WHERE source_slug=p_book->>'source' AND author_profile_url=p_book->>'author_profile_url' AND merged_into IS NULL;
 END IF;
 IF a.id IS NULL THEN
 INSERT INTO scout_authors(name,normalized_name,source_slug,source_url,author_profile_url,website_url,bio,social_links,confidence_score)
 VALUES(p_book->>'author_name',p_book->>'normalized_name',p_book->>'source',p_book->>'source_url',p_book->>'author_profile_url',p_book->>'author_website',p_book->>'bio',p_book->'social_links',(p_book->>'confidence_score')::int) RETURNING * INTO a;
 author_new:=true;
 END IF;
 SELECT * INTO b FROM scout_discovered_books WHERE scout_author_id=a.id AND normalized_title=p_book->>'normalized_title';
 IF b.id IS NULL THEN
 INSERT INTO scout_discovered_books(scout_author_id,title,normalized_title,genre,publication_date,publication_year,publisher,isbn,source_slug,source_url,external_id,raw_data,batch_id,description,subtitle,categories,cover_image_url,confidence_score)
 VALUES(a.id,p_book->>'book_title',p_book->>'normalized_title',p_book->>'genre',(p_book->>'publication_date')::date,(p_book->>'publication_year')::int,p_book->>'publisher',p_book->>'isbn',p_book->>'source',p_book->>'source_url',p_book->>'external_id',p_book->'raw_data',p_batch,p_book->>'description',p_book->>'subtitle',p_book->'categories',p_book->>'cover_image_url',(p_book->>'confidence_score')::int) RETURNING * INTO b;
 book_new:=true;
 END IF;
 END IF;
 INSERT INTO scout_book_sources(source_slug,source_url,book_id,normalized_data)
 VALUES(p_book->>'source',p_book->>'source_url',b.id,p_book)
 ON CONFLICT(source_slug,source_url) DO UPDATE SET normalized_data=excluded.normalized_data,collected_at=now();
 IF p_book->>'review_platform' IS NOT NULL THEN
 INSERT INTO scout_review_counts(book_id,platform,review_count,rating,verified,source_url)
 VALUES(b.id,p_book->>'review_platform',(p_book->>'review_count')::int,(p_book->>'rating')::numeric,true,p_book->>'source_url')
 ON CONFLICT(book_id,platform) DO UPDATE SET review_count=excluded.review_count,rating=excluded.rating,source_url=excluded.source_url,retrieved_at=now();
 END IF;
 INSERT INTO scout_batch_books(batch_id,book_id) VALUES(p_batch,b.id) ON CONFLICT DO NOTHING;
 UPDATE scout_sources SET daily_records=daily_records+1,records_discovered=records_discovered+1,books_added=books_added+book_new::int,authors_added=authors_added+author_new::int WHERE slug=p_book->>'source';
 RETURN jsonb_build_object('author',to_jsonb(a),'book',to_jsonb(b),'authorAdded',author_new,'bookAdded',book_new);
END $$;
REVOKE ALL ON FUNCTION public.scout_save_book(jsonb,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.scout_save_book(jsonb,uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.scout_review_author(p_id uuid,p_action text,p_evidence text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_action NOT IN ('verify','reject') OR length(trim(p_evidence))<10 THEN RAISE EXCEPTION 'Valid action and evidence required'; END IF;
 UPDATE scout_authors SET identity_status=CASE WHEN p_action='verify' THEN 'verified' ELSE 'rejected' END,
 confidence_score=CASE WHEN p_action='verify' THEN 100 ELSE 0 END,verified_at=CASE WHEN p_action='verify' THEN now() ELSE NULL END
 WHERE id=p_id AND merged_into IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Author not available'; END IF;
 INSERT INTO scout_identity_reviews(author_id,confidence_score,evidence,decision) VALUES(p_id,CASE WHEN p_action='verify' THEN 100 ELSE 0 END,jsonb_build_object('manual_evidence',p_evidence),p_action);
 UPDATE scout_identity_reviews SET decision=p_action WHERE author_id=p_id AND decision='pending';
 IF p_action='reject' THEN UPDATE scout_authors SET outreach_suppressed=true WHERE id=p_id; UPDATE scout_prospects SET do_not_contact=true,status='excluded',excluded_reason=p_evidence WHERE scout_author_id=p_id; END IF;
END $$;
REVOKE ALL ON FUNCTION public.scout_review_author(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.scout_review_author(uuid,text,text) TO service_role;
