import type { ReactNode } from "react";
import { ArrowUpRight, LockKeyhole } from "lucide-react";
import { Logo } from "@/components/Logo";
import "./auth-shell.css";

export function AuthShell({
  audience,
  description,
  children,
}: {
  audience: "admin" | "experts";
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="hq-auth" aria-label={`HQ360 ${audience} sign-in`}>
      <header className="hq-auth-header">
        <a href="/" aria-label="HQ360 home">
          <Logo size={44} variant="mono" />
        </a>
        <a className="hq-auth-back" href="/">
          Back to website <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </header>
      <div className="hq-auth-layout">
        <div className="hq-auth-intro">
          <p className="hq-auth-eyebrow">
            HQ360 / {audience === "admin" ? "Team workspace" : "Expert workspace"}
          </p>
          <h2>
            Good work.
            <br />
            <span>Starts here.</span>
          </h2>
          <p>
            {audience === "admin"
              ? "Your workspace for leads, projects and the work ahead."
              : "Your workspace for author research, reports and collaboration."}
          </p>
          <div className="hq-auth-signature">
            Ideas. Systems. Stories.<span>HQ360 SPACE</span>
          </div>
        </div>
        <div className="hq-auth-card">
          <span className="hq-auth-lock">
            <LockKeyhole size={20} aria-hidden="true" />
          </span>
          <p className="hq-auth-eyebrow">HQ360 {audience}</p>
          <h1>Sign in to continue</h1>
          <p className="hq-auth-description">{description}</p>
          {children}
        </div>
      </div>
      <footer className="hq-auth-footer">
        A private workspace for the people behind the work.
      </footer>
    </section>
  );
}
