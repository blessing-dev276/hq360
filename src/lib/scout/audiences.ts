export const SCOUT_AUDIENCES = [
  { id: "authors", label: "Authors & Publishers", query: "authors publishers", source: "web" },
  { id: "ugc-creators", label: "UGC Creators", query: "UGC creator", source: "web" },
  { id: "creators", label: "Content Creators", query: "content creator", source: "web" },
  { id: "coaches", label: "Coaches & Consultants", query: "coach consultant", source: "web" },
  { id: "agencies", label: "Agencies", query: "agency", source: "web" },
  { id: "ecommerce", label: "E-commerce & DTC", query: "online store brand", source: "web" },
  {
    id: "cleaning-businesses",
    label: "Cleaning Businesses",
    query: "cleaning services",
    source: "maps",
  },
  {
    id: "appointment-based-businesses",
    label: "Appointment-Based Businesses",
    query: "appointment services",
    source: "maps",
  },
  { id: "local-businesses", label: "Local Businesses", query: "local businesses", source: "maps" },
  { id: "home-services", label: "Home Services", query: "home services", source: "maps" },
  { id: "plumbers", label: "Plumbers", query: "plumber", source: "maps" },
  { id: "roofers", label: "Roofers", query: "roofing contractor", source: "maps" },
  { id: "hvac", label: "HVAC", query: "HVAC contractor", source: "maps" },
  { id: "med-spas", label: "Med Spas & Beauty", query: "med spa beauty salon", source: "maps" },
  { id: "real-estate", label: "Real Estate", query: "real estate agency", source: "maps" },
  {
    id: "professional-services",
    label: "Law & Professional Services",
    query: "professional services",
    source: "maps",
  },
] as const;
export type ScoutAudience = (typeof SCOUT_AUDIENCES)[number];
export type AudienceSource = "maps" | "web";
export type AudienceLead = {
  id: string;
  name: string;
  source: AudienceSource;
  source_key: string;
  source_url: string;
  website_url: string | null;
  description: string | null;
  category: string | null;
  address: string | null;
  phone: string | null;
  rating: number | null;
  review_count: number | null;
  contact_email: string | null;
  contact_source_url: string | null;
  contact_status: "unverified" | "verified";
  shortlisted: boolean;
};
export type AudienceBatch = {
  id: string;
  audience: string;
  source: AudienceSource;
  label: string;
  query: string;
  location: string;
  page: number;
  created_at: string;
  item_count: number;
};
