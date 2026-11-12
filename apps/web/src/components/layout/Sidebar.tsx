import { safeLocalRoute } from "../../lib/url-safety";
import {
  Table2,
  BrainCircuit,
  LayoutDashboard,
  FolderOpen,
  Settings,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";
export function Sidebar({ route }: { route: string }) {
  return (
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
            href: "#/tabular",
            name: "CSV studio",
            icon: Table2,
            active: route.startsWith("/tabular"),
          },
          {href:'#/media',name:'Text / audio / video',icon:BrainCircuit,active:route==='/media'},
          {href:'#/custom',name:'Custom models',icon:Table2,active:route==='/custom'},
          {href:'#/peer',name:'Peer transfer',icon:ArrowUpRight,active:route==='/peer'},
          {
            href: "#/settings",
            name: "Settings & storage",
            icon: Settings,
            active: route === "/settings",
          },
        ].map((item) => (
          <a
            key={item.href}
            href={safeLocalRoute(item.href.slice(1))}
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
          <p>Your datasets stay on your device. No account needed.</p>
        </div>
        <a className="small-link" href="#/settings">
          Manage local storage <ArrowUpRight size={14} />
        </a>
        <a className="small-link" href="#/shares">
          Encrypted share links →
        </a>
        <div className="build-label">NEURON / PHASE 06</div>
      </div>
    </aside>
  );
}
