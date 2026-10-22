// The tracker screens are shared by the Expert workspace and the admin panel.
// In the admin panel they send x-hq360-actor: admin, which the server honours
// only with a valid admin session. The two panels are separate pages, so a
// module flag set by the rendering screen is enough.
let adminMode = false;

export function setTrackerAdminMode(value: boolean) {
  adminMode = value;
}

export function actorHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return adminMode ? { ...extra, "x-hq360-actor": "admin" } : extra;
}
