# Audit workflow upgrade

Extend author_audits, audit_findings, audit_evidence_assets and existing private
client versions/access/sessions. Existing audits retain their legacy workspace.
New audits use workflow_version=1 and a research → import → review → generated
snapshot → QA → publish sequence. Imports and client snapshots are immutable.

Implementation: schema/access; reusable editable prompt and strict import
validation; normalized review cards/sections/Listopia/actions/evidence; private
client snapshot rendering; publish/access/version controls; workflow tests.

Admin manages assignments and publishes. Assigned reviewers approve content;
assigned experts prepare content. Old mutation APIs cannot bypass this workflow.
No import can set approval, visibility, access codes or publication state.
