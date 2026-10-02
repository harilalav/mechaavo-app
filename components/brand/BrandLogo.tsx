import Image from "next/image";
import Link from "next/link";

interface BrandLogoProps {
  /** `mark` = the two waves only. `lockup` = the waves with the MECHAAVO wordmark under them (nav and story). */
  variant?: "mark" | "lockup";
  /** Render as a link to the homepage. */
  href?: string;
  className?: string;
  /** The width the logo is shown at, as an `<img sizes>` value; defaults to the variant's usual placement. */
  sizes?: string;
  /** Above the fold: load at once instead of lazily. */
  priority?: boolean;
}

/** The supplied artwork on a transparent ground (docs/make-logo-assets.mjs), with the size it is shown at. */
const ART = {
  mark: { src: "/images/mechaavo-logo-mark.png", width: 910, height: 314, sizes: "120px" },
  lockup: { src: "/images/mechaavo-logo-lockup.png", width: 910, height: 467, sizes: "(min-width: 1024px) 384px, 80vw" },
} as const;

/**
 * The Mechaavo logo, exactly as supplied: its own blue and the red E, not
 * recolored to the page palette (see docs/make-logo-assets.mjs). As a link it is
 * named for where it goes ("Mechaavo home"), so the image itself has no text
 * alternative to repeat.
 */
export function BrandLogo({ variant = "mark", href, className = "", sizes, priority = false }: BrandLogoProps) {
  const art = ART[variant];
  const logo = (
    <Image
      src={art.src}
      width={art.width}
      height={art.height}
      sizes={sizes ?? art.sizes}
      alt={href ? "" : "Mechaavo"}
      priority={priority}
      className="brand-logo"
    />
  );

  if (!href) return <span className={`block ${className}`}>{logo}</span>;

  return (
    <Link
      href={href}
      prefetch={false}
      className={`brand-link block ${className}`}
      aria-label="Mechaavo home"
    >
      {logo}
    </Link>
  );
}
