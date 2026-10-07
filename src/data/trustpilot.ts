/**
 * HQ360's real Trustpilot profile.
 *
 * The site embeds Trustpilot's own official TrustBox widget (see
 * TrustpilotWidget.tsx), which pulls live data straight from Trustpilot's
 * servers — the score, review count and reviews update there automatically,
 * with no action needed here.
 *
 * TRUSTPILOT / TRUSTPILOT_REVIEWS below are the offline fallback shown only
 * if that widget script fails to load (blocked script, ad blocker, no JS).
 * They were read by hand from the public profile page and should be nudged
 * up to date occasionally — never fabricate or round up.
 *
 * Source: https://www.trustpilot.com/review/hq360.space
 * Last checked: 12 September 2026.
 */

export const TRUSTPILOT_PROFILE_URL = "https://www.trustpilot.com/review/hq360.space";

/** Trustpilot's business unit ID for hq360.space — needed to embed their official live TrustBox widget. */
export const TRUSTPILOT_BUSINESS_UNIT_ID = "6aa155fa16deb8cadeef0d15";

export const TRUSTPILOT = {
  trustScore: 3.8,
  reviewCount: 2,
};

export type TrustpilotReview = {
  author: string;
  rating: 1 | 2 | 3 | 4 | 5;
  date: string;
  title: string;
  body: string;
  verified: boolean;
};

// Newest first, matching the order shown on the profile page.
export const TRUSTPILOT_REVIEWS: TrustpilotReview[] = [
  {
    author: "Jessica Haertel",
    rating: 5,
    date: "September 3, 2026",
    title: "I worked with HQ360 on improving my business setup",
    body: "I worked with HQ360 on improving my business setup and the whole process was smooth from start to finish. They were easy to communicate with, understood what I was trying to achieve, and gave practical suggestions instead of overcomplicating things. What I liked most was that they looked at the bigger picture and not just one small part of the business. The final result felt professional, well thought out and actually useful.",
    verified: false,
  },
  {
    author: "Diksha Kumari",
    rating: 5,
    date: "August 10, 2026",
    title: "Great Experience and Quality Service",
    body: "I had a really good experience working with HQ360. What stood out to me was how they took the time to understand what I actually needed instead of just trying to sell me something. Communication was clear, the process was straightforward, and I was impressed with the quality of the final result. Definitely a team I'd be comfortable working with again.",
    verified: true,
  },
];
