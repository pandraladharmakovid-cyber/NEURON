import { type ReactNode } from "react";
import { OfflineBanner } from "./OfflineBanner";
import {
  BrainCircuit,
  LayoutDashboard,
  FolderOpen,
  Settings,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";
export function AppShell({
  children,
  route,
}: {
  children: ReactNode;
  route: string;
}) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#/">
          <BrainCircuit size={37} />
          <span>
            NEURON<small>YOUR AI. YOUR DEVICE.</small>
          </span>
        </a>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {[
            {
              href: "#/",
              name: "Overview",
              icon: LayoutDashboard,
              active: route === "/",
            },
            {
              href: "#/projects",
              name: "My projects",
              icon: FolderOpen,
              active: route.startsWith("/project"),
            },
            {
              href: "#/settings",
              name: "Settings & storage",
              icon: Settings,
              active: route === "/settings",
            },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={item.active ? "active" : ""}
            >
              <item.icon size={19} />
              {item.name}
              {item.active && <span className="nav-dot" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-note">
            <ShieldCheck size={22} />
            <strong>Private by design</strong>
            <p>Your images stay on your device. No account needed.</p>
          </div>
          <a className="small-link" href="#/settings">
            Manage local storage <ArrowUpRight size={14} />
          </a>
          <a className="small-link" href="#/shares">
            Encrypted share links →
          </a>
          <div className="build-label">NEURON / PHASE 03</div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            Workspace <span className="muted">/</span>{" "}
            <strong>
              {route === "/"
                ? "Overview"
                : route === "/projects"
                  ? "Projects"
                  : route === "/settings"
                    ? "Settings"
                    : "Image studio"}
            </strong>
          </span>
          <span className="local-badge">
            <span className="status-dot" /> Local-first workspace
          </span>
        </header>
        <OfflineBanner />
        <main className="main-content">{children}</main>
        <footer className="footer">
          <span>Built on your ideas. Powered by your device.</span>
          <span>BUILD · TRAIN · EVOLVE</span>
        </footer>
      </div>
    </div>
  );
}