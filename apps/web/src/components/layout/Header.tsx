import { parseRoute, routeTitle } from "../../app/router";
export function Header({ route }: { route: string }) {
  return (
    <header className="topbar">
      <span>
        Workspace <span className="muted">/</span>{" "}
        <strong>{routeTitle(parseRoute(route))}</strong>
      </span>
      <span className="local-badge">
        <span className="status-dot" /> Local-first workspace
      </span>
    </header>
  );
}
