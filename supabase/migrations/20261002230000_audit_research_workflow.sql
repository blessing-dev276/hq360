ALTER TABLE public.author_audits DROP CONSTRAINT author_audits_status_check;
ALTER TABLE public.author_audits ADD CONSTRAINT author_audits_status_check CHECK(status IN ('draft','researching','needs_verification','ready_for_review','completed','report_sent','follow_up','converted','archived','research_pending','research_ready','research_imported','under_review','needs_manual_work','approved','site_generated','qa_review','published'));
ALTER TABLE public.author_audits ADD COLUMN workflow_version integer NOT NULL DEFAULT 0,
 ADD COLUMN review_status text NOT NULL DEFAULT 'not_started',
 ADD COLUMN publish_status text NOT NULL DEFAULT 'not_ready',
 ADD COLUMN created_by text,
 ADD COLUMN research_source text NOT NULL DEFAULT 'Other',
 ADD COLUMN generated_prompt text,
 ADD COLUMN cta_enabled boolean NOT NULL DEFAULT false;
CREATE TABLE public.audit_assignments(audit_id uuid REFERENCES public.author_audits(id) ON DELETE CASCADE,expert_id uuid REFERENCES public.expert_profiles(id) ON DELETE CASCADE,role text NOT NULL CHECK(role IN ('expert','reviewer')),PRIMARY KEY(audit_id,expert_id));
CREATE TABLE public.audit_prompt_templates(id text PRIMARY KEY DEFAULT 'default',template text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),updated_by text);
CREATE TABLE public.audit_research_imports(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),audit_id uuid NOT NULL REFERENCES public.author_audits(id) ON DELETE CASCADE,created_at timestamptz NOT NULL DEFAULT now(),imported_by text NOT NULL,source text NOT NULL,raw_text text NOT NULL,raw_research_json jsonb NOT NULL,normalized_audit_data jsonb NOT NULL, UNIQUE(audit_id,id));
CREATE TABLE public.audit_sections(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),audit_id uuid NOT NULL REFERENCES public.author_audits(id) ON DELETE CASCADE,key text NOT NULL,title text NOT NULL,content text NOT NULL DEFAULT '',enabled boolean NOT NULL DEFAULT true,sort_order integer NOT NULL DEFAULT 0,review_status text NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','approved','needs_changes','rejected')),UNIQUE(audit_id,key));
ALTER TABLE public.audit_findings ADD COLUMN origin text NOT NULL DEFAULT 'manual' CHECK(origin IN ('manual','research_import')),
 ADD COLUMN import_id uuid REFERENCES public.audit_research_imports(id),
 ADD COLUMN classification text NOT NULL DEFAULT 'unknown',
 ADD COLUMN what_we_checked text NOT NULL DEFAULT '',
 ADD COLUMN evidence_text text NOT NULL DEFAULT '',
 ADD COLUMN interpretation text NOT NULL DEFAULT '',
 ADD COLUMN implementation_steps text[] NOT NULL DEFAULT '{}',
 ADD COLUMN impact_score integer CHECK(impact_score BETWEEN 0 AND 10),
 ADD COLUMN effort_score integer CHECK(effort_score BETWEEN 0 AND 10),
 ADD COLUMN confidence_score integer CHECK(confidence_score BETWEEN 0 AND 100),
 ADD COLUMN manual_status text NOT NULL DEFAULT 'pending',
 ADD COLUMN reviewer_notes text NOT NULL DEFAULT '',
 ADD COLUMN featured boolean NOT NULL DEFAULT false,
 ADD COLUMN hidden boolean NOT NULL DEFAULT false;
