import '../styles/phase6.css';
import { parseRoute, routeTitle } from "./router";
import { useEffect, useState, lazy, Suspense } from "react";
const MediaStudio=lazy(()=>import('../features/multimodal/MediaStudio').then(m=>({default:m.MediaStudio})));
const CustomStudio=lazy(()=>import('../features/custom/CustomStudio').then(m=>({default:m.CustomStudio})));
const PeerShareDialog=lazy(()=>import('../features/sharing/PeerShareDialog').then(m=>({default:m.PeerShareDialog})));
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
import "../styles/tabular.css";
const TabularProjectsPage = lazy(() =>
  import("../pages/TabularProjectsPage").then((m) => ({
    default: m.TabularProjectsPage,
  })),
);
const TabularDatasetPage = lazy(() =>
  import("../pages/TabularDatasetPage").then((m) => ({
    default: m.TabularDatasetPage,
  })),
);
const TabularTrainingPage = lazy(() =>
  import("../pages/TabularTrainingPage").then((m) => ({
    default: m.TabularTrainingPage,
  })),
);
const TabularPredictPage = lazy(() =>
  import("../pages/TabularPredictPage").then((m) => ({
    default: m.TabularPredictPage,
  })),
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
  const parsed = parseRoute(route);
  useEffect(() => {
    document.title = routeTitle(parsed) + " · NEURON";
  }, [route]);
  let page;
  switch (parsed.kind) {
    case "media":page=<MediaStudio/>;break;
    case "custom":page=<CustomStudio/>;break;
    case "peer":page=<PeerShareDialog/>;break;
    case "home":
      page = <HomePage />;
      break;
    case "projects":
      page = <ProjectsPage />;
      break;
    case "settings":
      page = <SettingsPage />;
      break;
    case "shares":
      page = <SharesPage />;
      break;
    case "receive":
      page = (
        <ReceivePage key={parsed.id} id={parsed.id} secret={parsed.secret} />
      );
      break;
    case "tabular-home":
      page = <TabularProjectsPage />;
      break;
    case "tabular":
      page =
        parsed.step === "train" ? (
          <TabularTrainingPage key={route} id={parsed.id} />
        ) : parsed.step === "predict" ? (
          <TabularPredictPage key={route} id={parsed.id} />
        ) : (
          <TabularDatasetPage key={route} id={parsed.id} />
        );
      break;
    case "image":
      page =
        parsed.step === "train" ? (
          <TrainingPage key={route} id={parsed.id} />
        ) : parsed.step === "predict" ? (
          <PredictPage key={route} id={parsed.id} />
        ) : parsed.step === "evolve" ? (
          <EvolutionPage key={route} id={parsed.id} />
        ) : (
          <ProjectPage key={route} id={parsed.id} />
        );
      break;
    default:
      page = <NotFoundPage />;
  }
  return (
    <AppShell route={route}>
      <Suspense fallback={<p role="status">Loading workspace…</p>}>
        {page}
      </Suspense>
    </AppShell>
  );
}
