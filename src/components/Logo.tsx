import { cn } from "@/lib/utils";

type LogoProps = {
  /** "gradient" for light surfaces and hero, "mono" for footer and dark sections */
  variant?: "gradient" | "mono";
  /** render only the abstract HQ mark, without the full wordmark lockup */
  markOnly?: boolean;
  className?: string;
  /** height of the logo in pixels */
  size?: number;
};

const MARK_SRC = "/logo-abstract.webp";
const TEXT_SRC = "/logo-text.webp";

/**
 * HQ360 logo. Uses the supplied brand artwork:
 * - markOnly: the abstract HQ mark (logo-abstract.png)
 * - default: the full HQ360 wordmark lockup (logo-text.png)
 * On dark surfaces pass variant="mono" to render the artwork in white.
 */
export function Logo({ variant = "gradient", markOnly = false, className, size = 36 }: LogoProps) {
  const src = markOnly ? MARK_SRC : TEXT_SRC;
  const mono = variant === "mono";

  return (
    <span className={cn("inline-flex items-center", className)}>
      <img
        src={src}
        alt="HQ360"
        width={markOnly ? 192 : 384}
        height={192}
        style={{ height: size, width: "auto" }}
        className={cn("block w-auto object-contain", mono && "brightness-0 invert")}
        loading="eager"
        decoding="async"
      />
    </span>
  );
}

export default Logo;
