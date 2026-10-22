-- The owner can see a tracker's current passcode until it is replaced.
-- passcode_hash still does the checking; this is an AES-256-GCM copy bound to
-- the tracker id (src/lib/trackers/service.server.ts), readable only server side.
ALTER TABLE public.client_trackers ADD COLUMN passcode_encrypted text
  CHECK (passcode_encrypted IS NULL OR passcode_encrypted ~ '^v1\.');
