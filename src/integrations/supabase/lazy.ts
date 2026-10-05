// Load the browser Supabase client on demand. A static import would pull
// supabase-js (auth + realtime) into the shared entry bundle that every
// public page downloads; only expert sign-in needs it.
let client: Promise<(typeof import("./client"))["supabase"]> | null = null;

export function getSupabase() {
  client ??= import("./client").then((m) => m.supabase);
  return client;
}
