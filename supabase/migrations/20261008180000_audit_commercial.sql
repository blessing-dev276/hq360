ALTER TABLE public.audit_findings ADD COLUMN commercial jsonb;
CREATE TABLE public.audit_commercial_config (
 id text PRIMARY KEY CHECK (id='default'), payload jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.audit_service_matches (
 audit_id uuid NOT NULL REFERENCES public.author_audits(id) ON DELETE CASCADE,
 finding_id uuid NOT NULL REFERENCES public.audit_findings(id) ON DELETE CASCADE,
 service_id text NOT NULL, mapping jsonb NOT NULL,
 PRIMARY KEY(audit_id, finding_id, service_id)
);
CREATE TABLE public.audit_proposals (
 audit_id uuid PRIMARY KEY REFERENCES public.author_audits(id) ON DELETE CASCADE,
 draft jsonb NOT NULL, revision integer NOT NULL DEFAULT 1,
 audit_revision bigint NOT NULL, config_revision text NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','shared')),
 approved_by text, approved_at timestamptz, shared_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(status='draft' OR (approved_by='admin' AND approved_at IS NOT NULL)),
 CHECK(status<>'shared' OR shared_at IS NOT NULL)
);
DO $$DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['audit_commercial_config','audit_service_matches','audit_proposals'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
 EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO service_role',t);
 END LOOP;
END $$;
CREATE FUNCTION public.audit_save_service_matches(p_audit uuid,p_revision bigint,p_matches jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM 1 FROM author_audits WHERE id=p_audit AND workflow_revision=p_revision FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Audit changed; refresh'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_matches) m WHERE NOT EXISTS(SELECT 1 FROM audit_findings f WHERE f.id=(m->>'finding_id')::uuid AND f.audit_id=p_audit)) THEN RAISE EXCEPTION 'Finding outside audit'; END IF;
 DELETE FROM audit_service_matches WHERE audit_id=p_audit;
 INSERT INTO audit_service_matches(audit_id,finding_id,service_id,mapping)
 SELECT p_audit,(m->>'finding_id')::uuid,m->>'service_id',m FROM jsonb_array_elements(p_matches) m;
END $$;
REVOKE ALL ON FUNCTION public.audit_save_service_matches(uuid,bigint,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_save_service_matches(uuid,bigint,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.audit_import_research(p_audit uuid,p_actor text,p_source text,p_raw text,p_data jsonb)
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
 INSERT INTO audit_findings(audit_id,import_id,origin,section,category,title,observation,what_we_checked,evidence_text,interpretation,why_it_matters,recommendation,implementation_steps,source_urls,classification,priority,status,review_status,client_visible,impact_score,effort_score,confidence_score,capability_slug,manual_status,commercial)
 VALUES(p_audit,iid,'research_import',item->>'category',item->>'category',item->>'title',item->>'what_we_found',item->>'what_we_checked',item->>'evidence',item->>'interpretation',item->>'why_it_matters',item->>'recommendation',ARRAY(SELECT jsonb_array_elements_text(item->'implementation_steps')),ARRAY(SELECT jsonb_array_elements_text(item->'source_urls')),item->>'classification',item->>'priority','opportunity_identified','ai_research',false,(item->>'impact_score')::integer,(item->>'effort_score')::integer,(item->>'confidence_score')::integer,item->>'service_match','pending',item->'commercial');
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
