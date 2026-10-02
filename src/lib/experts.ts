import { useQuery } from "@tanstack/react-query";
import { TEAM } from "@/data/team";
import { PHOTOS as TEAM_PHOTOS } from "@/components/site/TeamAvatar";
import { fetchPublicContent } from "@/lib/public-content";

export type PublicExpert = {
  slug: string;
  name: string;
  headline: string;
  summary: string;
  bio: string;
  photo: string | null;
  specialties: string[];
  location: string | null;
  website: string | null;
  linkedin: string | null;
  kind: "team" | "expert";
};

/** Row shape served by /api/public/experts (never includes email or status). */
export type ExpertRow = {
  slug: string;
  full_name: string | null;
  headline: string | null;
  summary?: string | null;
  bio: string | null;
  photo_url: string | null;
  specialties: string[] | null;
  location: string | null;
  website_url: string | null;
  linkedin_url: string | null;
};

type TeamRow = {
  id: string;
  name: string;
  title: string;
  image_url: string | null;
  blurb: string | null;
};

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const ACRONYMS = new Set([
  "CEO",
  "COO",
  "CTO",
  "CRM",
  "UGC",
  "SEO",
  "AI",
  "UI",
  "UX",
  "HQ360",
  "PR",
]);

/** Admin-managed titles are sometimes stored in capitals; show them in title case. */
export function displayTitle(value: string) {
  if (value !== value.toUpperCase()) return value;
  return value
    .toLowerCase()
    .split(/(\s+)/)
    .map((word) =>
      ACRONYMS.has(word.toUpperCase())
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join("");
}

function bundledPhoto(name: string) {
  return TEAM_PHOTOS[name.split(/\s+/)[0]?.toLowerCase() ?? ""] ?? null;
}

function fromTeam(member: { name: string; role: string; blurb: string; photo: string | null }) {
  return {
    slug: slugify(member.name),
    name: member.name,
    headline: displayTitle(member.role),
    summary: "",
    bio: member.blurb,
    photo: member.photo,
    specialties: [],
    location: null,
    website: null,
    linkedin: null,
    kind: "team",
  } satisfies PublicExpert;
}

export const FALLBACK_TEAM: PublicExpert[] = TEAM.map((m) =>
  fromTeam({ name: m.name, role: m.role, blurb: m.blurb, photo: TEAM_PHOTOS[m.photo] ?? null }),
);

export function fromExpertRow(row: ExpertRow): PublicExpert {
  return {
    slug: row.slug,
    name: row.full_name?.trim() || "HQ360 Expert",
    headline: row.headline?.trim() || "HQ360 Expert",
    summary: row.summary?.trim() || "",
    bio: row.bio?.trim() || "",
    photo: row.photo_url,
    specialties: row.specialties ?? [],
    location: row.location,
    website: row.website_url,
    linkedin: row.linkedin_url,
    kind: "expert",
  };
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]!.toUpperCase())
      .join("") || "HQ"
  );
}

/** HQ360's core team (admin-managed, with the bundled roster as fallback)
 *  followed by approved experts who chose to publish a profile. */
export function useExpertDirectory() {
  const team = useQuery({
    queryKey: ["public", "team"],
    queryFn: ({ signal }) => fetchPublicContent<{ members: TeamRow[] }>("/api/public/team", signal),
  });
  const experts = useQuery({
    queryKey: ["public", "experts"],
    queryFn: ({ signal }) =>
      fetchPublicContent<{ experts: ExpertRow[] }>("/api/public/experts", signal),
  });
  const teamPeople = team.data?.members.length
    ? team.data.members.map((m) =>
        fromTeam({
          name: m.name,
          role: m.title,
          blurb: m.blurb || "",
          photo: m.image_url || bundledPhoto(m.name),
        }),
      )
    : FALLBACK_TEAM;
  const independent = (experts.data?.experts ?? []).map(fromExpertRow);
  return {
    team: teamPeople,
    experts: independent,
    all: [...teamPeople, ...independent],
    loading: team.isPending || experts.isPending,
  };
}