CREATE TABLE public.audit_listopia(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),audit_id uuid NOT NULL REFERENCES public.author_audits(id) ON DELETE CASCADE,list_name text NOT NULL,list_url text NOT NULL,book_present boolean,position integer,page integer,votes integer,number_of_books integer,competition text NOT NULL DEFAULT 'unknown',relevance_score integer,books_above text[] NOT NULL DEFAULT '{}',books_below text[] NOT NULL DEFAULT '{}',why_position text NOT NULL DEFAULT '',how_to_improve text NOT NULL DEFAULT '',evidence text NOT NULL DEFAULT '',manual_status text NOT NULL DEFAULT 'pending',review_status text NOT NULL DEFAULT 'pending',reviewer_notes text NOT NULL DEFAULT '');
CREATE TABLE public.audit_review_tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),audit_id uuid NOT NULL REFERENCES public.author_audits(id) ON DELETE CASCADE,kind text NOT NULL CHECK(kind IN ('screenshot','manual')),category text NOT NULL,title text NOT NULL,instructions text NOT NULL DEFAULT '',required boolean NOT NULL DEFAULT true,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','uploaded','approved','not_applicable')),notes text NOT NULL DEFAULT '');
ALTER TABLE public.audit_evidence_assets ADD COLUMN original_filename text,
 ADD COLUMN listopia_id uuid REFERENCES public.audit_listopia(id) ON DELETE SET NULL,
 ADD COLUMN storage_path text,
 ADD COLUMN category text NOT NULL DEFAULT 'general',
 ADD COLUMN proves text NOT NULL DEFAULT '',
 ADD COLUMN uploaded_by text,
 ADD COLUMN review_status text NOT NULL DEFAULT 'pending',
 ADD COLUMN display_kind text NOT NULL DEFAULT 'current' CHECK(display_kind IN ('before','current','recommended')),
 ADD COLUMN sort_order integer NOT NULL DEFAULT 0,
 ADD COLUMN task_id uuid REFERENCES public.audit_review_tasks(id) ON DELETE SET NULL;
CREATE TABLE public.audit_action_plan(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),audit_id uuid NOT NULL REFERENCES public.author_audits(id) ON DELETE CASCADE,title text NOT NULL,description text NOT NULL DEFAULT '',horizon text NOT NULL DEFAULT 'do_first' CHECK(horizon IN ('do_first','next_30_days','next_90_days','long_term')),finding_ids uuid[] NOT NULL DEFAULT '{}',service text NOT NULL DEFAULT '',review_status text NOT NULL DEFAULT 'pending',sort_order integer NOT NULL DEFAULT 0);
CREATE TABLE public.audit_activity(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),audit_id uuid NOT NULL REFERENCES public.author_audits(id) ON DELETE CASCADE,actor text NOT NULL,action text NOT NULL,target_id text,details jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.audit_client_versions ADD COLUMN version_number integer,ADD COLUMN publisher text,ADD COLUMN change_notes text NOT NULL DEFAULT '',ADD COLUMN reviewed_audit_data jsonb;
CREATE UNIQUE INDEX audit_client_version_number ON public.audit_client_versions(audit_id,version_number);

CREATE FUNCTION public.audit_research_immutable() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'Original research imports are immutable'; END $$;
CREATE TRIGGER audit_research_immutable BEFORE UPDATE ON public.audit_research_imports FOR EACH ROW EXECUTE FUNCTION public.audit_research_immutable();
-- Preserve the existing immutable snapshot rule, including reviewed audit data.
CREATE OR REPLACE FUNCTION public.audit_client_snapshot_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$BEGIN
 IF NEW.snapshot IS DISTINCT FROM OLD.snapshot OR NEW.reviewed_audit_data IS DISTINCT FROM OLD.reviewed_audit_data OR NEW.audit_id<>OLD.audit_id OR NEW.created_at<>OLD.created_at OR NEW.version_number IS DISTINCT FROM OLD.version_number THEN RAISE EXCEPTION 'Report snapshots are immutable; create a new version'; END IF; RETURN NEW;
END $$;
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['audit_assignments','audit_prompt_templates','audit_research_imports','audit_sections','audit_listopia','audit_review_tasks','audit_action_plan','audit_activity'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t);
 EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
END LOOP;END $$;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('audit-research-evidence','audit-research-evidence',false,8388608,ARRAY['image/png','image/jpeg','image/webp']) ON CONFLICT(id) DO NOTHING;

