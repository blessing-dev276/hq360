// Originally generated; edited for bundle size. Registered as a global
// `functionMiddleware` in src/start.ts so serverFn RPCs carry the signed-in
// user's bearer token.
//
// The browser Supabase client (auth + realtime) is loaded lazily, and only when
// a session is actually stored. A static import here put supabase-js into the
// entry bundle that every public visitor downloads, although only signed-in
// experts ever have a token to attach.
import { createMiddleware } from "@tanstack/react-start";

function hasStoredSession() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("sb-") && key.endsWith("-auth-token")) return true;
    }
  } catch {
    // Storage blocked (private mode etc.): no session to attach.
  }
  return false;
}

export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    if (!hasStoredSession()) return next({ headers: {} });
    const { getSupabase } = await import("./lazy");
    const { data } = await (await getSupabase()).auth.getSession();
    const token = data.session?.access_token;
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
