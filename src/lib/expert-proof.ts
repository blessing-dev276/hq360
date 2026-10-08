import { useQuery } from "@tanstack/react-query";
import { fetchPublicContent } from "@/lib/public-content";
import type { ExpertWork } from "@/lib/agency-work";

type Credit = { name: string; slug: string | null; photo: string | null };
export type ExpertVideo = {
  id: string;
  client: string;
  role: string | null;
  quote: string | null;
  video: string;
  services: string[];
  audiences: string[];
  expert: Credit;
};
export type ExpertReview = {
  id: string;
  client: string;
  platform: string;
  rating: number | null;
  text: string;
  date: string | null;
  screenshot: string;
  services: string[];
  audiences: string[];
  expert: Credit;
};
export type ExpertProof = {
  portfolio: ExpertWork[];
  videos: ExpertVideo[];
  reviews: ExpertReview[];
};

/** Approved work, client videos and reviews from public HQ360 experts. */
export function useExpertProof() {
  return useQuery({
    queryKey: ["public", "expert-proof"],
    queryFn: ({ signal }) => fetchPublicContent<ExpertProof>("/api/public/expert-proof", signal),
    staleTime: 60_000,
  });
}

/** Matches a service and/or audience; no filter matches everything. */
export const matchesTags = (
  item: { services: string[]; audiences: string[] },
  service = "",
  audience = "",
) =>
  (!service || item.services.includes(service)) && (!audience || item.audiences.includes(audience));
