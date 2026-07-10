"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  FileText,
  FolderKanban,
  Landmark,
  Settings,
  Sun,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Today", icon: Sun },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/money", label: "Money", icon: Landmark },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/**
 * App chrome: a hairline sidebar on desktop, a bottom tab bar on phones —
 * the phone is a first-class capture device here, not an afterthought.
 */
export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-[100svh]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-[100svh] w-56 shrink-0 flex-col border-r border-line md:flex">
        <Link href="/" className="group flex items-baseline gap-2 px-6 pt-7">
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full bg-fg transition-transform duration-500 group-hover:scale-150"
          />
          <span className="font-display italic tracking-tightest text-[1.25rem] leading-none">
            Studio
          </span>
        </Link>

        <nav aria-label="Primary" className="mt-10 flex flex-1 flex-col px-3">
          <ul className="space-y-0.5">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors duration-200",
                      active
                        ? "bg-fg text-bg"
                        : "text-fg/60 hover:bg-fg/5 hover:text-fg"
                    )}
                  >
                    <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.5} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-auto px-3 pb-6 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
            Greyform · private
          </p>
        </nav>
      </aside>

      {/* Content */}
      <div className="min-w-0 flex-1 pb-20 md:pb-0">{children}</div>

      {/* Mobile bottom bar */}
      <nav
        aria-label="Primary"
        className="safe-b fixed inset-x-0 bottom-0 z-50 border-t border-line bg-bg/90 backdrop-blur-md md:hidden"
      >
        <ul className="flex items-stretch justify-around">
          {NAV.slice(0, 5).map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 transition-colors duration-200",
                    active ? "text-fg" : "text-fg/45"
                  )}
                >
                  <Icon aria-hidden className="h-5 w-5" strokeWidth={active ? 1.8 : 1.4} />
                  <span className="font-mono text-[9px] uppercase tracking-[0.18em]">
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
