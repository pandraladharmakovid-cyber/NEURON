import { useEffect, useState, lazy, Suspense } from "react";
import { AppShell } from "../components/layout/AppShell";
import { HomePage } from "../pages/HomePage";
import { ProjectsPage } from "../pages/ProjectsPage";
import { ProjectPage } from "../pages/ProjectPage";
const TrainingPage = lazy(() =>
  import("../pages/TrainingPage").then((m) => ({ default: m.TrainingPage })),
);
const PredictPage = lazy(() =>
  import("../pages/PredictPage").then((m) => ({ default: m.PredictPage })),
);
import { SettingsPage } from "../pages/SettingsPage";
import { NotFoundPage } from "../pages/NotFoundPage";
const EvolutionPage = lazy(() =>
  import("../pages/EvolutionPage").then((m) => ({ default: m.EvolutionPage })),
);
import "../styles/phase3.css";
const ReceivePage = lazy(() =>
  import("../pages/ReceivePage").then((m) => ({ default: m.ReceivePage })),
);
const SharesPage = lazy(() =>
  import("../pages/SharesPage").then((m) => ({ default: m.SharesPage })),
);
function currentRoute() {
  return location.hash.slice(1) || "/";
}
export function App() {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const update = () => {
      setRoute(currentRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  const match = route.match(
    /^\/projects\/([^/]+)(?:\/(train|predict|evolve))?$/,
  );
  const received = route.match(
    /^\/receive\/([A-Za-z0-9_-]{32})(?:\/([A-Za-z0-9_-]{43}))?$/,
  );
  let page;
  if (route === "/") page = <HomePage />;
  else if (route === "/projects") page = <ProjectsPage />;
  else if (route === "/shares") page = <SharesPage />;
  else if (received)
    page = (
      <ReceivePage
        key={received[1]}
        id={received[1]}
        secret={received[2] ?? ""}
      />
    );
  else if (route === "/settings") page = <SettingsPage />;
  else if (match) {
    const id = match[1];
    page =
      match[2] === "evolve" ? (
        <EvolutionPage key={route} id={id} />
      ) : match[2] === "train" ? (
        <TrainingPage key={route} id={id} />
      ) : match[2] === "predict" ? (
        <PredictPage key={route} id={id} />
      ) : (
        <ProjectPage key={route} id={id} />
      );
  } else page = <NotFoundPage />;
  return (
    <AppShell route={route}>
      <Suspense fallback={<p role="status">Loading image studio…</p>}>
        {page}
      </Suspense>
    </AppShell>
  );
}