-- One transaction preserves original research and normalizes editable records.
CREATE FUNCTION public.audit_import_research(p_audit uuid,p_actor text,p_source text,p_raw text,p_data jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE iid uuid:=gen_random_uuid(); item jsonb;
BEGIN
 PERFORM 1 FROM author_audits WHERE id=p_audit AND workflow_version=1 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Workflow audit required'; END IF;
 IF EXISTS(SELECT 1 FROM audit_research_imports WHERE audit_id=p_audit AND raw_text=p_raw) THEN RAISE EXCEPTION 'This research has already been imported'; END IF;
 INSERT INTO audit_research_imports(id,audit_id,imported_by,source,raw_text,raw_research_json,normalized_audit_data) VALUES(iid,p_audit,p_actor,p_source,p_raw,p_raw::jsonb,p_data);
 FOR item IN SELECT * FROM jsonb_array_elements(p_data->'sections') LOOP
 INSERT INTO audit_sections(audit_id,key,title,content,sort_order,enabled) VALUES(p_audit,item->>'key',item->>'title',item->>'content',(item->>'sort_order')::integer,(item->>'enabled')::boolean) ON CONFLICT(audit_id,key) DO NOTHING;
 END LOOP;
 FOR item IN SELECT * FROM jsonb_array_elements(p_data->'findings') LOOP
 INSERT INTO audit_findings(audit_id,import_id,origin,section,category,title,observation,what_we_checked,evidence_text,interpretation,why_it_matters,recommendation,implementation_steps,source_urls,classification,priority,status,review_status,client_visible,impact_score,effort_score,confidence_score,capability_slug,manual_status)
 VALUES(p_audit,iid,'research_import',item->>'category',item->>'category',item->>'title',item->>'what_we_found',item->>'what_we_checked',item->>'evidence',item->>'interpretation',item->>'why_it_matters',item->>'recommendation',ARRAY(SELECT jsonb_array_elements_text(item->'implementation_steps')),ARRAY(SELECT jsonb_array_elements_text(item->'source_urls')),item->>'classification',item->>'priority','opportunity_identified','ai_research',false,(item->>'impact_score')::integer,(item->>'effort_score')::integer,(item->>'confidence_score')::integer,item->>'service_match','pending');
 END LOOP;
 FOR item IN SELECT * FROM jsonb_array_elements(p_data->'listopia') LOOP
 INSERT INTO audit_listopia(audit_id,list_name,list_url,book_present,position,page,votes,number_of_books,competition,relevance_score,books_above,books_below,why_position,how_to_improve,evidence)
 VALUES(p_audit,item->>'list_name',item->>'list_url',(item->>'book_present')::boolean,(item->>'position')::integer,(item->>'page')::integer,(item->>'votes')::integer,(item->>'number_of_books')::integer,item->>'competition',(item->>'relevance_score')::integer,ARRAY(SELECT jsonb_array_elements_text(item->'books_above')),ARRAY(SELECT jsonb_array_elements_text(item->'books_below')),item->>'why_position',item->>'how_to_improve',item->>'evidence');
 END LOOP;
 FOR item IN SELECT * FROM jsonb_array_elements(p_data->'tasks') LOOP
 INSERT INTO audit_review_tasks(audit_id,kind,category,title,instructions,required) VALUES(p_audit,item->>'kind',item->>'category',item->>'title',item->>'instructions',(item->>'required')::boolean);
 END LOOP;
 FOR item IN SELECT * FROM jsonb_array_elements(p_data->'actions') LOOP
 INSERT INTO audit_action_plan(audit_id,title,description,horizon,service) VALUES(p_audit,item->>'title',item->>'description',item->>'horizon',item->>'service');
 END LOOP;
 UPDATE author_audits SET status='research_imported',review_status='not_started',publish_status='not_ready',input_snapshot=jsonb_set(input_snapshot,'{researchDate}',coalesce(p_data->'researchDate','null'::jsonb)),updated_at=now() WHERE id=p_audit;
 INSERT INTO audit_activity(audit_id,actor,action,target_id) VALUES(p_audit,p_actor,'research_imported',iid::text);
 RETURN iid;
END $$;
REVOKE ALL ON FUNCTION public.audit_import_research(uuid,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_import_research(uuid,text,text,text,jsonb) TO service_role;
ALTER TABLE public.author_audits ADD COLUMN workflow_revision bigint NOT NULL DEFAULT 0;
CREATE FUNCTION public.audit_touch_workflow() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE aid uuid;
BEGIN
 aid:=CASE WHEN TG_OP='DELETE' THEN OLD.audit_id ELSE NEW.audit_id END;
 UPDATE author_audits SET workflow_revision=workflow_revision+1,review_status='in_progress',publish_status='not_ready',status='under_review',updated_at=now() WHERE id=aid AND workflow_version=1;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['audit_findings','audit_sections','audit_listopia','audit_review_tasks','audit_action_plan','audit_evidence_assets'] LOOP
 EXECUTE format('CREATE TRIGGER audit_workflow_change BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_touch_workflow()',t);
END LOOP;END $$;
CREATE FUNCTION public.audit_create_reviewed_version(p_audit uuid,p_revision bigint,p_snapshot jsonb,p_actor text,p_notes text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE vid uuid:=gen_random_uuid(); rev bigint; num integer;
BEGIN
 SELECT workflow_revision INTO rev FROM author_audits WHERE id=p_audit AND workflow_version=1 FOR UPDATE;
 IF rev IS NULL OR rev<>p_revision THEN RAISE EXCEPTION 'Audit changed; refresh and generate again'; END IF;
 SELECT coalesce(max(version_number),0)+1 INTO num FROM audit_client_versions WHERE audit_id=p_audit;
 INSERT INTO audit_client_versions(id,audit_id,snapshot,reviewed_audit_data,version_number,publisher,change_notes) VALUES(vid,p_audit,p_snapshot,p_snapshot,num,p_actor,p_notes);
 UPDATE author_audits SET status='site_generated',publish_status='draft' WHERE id=p_audit;
 INSERT INTO audit_activity(audit_id,actor,action,target_id) VALUES(p_audit,p_actor,'client_site_generated',vid::text);
 RETURN vid;
END $$;
CREATE FUNCTION public.audit_publish_reviewed(p_audit uuid,p_version uuid,p_slug text,p_hash text,p_actor text,p_override text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rev bigint; snap jsonb; qa boolean;
BEGIN
 SELECT workflow_revision INTO rev FROM author_audits WHERE id=p_audit AND workflow_version=1 FOR UPDATE;
 SELECT snapshot,qa_confirmed INTO snap,qa FROM audit_client_versions WHERE id=p_version AND audit_id=p_audit AND published_at IS NULL;
 IF snap IS NULL OR rev<>(snap->>'revision')::bigint OR NOT qa THEN RAISE EXCEPTION 'Generate current draft and complete QA before publication'; END IF;
 IF jsonb_array_length(snap->'reviewIssues')>0 AND length(trim(coalesce(p_override,'')))<10 THEN RAISE EXCEPTION 'Required reviews are incomplete'; END IF;
 PERFORM audit_client_publish(p_audit,p_version,p_slug,p_hash,NULL);
 UPDATE audit_client_versions SET publisher=p_actor WHERE id=p_version;
 UPDATE author_audits SET status='published',publish_status='published',review_status='complete' WHERE id=p_audit;
 INSERT INTO audit_activity(audit_id,actor,action,target_id,details) VALUES(p_audit,p_actor,'published',p_version::text,jsonb_build_object('override_reason',p_override));
END $$;
REVOKE ALL ON FUNCTION public.audit_create_reviewed_version(uuid,bigint,jsonb,text,text), public.audit_publish_reviewed(uuid,uuid,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_create_reviewed_version(uuid,bigint,jsonb,text,text), public.audit_publish_reviewed(uuid,uuid,text,text,text,text) TO service_role;
CREATE FUNCTION public.audit_reorder_sections(p_audit uuid,p_ids uuid[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM 1 FROM author_audits WHERE id=p_audit FOR UPDATE;
 IF cardinality(p_ids)<>(SELECT count(*) FROM audit_sections WHERE audit_id=p_audit) OR cardinality(p_ids)<>(SELECT count(DISTINCT x) FROM unnest(p_ids) x) OR EXISTS(SELECT 1 FROM unnest(p_ids) x WHERE NOT EXISTS(SELECT 1 FROM audit_sections WHERE id=x AND audit_id=p_audit)) THEN RAISE EXCEPTION 'Section order must include every section exactly once'; END IF;
 UPDATE audit_sections s SET sort_order=ordered.position-1 FROM unnest(p_ids) WITH ORDINALITY AS ordered(id,position) WHERE s.id=ordered.id AND s.audit_id=p_audit;
END $$;
REVOKE ALL ON FUNCTION public.audit_reorder_sections(uuid,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_reorder_sections(uuid,uuid[]) TO service_role;
