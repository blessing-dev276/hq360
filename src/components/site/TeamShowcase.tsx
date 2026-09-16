import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Sparkles } from "lucide-react";
import { TEAM } from "@/data/team";
import { PHOTOS as TEAM_PHOTOS } from "@/components/site/TeamAvatar";
import { fetchPublicContent } from "@/lib/public-content";
import "./team-showcase.css";

type Person = {
  key: string;
  name: string;
  role: string;
  blurb: string;
  photo?: string | undefined;
  imageUrl?: string | undefined;
};

const FALLBACK: Person[] = TEAM.map((m) => ({
  key: m.name,
  name: m.name,
  role: m.role,
  blurb: m.blurb,
  photo: m.photo,
}));

function initialsFor(name: string) {
  return name.slice(0, 1).toUpperCase();
}

/**
 * The team showcase — a grid of portrait cards. Tap/click a photo to reveal
 * what that person owns in a panel below it (no rotation — a plain
 * expand/collapse, since the 3D flip was disorienting on some devices).
 * Shared by the homepage (a `limit` + "view all" link to /team) and the
 * Team page (the full roster, no limit). One card design, one interaction,
 * everywhere the team appears.
 *
 * Pulls the admin-managed roster (image + blurb, both editable from
 * /admin > Team) and falls back to the bundled roster if that fails.
 */
export function TeamShowcase({
  eyebrow = "The people behind it",
  title,
  limit,
  viewAll,
}: {
  eyebrow?: string;
  title: ReactNode;
  /** Show only the first N members (used on the homepage). */
  limit?: number;
  /** Optional "see everyone" link shown under a limited grid. */
  viewAll?: { label: string; to: string };
}) {
  const query = useQuery({
    queryKey: ["public", "team"],
    queryFn: ({ signal }) =>
      fetchPublicContent<{
        members: {
          id: string;
          name: string;
          title: string;
          image_url: string | null;
          blurb: string | null;
        }[];
      }>("/api/public/team", signal),
  });

  const all: Person[] = query.data?.members.length
    ? query.data.members.map((m) => {
        const key = m.name.trim().toLowerCase().split(/\s+/)[0] ?? m.id;
        return {
          key: m.id,
          name: m.name,
          role: m.title,
          blurb: m.blurb || TEAM.find((t) => t.photo === key)?.blurb || "",
          photo: key,
          imageUrl: m.image_url ?? undefined,
        };
      })
    : FALLBACK;
  const people = limit ? all.slice(0, limit) : all;

  return (
    <div className="ts-wrap">
      <div className="ts-head">
        <p className="ts-eyebrow">
          <span /> {eyebrow}
        </p>
        <h2>{title}</h2>
      </div>
      <ul className="ts-grid">
        {people.map((person) => (
          <li key={person.key}>
            <TeamCard person={person} />
          </li>
        ))}
      </ul>
      {viewAll ? (
        <Link to={viewAll.to} className="ts-view-all">
          {viewAll.label} <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

function TeamCard({ person }: { person: Person }) {
  const [open, setOpen] = useState(false);
  const src = person.imageUrl || (person.photo ? TEAM_PHOTOS[person.photo] : undefined);
  const firstName = person.name.split(" ")[0];

  return (
    <div className="ts-card">
      <button
        type="button"
        className="ts-photo-btn"
        aria-expanded={open}
        aria-label={open ? `Hide what ${firstName} owns` : `Show what ${firstName} owns`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="ts-photo">
          {src ? (
            <img
              src={src}
              alt={`${person.name}, ${person.role} at HQ360`}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className="ts-fallback">{initialsFor(person.name)}</span>
          )}
          <span className="ts-spark">
            <Sparkles aria-hidden="true" />
          </span>
        </span>
      </button>
      <span className="ts-caption">
        <strong>{person.name}</strong>
        <span>{person.role}</span>
      </span>
      {person.blurb ? (
        <div className="ts-detail" data-open={open || undefined}>
          <div className="ts-detail-inner">
            <p>{person.blurb}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
