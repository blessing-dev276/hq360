import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, ChevronDown, LogOut, Menu, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ABOUT_MENU, CAPABILITY_MENU, CTAS, INDUSTRY_MENU, PRIMARY_NAV } from "@/config/brand";
import "./SiteHeader.css";
import { FREE_TOOLS } from "@/data/free-tools";

type MenuKey = "industries" | "capabilities" | "about" | "resources";
type NavItem = { label: string; to: string };

const RESOURCE_LINKS: NavItem[] = [
  { label: "Insights", to: "/insights" },
  { label: "Testimonials & Reviews", to: "/testimonials" },
];

const INDUSTRY_GROUPS = [
  { label: "People & ideas", routes: ["/authors", "/creators", "/coaches"] },
  { label: "Places & spaces", routes: ["/real-estate", "/home-services", "/med-spas"] },
  { label: "Commerce & product", routes: ["/ecommerce"] },
  { label: "Business & expertise", routes: ["/law-firms", "/agencies"] },
].map((group) => ({
  label: group.label,
  items: group.routes.flatMap((route) => INDUSTRY_MENU.filter((item) => item.to === route)),
}));

export function SiteHeader() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isAdmin = pathname === "/admin";
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
  const triggersRef = useRef<Partial<Record<MenuKey, HTMLButtonElement | null>>>({});
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusPanelRef = useRef<"first" | "last" | null>(null);
  const menuId = useId();

  async function signOutAdmin() {
    await fetch("/api/admin/session", { method: "DELETE", credentials: "same-origin" });
    window.location.assign("/admin");
  }

  function clearHoverTimer() {
    if (hoverTimerRef.current !== null) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }

  function closeDesktopMenu(restoreFocus = false) {
    clearHoverTimer();
    if (restoreFocus && openMenu) triggersRef.current[openMenu]?.focus();
    setOpenMenu(null);
  }

  useEffect(() => {
    clearHoverTimer();
    setOpenMenu(null);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    mobileCloseRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  useEffect(() => {
    // Only update React when crossing the threshold; batch scroll work per frame.
    let frame = 0;
    let wasScrolled = window.scrollY > 24;
    setScrolled(wasScrolled);
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const next = window.scrollY > 24;
        if (next !== wasScrolled) {
          wasScrolled = next;
          setScrolled(next);
        }
      });
    };
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onViewportChange = () => {
      clearHoverTimer();
      setMobileOpen(false);
      setOpenMenu(null);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    desktop.addEventListener("change", onViewportChange);
    return () => {
      window.removeEventListener("scroll", onScroll);
      desktop.removeEventListener("change", onViewportChange);
      window.cancelAnimationFrame(frame);
      clearHoverTimer();
    };
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    if (focusPanelRef.current) {
      const links = headerRef.current?.querySelectorAll<HTMLAnchorElement>(
        ".hq-mega-menu a[href], .hq-simple-menu a[href]",
      );
      const index = focusPanelRef.current === "last" ? (links?.length ?? 1) - 1 : 0;
      links?.[index]?.focus();
      focusPanelRef.current = null;
    }
    const onOutsidePress = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) {
        clearHoverTimer();
        setOpenMenu(null);
      }
    };
    document.addEventListener("pointerdown", onOutsidePress);
    return () => document.removeEventListener("pointerdown", onOutsidePress);
  }, [openMenu]);

  return (
    <header
      ref={headerRef}
      className="hq-header"
      data-scrolled={scrolled || undefined}
      data-menu-open={Boolean(openMenu) || undefined}
      onKeyDown={(event) => {
        if (event.key === "Escape" && openMenu) {
          event.preventDefault();
          closeDesktopMenu(true);
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          closeDesktopMenu();
        }
      }}
      onPointerEnter={clearHoverTimer}
      onPointerLeave={(event) => {
        if (event.pointerType !== "mouse") return;
        clearHoverTimer();
        // A menu being read with the keyboard must remain available.
        if (headerRef.current?.querySelector(".hq-mega-menu :focus, .hq-simple-menu :focus"))
          return;
        hoverTimerRef.current = setTimeout(() => setOpenMenu(null), 180);
      }}
    >
      <div className="hq-header-surface" aria-hidden="true" />
      <div className="hq-header-inner">
        <Link to="/" preload="intent" aria-label="HQ360 home" className="hq-header-logo">
          <Logo size={48} />
        </Link>

        <nav aria-label="Primary" className="hq-desktop-nav">
          <ul className="hq-nav-list">
            {PRIMARY_NAV.map((item) => {
              if (!item.menu) {
                return (
                  <li key={item.label}>
                    <Link
                      to={item.to as string}
                      preload="intent"
                      className="hq-nav-link"
                      activeOptions={{ exact: item.to === "/" }}
                      activeProps={{ "aria-current": "page" }}
                      onPointerEnter={() => closeDesktopMenu()}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              }
              const key = item.menu;
              return (
                <li key={key}>
                  <button
                    ref={(element) => {
                      triggersRef.current[key] = element;
                    }}
                    id={`${menuId}-${key}-trigger`}
                    type="button"
                    className="hq-nav-link hq-nav-trigger"
                    aria-expanded={openMenu === key}
                    aria-controls={`${menuId}-${key}`}
                    onPointerEnter={(event) => {
                      clearHoverTimer();
                      if (event.pointerType === "mouse") {
                        hoverTimerRef.current = setTimeout(() => setOpenMenu(key), 110);
                      }
                    }}
                    onClick={() => {
                      clearHoverTimer();
                      setOpenMenu((current) => (current === key ? null : key));
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                      event.preventDefault();
                      if (openMenu === key) {
                        const links = headerRef.current?.querySelectorAll<HTMLAnchorElement>(
                          ".hq-mega-menu a[href], .hq-simple-menu a[href]",
                        );
                        links?.[event.key === "ArrowUp" ? links.length - 1 : 0]?.focus();
                      } else {
                        focusPanelRef.current = event.key === "ArrowUp" ? "last" : "first";
                        setOpenMenu(key);
                      }
                    }}
                  >
                    {item.label}
                    <ChevronDown size={13} aria-hidden="true" />
                  </button>
                  {openMenu === key && key === "about" && (
                    <div
                      id={`${menuId}-${key}`}
                      className="hq-mega-menu hq-about-menu"
                      aria-labelledby={`${menuId}-${key}-trigger`}
                    >
                      <div className="hq-about-layout">
                        <aside className="hq-menu-feature">
                          <span className="hq-nav-eyebrow">Inside HQ360</span>
                          <p>
                            One team.
                            <br />
                            Every angle.
                          </p>
                          <span className="hq-menu-caption">
                            Meet the people and principles behind connected growth.
                          </span>
                        </aside>
                        <ul className="hq-about-links">
                          {ABOUT_MENU.map((link, index) => (
                            <li key={link.to}>
                              <Link to={link.to} className="hq-menu-card">
                                <span className="hq-menu-card-number">
                                  {String(index + 1).padStart(2, "0")}
                                </span>
                                <span>
                                  <strong>{link.label}</strong>
                                  <small>{link.blurb}</small>
                                </span>
                                <ArrowUpRight size={16} aria-hidden="true" />
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  {openMenu === key && key === "resources" && (
                    <div
                      id={`${menuId}-${key}`}
                      className="hq-mega-menu hq-resources-menu"
                      aria-labelledby={`${menuId}-${key}-trigger`}
                    >
                      <div className="hq-resources-layout">
                        <aside className="hq-resources-intro">
                          <span className="hq-nav-eyebrow">Ideas into action</span>
                          <p>
                            Find your
                            <br />
                            next move.
                          </p>
                          <span className="hq-resources-caption">
                            Useful perspectives and practical tools to help you move forward.
                          </span>
                          <ul className="hq-capability-menu-list">
                            {RESOURCE_LINKS.map((link) => (
                              <li key={link.label}>
                                <Link to={link.to} className="hq-capability-menu-link">
                                  {link.label}
                                  <ArrowUpRight size={15} />
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </aside>
                        <div>
                          <div className="hq-resources-heading">
                            <strong>Free Tools</strong>
                            <Link to="/tools">View all →</Link>
                          </div>
                          <ul className="hq-resources-grid">
                            {FREE_TOOLS.map((tool, index) => (
                              <li key={tool.slug}>
                                <Link
                                  to="/tools/$tool"
                                  params={{ tool: tool.slug }}
                                  className="hq-resource-card"
                                >
                                  <span className="hq-resource-number">
                                    {String(index + 1).padStart(2, "0")}
                                  </span>
                                  <span>
                                    <strong>{tool.name}</strong>
                                    <small>{tool.description}</small>
                                  </span>
                                  <ArrowUpRight size={15} aria-hidden="true" />
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                  {openMenu === key && key !== "about" && key !== "resources" && (
                    <div
                      id={`${menuId}-${key}`}
                      className="hq-mega-menu"
                      aria-labelledby={`${menuId}-${key}-trigger`}
                      onPointerEnter={clearHoverTimer}
                    >
                      <div className={`hq-mega-inner hq-${key}-layout`}>
                        <aside className="hq-menu-feature">
                          <span className="hq-nav-eyebrow">
                            {key === "industries" ? "Who we help" : "What we do"}
                          </span>
                          <p>
                            {key === "industries"
                              ? "Your world.\nOur perspective."
                              : "A sharper brand.\nA stronger business."}
                          </p>
                          <span className="hq-menu-caption">
                            {key === "industries"
                              ? "Specialist thinking shaped around the way your market actually works."
                              : "Strategy, creative and technology working as one connected system."}
                          </span>
                          <Link
                            to={key === "industries" ? "/industries" : "/services"}
                            preload="intent"
                            className="hq-nav-text-link"
                          >
                            {key === "industries" ? "View all industries" : "Explore services"}
                            <ArrowRight size={16} aria-hidden="true" />
                          </Link>
                        </aside>
                        {key === "industries" ? (
                          <div className="hq-industry-menu-groups">
                            {INDUSTRY_GROUPS.map((group) => (
                              <div key={group.label}>
                                <p className="hq-nav-eyebrow">{group.label}</p>
                                <ul>
                                  {group.items.map((link) => (
                                    <li key={link.to}>
                                      <Link
                                        to={link.to}
                                        preload="intent"
                                        className="hq-industry-link"
                                      >
                                        <span>{link.label}</span>
                                        <ArrowUpRight size={14} aria-hidden="true" />
                                      </Link>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <ul className="hq-services-grid">
                            {CAPABILITY_MENU.map((link, index) => (
                              <li key={link.to}>
                                <Link to={link.to} preload="intent" className="hq-menu-card">
                                  <span className="hq-menu-card-number" aria-hidden="true">
                                    {String(index + 1).padStart(2, "0")}
                                  </span>
                                  <span>
                                    <strong>{link.label}</strong>
                                    <small>{link.blurb}</small>
                                  </span>
                                  <ArrowUpRight size={15} aria-hidden="true" />
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {isAdmin ? (
          <button type="button" className="hq-header-cta" onClick={signOutAdmin}>
            Sign out
            <LogOut size={16} aria-hidden="true" />
          </button>
        ) : (
          <Link to={CTAS.primary.to} preload="intent" className="hq-header-cta">
            {CTAS.primary.label}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        )}
        <button
          type="button"
          onClick={() => {
            closeDesktopMenu();
            setMobileOpen(true);
          }}
          aria-expanded={mobileOpen}
          aria-controls={`${menuId}-mobile`}
          aria-label="Open menu"
          className="hq-mobile-toggle"
        >
          <span>Menu</span>
          <Menu size={19} aria-hidden="true" />
        </button>
      </div>

      <dialog
        ref={dialogRef}
        id={`${menuId}-mobile`}
        aria-label="Site navigation"
        className="hq-mobile-dialog"
        onCancel={() => setMobileOpen(false)}
        onClose={() => setMobileOpen(false)}
      >
        <div className="hq-mobile-top">
          <Link
            to="/"
            preload="intent"
            aria-label="HQ360 home"
            className="hq-header-logo"
            onClick={() => setMobileOpen(false)}
          >
            <Logo size={48} />
          </Link>
          <button
            ref={mobileCloseRef}
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="hq-mobile-toggle"
          >
            <span>Close</span>
            <X size={19} aria-hidden="true" />
          </button>
        </div>
        <nav
          aria-label="Mobile navigation"
          className="hq-mobile-content"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a[href]")) setMobileOpen(false);
          }}
        >
          <span className="hq-nav-eyebrow">Find your next move</span>
          <MobileGroup
            title="Industries"
            extra={{ label: "View all industries", to: "/industries" }}
          >
            {INDUSTRY_GROUPS.map((group) => (
              <div key={group.label} className="hq-mobile-industry-group">
                <p className="hq-nav-eyebrow">{group.label}</p>
                <MobileLinks items={group.items} />
              </div>
            ))}
          </MobileGroup>
          <MobileGroup title="Services" extra={{ label: "Explore services", to: "/services" }}>
            <MobileLinks items={CAPABILITY_MENU} />
          </MobileGroup>
          <MobileGroup title="About">
            <MobileLinks items={ABOUT_MENU} />
          </MobileGroup>
          <MobileGroup title="Resources">
            <ul className="hq-mobile-submenu-links">
              <li>
                <Link to="/insights" preload="intent">
                  Insights
                  <ArrowUpRight size={14} aria-hidden="true" />
                </Link>
              </li>
              <li>
                <Link to="/testimonials" preload="intent">
                  Testimonials &amp; Reviews
                  <ArrowUpRight size={14} aria-hidden="true" />
                </Link>
              </li>
              <li className="hq-mobile-resource-heading">Free Tools</li>
              {FREE_TOOLS.map((tool) => (
                <li key={tool.slug}>
                  <Link to="/tools/$tool" params={{ tool: tool.slug }}>
                    {tool.name}
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/tools">
                  All free tools
                  <ArrowRight size={14} />
                </Link>
              </li>
            </ul>
          </MobileGroup>
          <ul className="hq-mobile-primary-links">
            {PRIMARY_NAV.filter((item) => item.to).map((item) => (
              <li key={item.label}>
                <Link to={item.to as string} preload="intent">
                  {item.label}
                  <ArrowUpRight size={21} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          {isAdmin ? (
            <button type="button" className="hq-mobile-project-link" onClick={signOutAdmin}>
              Sign out
              <LogOut size={20} aria-hidden="true" />
            </button>
          ) : (
            <Link to={CTAS.primary.to} preload="intent" className="hq-mobile-project-link">
              {CTAS.primary.label}
              <ArrowUpRight size={20} aria-hidden="true" />
            </Link>
          )}
          <p className="hq-mobile-signoff">Strategy. Creative. Technology. Growth.</p>
        </nav>
      </dialog>
    </header>
  );
}

function MobileLinks({ items }: { items: NavItem[] }) {
  return (
    <ul className="hq-mobile-submenu-links">
      {items.map((item) => (
        <li key={item.to}>
          <Link to={item.to} preload="intent">
            {item.label}
            <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function MobileGroup({
  title,
  extra,
  children,
}: {
  title: string;
  extra?: NavItem;
  children: React.ReactNode;
}) {
  return (
    <details className="hq-mobile-group">
      <summary>
        {title}
        <ChevronDown size={22} aria-hidden="true" />
      </summary>
      <div className="hq-mobile-group-content">
        {children}
        {extra ? (
          <Link to={extra.to} preload="intent" className="hq-nav-text-link">
            {extra.label}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </details>
  );
}
