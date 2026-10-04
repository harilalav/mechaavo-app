import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import {
  FacebookLogoIcon,
  InstagramLogoIcon,
  LinkedinLogoIcon,
  XLogoIcon,
  YoutubeLogoIcon
} from "@phosphor-icons/react/dist/ssr";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { WaterLight } from "@/components/showcase/WaterLight";
import { CONTACT } from "@/lib/config/contact";

const SOCIAL: readonly { key: keyof typeof CONTACT.social; label: string; Icon: PhosphorIcon }[] = [
  { key: "instagram", label: "Instagram", Icon: InstagramLogoIcon },
  { key: "facebook", label: "Facebook", Icon: FacebookLogoIcon },
  { key: "youtube", label: "YouTube", Icon: YoutubeLogoIcon },
  { key: "linkedin", label: "LinkedIn", Icon: LinkedinLogoIcon },
  { key: "x", label: "X", Icon: XLogoIcon },
];

/**
 * The foot of the page: the logo and one line about the brand, the social profiles that have been filled in
 * (lib/config/contact.ts), and the copyright. The page ends in the water it began in (the `bottom` water
 * light, which used to be at the foot of #commitment). It does not repeat the section links: the bar that
 * carries them is on screen from #story on, and two links to one place would be the same intent twice.
 */
export function SiteFooter() {
  const profiles = SOCIAL.map((s) => ({ ...s, href: CONTACT.social[s.key] })).filter(
    (s): s is typeof s & { href: string } => s.href !== null,
  );
  return (
    <footer className="relative isolate overflow-hidden bg-page pt-20 pb-10 md:pt-28">
      <WaterLight variant="bottom" />
      <div className="page-container">
        <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
          <div>
            <BrandLogo variant="lockup" className="w-32 md:w-40" sizes="160px" />
            <p className="mt-5 max-w-sm text-base leading-relaxed text-ink-soft">
              Premium fishing tackle, engineered with precision and made to be trusted.
            </p>
          </div>

          {profiles.length > 0 && (
            <nav aria-label="Social media">
              <ul className="flex flex-wrap gap-2">
                {profiles.map(({ key, label, Icon, href }) => (
                  <li key={key}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="footer-social tide-btn"
                      aria-label={`${label} (opens in a new tab)`}
                    >
                      <Icon size={22} weight="regular" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>

        <p className="mt-14 border-t border-line pt-6 text-sm text-ink-muted">
          &copy; {new Date().getFullYear()} Mechaavo Tackles. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
