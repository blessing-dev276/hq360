/** Operator confirmed permission to automate Reedsy discovery on 2026-09-21.
 * This does not override robots exclusions or technical access restrictions. */
export const reedsyPolicy = {
 slug:'reedsy_discovery', accessStatus:'allowed', homepage:'https://reedsy.com/discovery',
 robots:'https://reedsy.com/robots.txt', terms:'https://reedsy.com/about/tou', checkedAt:'2026-09-21',
 reason:'Public-page collection authorized by the operator’s confirmed Reedsy permission.',
} as const;
/** Names observed in the public homepage's :genres navigation on 2026-09-21.
 * Discovery rechecks current genre groups instead of inventing category URLs. */
export const REEDSY_GENRES=['Fantasy','Mystery & Crime','Non-Fiction','Romance','Science Fiction','Thriller & Suspense','Young Adult'] as const;
