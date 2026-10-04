import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import {
  ArrowUpRightIcon,
  EnvelopeSimpleIcon,
  MapPinIcon,
  PhoneIcon,
  WhatsappLogoIcon
} from "@phosphor-icons/react/dist/ssr";
import { Tide } from "@/components/ui/Tide";
import { CONTACT } from "@/lib/config/contact";
import { SECTION_IDS } from "@/lib/config/sections";
import { WaterLight } from "./WaterLight";

interface Method {
  key: string;
  label: string;
  Icon: PhosphorIcon;
  href: string;
  /** Leaves the site (a new tab): says so to a screen reader. */
  external?: boolean;
  lines: readonly string[];
}

/** The ways to reach the brand that have been filled in (lib/config/contact.ts), in the order they are shown. */
function methods(): Method[] {
  const list: Method[] = [];
  if (CONTACT.email) {
    list.push({ key: "email", label: "Email", Icon: EnvelopeSimpleIcon, href: `mailto:${CONTACT.email}`, lines: [CONTACT.email] });
  }
  if (CONTACT.phone) {
    list.push({ key: "phone", label: "Phone", Icon: PhoneIcon, href: `tel:${CONTACT.phone.tel}`, lines: [CONTACT.phone.display] });
  }
  if (CONTACT.whatsapp) {
    list.push({
      key: "whatsapp",
      label: "WhatsApp",
      Icon: WhatsappLogoIcon,
      href: `https://wa.me/${CONTACT.whatsapp.number}`,
      external: true,
      lines: [CONTACT.whatsapp.display],
    });
  }
  if (CONTACT.address) {
    list.push({ key: "address", label: "Visit", Icon: MapPinIcon, href: CONTACT.address.map, external: true, lines: CONTACT.address.lines });
  }
  return list;
}

/** Running text: capped at 65 characters a line. */
const body = "max-w-prose text-lg leading-relaxed text-pretty text-ink-soft";

/**
 * The last section before the footer: how to reach the brand. A heading, one line, then the ways to reach
 * it as large links in a grid (one column on a phone, two from sm, four from xl). Each is a whole-tile link
 * wearing the cast plate on hover like every button (src/styles/contact.css). Only the details that are
 * filled in are shown (lib/config/contact.ts). No eyebrow: the heading is the label.
 */
export function ContactSection() {
  const list = methods();
  return (
    <section
      id={SECTION_IDS.contact}
      className="relative isolate overflow-hidden bg-page-alt py-24 md:py-36"
    >
      <WaterLight variant="soft" />
      <div className="page-container">
        <Tide
          as="h2"
          className="display-type max-w-4xl text-4xl md:text-6xl"
          text="Get in [touch]."
          drop
        />
        <p className={`mt-6 ${body}`}>
          Ask about the range, an order or a partnership. Write, call or message us and the Mechaavo team will reply.
        </p>

        {list.length > 0 && (
          <ul className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 md:mt-16">
            {list.map(({ key, label, Icon, href, external, lines }) => (
              <li key={key} className="min-w-0">
                <a
                  href={href}
                  className="contact-link tide-btn"
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  <span className="contact-link__top">
                    <Icon size={28} weight="regular" aria-hidden="true" />
                    <ArrowUpRightIcon size={20} weight="bold" aria-hidden="true" className="contact-link__arrow" />
                  </span>
                  <span className="contact-link__text">
                    <span className="contact-link__label">{label}</span>
                    {lines.map((line) => (
                      <span key={line} className="contact-link__value">
                        {line}
                      </span>
                    ))}
                    {external && <span className="sr-only"> (opens in a new tab)</span>}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
