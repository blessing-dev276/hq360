import { useQuery } from "@tanstack/react-query";
import { Reveal } from "@/components/site/Reveal";
import { TeamAvatar } from "@/components/site/TeamAvatar";
import { TEAM } from "@/data/team";
import { fetchPublicContent } from "@/lib/public-content";

type Person = {
  key: string;
  name: string;
  title: string;
  /** bundled fallback photo key */
  photo?: string | undefined;
  /** admin-managed portrait URL */
  imageUrl?: string | undefined;
};

function initialsFor(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?"
  );
}

/** The static roster, used for SSR and as a fallback when the API is empty. */
const FALLBACK: Person[] = TEAM.map((m) => ({
  key: m.name,
  name: m.name,
  title: m.role,
  photo: m.photo,
}));

export function TeamGrid() {
  const query = useQuery({
    queryKey: ["public", "team"],
    queryFn: ({ signal }) =>
      fetchPublicContent<{
        members: { id: string; name: string; title: string; image_url: string | null }[];
      }>("/api/public/team", signal),
  });
  // The actual static roster renders during SSR/loading and stays available if
  // the managed roster cannot load. Static TS content needs no synthetic fetch.
  const people: Person[] = query.data?.members.length
    ? query.data.members.map((m) => ({
        key: m.id,
        name: m.name,
        title: m.title,
        imageUrl: m.image_url ?? undefined,
        photo: m.name.trim().toLowerCase().split(/\s+/)[0],
      }))
    : FALLBACK;

  return (
    <>
      {query.isError && (
        <p className="mt-8 text-sm text-muted-foreground">
          Showing our team roster.{" "}
          <button
            type="button"
            className="underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
            onClick={() => void query.refetch()}
          >
            Retry live updates
          </button>
        </p>
      )}
      <ul className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {people.map((m, i) => (
          <li key={m.key}>
            <Reveal delay={i * 30}>
              <div className="rounded-2xl border border-border bg-card p-6 text-center">
                <TeamAvatar
                  name={m.name}
                  initials={initialsFor(m.name)}
                  photo={m.photo}
                  imageUrl={m.imageUrl}
                />
                <h3 className="mt-5 font-display text-lg">{m.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{m.title}</p>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </>
  );
}
