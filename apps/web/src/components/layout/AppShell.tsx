import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { OfflineBanner } from "./OfflineBanner";
export function AppShell({
  children,
  route,
}: {
  children: ReactNode;
  route: string;
}) {
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to workspace
      </a>
      <Sidebar route={route} />
      <div className="workspace">
        <Header route={route} />
        <OfflineBanner tabular={route.startsWith('/tabular')||['/media','/custom','/peer'].includes(route)} />
        <main id="main-content" tabIndex={-1} className="main-content">
          {children}
        </main>
        <footer className="footer">
          <span>Built on your ideas. Powered by your device.</span>
          <span>BUILD · TRAIN · EVOLVE</span>
        </footer>
      </div>
    </div>
  );
}
