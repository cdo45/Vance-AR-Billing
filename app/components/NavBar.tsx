"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TEAL   = "#1F6B6B";
const ORANGE = "#C8102E";

const LINKS = [
  { href: "/",          label: "ENTRY FORM"  },
  { href: "/customers", label: "CUSTOMERS"   },
  { href: "/jobs",      label: "JOBS"        },
  { href: "/invoices",  label: "INVOICES"    },
  { href: "/reports",   label: "REPORTS"     },
];

export default function NavBar() {
  const pathname = usePathname();
  return (
    <nav className="w-full shadow-sm" style={{ background: TEAL }}>
      <div className="max-w-7xl mx-auto px-4 flex items-center">
        {LINKS.map(link => {
          const active = pathname === link.href;
          return (
            <Link key={link.href} href={link.href}
              className="px-6 py-3 text-sm font-bold uppercase tracking-widest text-white transition-colors"
              style={{
                background: active ? ORANGE : "transparent",
                borderBottom: active ? `3px solid ${ORANGE}` : "3px solid transparent",
              }}>
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
