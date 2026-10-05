import blessingPhoto from "@/assets/team-blessing.webp";
import zainab from "@/assets/team-zainab.webp";
import emmanuel from "@/assets/team-emmanuel.webp";
import richard from "@/assets/team-richard.webp";
import ebenezer from "@/assets/team-ebenezer.webp";
import racheal from "@/assets/team-racheal.webp";

/** Bundled fallback portraits, keyed by first name lowercased. Exported so
 * other team layouts (e.g. the homepage showcase) can render the image
 * directly without TeamAvatar's own fixed sizing. */
export const PHOTOS: Record<string, string> = {
  blessing: blessingPhoto,
  zainab,
  emmanuel,
  richard,
  ebenezer,
  racheal,
};

export function TeamAvatar({
  name,
  initials,
  photo,
  imageUrl,
}: {
  name: string;
  initials: string;
  /** key into the bundled PHOTOS map (fallback roster) */
  photo?: string | undefined;
  /** explicit portrait URL (admin-managed members); wins over `photo` */
  imageUrl?: string | undefined;
}) {
  const src = imageUrl || (photo ? PHOTOS[photo] : undefined);

  if (!src) {
    return (
      <span
        aria-hidden="true"
        className="mx-auto flex aspect-square w-full max-w-[12rem] items-center justify-center rounded-2xl bg-charcoal font-display text-4xl font-semibold text-[oklch(0.97_0.006_90)]"
      >
        {initials}
      </span>
    );
  }

  return (
    <span className="mx-auto block aspect-square w-full max-w-[12rem] overflow-hidden rounded-2xl border border-border">
      <img
        src={src}
        alt={`Portrait of ${name}`}
        width={1200}
        height={1200}
        loading="lazy"
        className="size-full object-cover object-center"
      />
    </span>
  );
}
