import {
  ArrowRight,
  Image,
  Type,
  AudioLines,
  Film,
  Table2,
  Shapes,
  Database,
  Layers,
  ShieldCheck,
  BrainCircuit,
  Sparkles,
  ChevronRight,
} from "lucide-react";
export function HomePage() {
  return (
    <>
      <section className="tabular-promo"><div><div className="eyebrow">PHASE 06 / COMPLETE LOCAL STUDIOS</div><h2>Text, audio, video. Custom models. Real P2P.</h2><p>Bounded real classifiers and explicit direct transfer, alongside image and CSV workflows.</p></div><a className="btn btn-primary" href="#/media">Open media studio →</a></section>
      <div className="eyebrow">
        <span className="status-dot" /> YOUR IDEAS. NO LIMITS.
      </div>
      <section className="hero">
        <div className="hero-copy">
          <div className="pill">
            <Sparkles size={13} /> PERSONAL AI, WITHOUT THE COMPLEXITY
          </div>
          <h1>
            Create your own
            <br />
            <span className="gradient-text">AI model.</span>
            <br />
            Keep it yours.
          </h1>
          <p>
            Turn your images into an intelligent model.
            <br />
            Train right in your browser, on your own device.
            <br />
            No coding. No accounts. No cloud training.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#/projects">
              Start building <ArrowRight size={17} />
            </a>
            <a className="text-link" href="#/settings">
              How your data stays private <ChevronRight size={15} />
            </a>
          </div>
          <div className="hero-trust">
            <ShieldCheck size={15} />
            <span>Your images never leave your browser</span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orb orb-one" />
          <div className="orb orb-two" />
          <div className="floating-chip chip-image">
            <Image size={25} />
          </div>
          <div className="floating-chip chip-brain">
            <BrainCircuit size={25} />
          </div>
          <div className="studio-preview">
            <div className="window-bar">
              <i />
              <i />
              <i />
              <span>NEURON STUDIO</span>
              <span className="preview-local">● LOCAL</span>
            </div>
            <div className="preview-body">
              <div className="preview-side">
                <BrainCircuit size={24} />
                <span className="on">
                  01 <b>Choose data</b>
                </span>
                <span>
                  02 <b>Train model</b>
                </span>
                <span>
                  03 <b>Make it yours</b>
                </span>
                <div className="preview-lock">
                  <ShieldCheck size={16} />
                  On your device
                </div>
              </div>
              <div className="preview-main">
                <small>LET’S BUILD SOMETHING</small>
                <h3>What will your model learn?</h3>
                <p>Every great model starts with your data.</p>
                <div className="preview-tiles">
                  {[
                    { icon: Image, name: "Images" },
                    { icon: Type, name: "Text" },
                    { icon: AudioLines, name: "Audio" },
                    { icon: Film, name: "Video" },
                    { icon: Table2, name: "Tabular" },
                    { icon: Shapes, name: "Custom" },
                  ].map((item, i) => (
                    <div className={i === 0 ? "selected" : ""} key={item.name}>
                      <item.icon size={21} />
                      <span>{item.name}</span>
                      <em>Available</em>
                    </div>
                  ))}
                </div>
                <div className="preview-button">
                  Continue with images <ArrowRight size={13} />
                </div>
              </div>
            </div>
          </div>
          <span className="handwritten">
            Your next idea,
            <br />
            made intelligent.
          </span>
        </div>
      </section>
      <section className="tabular-promo">
        <div>
          <span className="eyebrow">NEW / YOUR TABLES CAN LEARN TOO</span>
          <h2>From CSV to predictions.</h2>
          <p>
            Classify categories or predict numeric values, with local worker
            training and held-out evaluation.
          </p>
        </div>
        <a className="btn btn-secondary" href="#/tabular">
          Open CSV studio →
        </a>
      </section>
      <section className="principles">
        {[
          {
            icon: Database,
            title: "Bring your data",
            text: "Organize images into the classes you want your model to recognize.",
          },
          {
            icon: Layers,
            title: "Train on your device",
            text: "Real transfer learning. Your hardware does the work, not a cloud server.",
          },
          {
            icon: BrainCircuit,
            title: "Make it useful",
            text: "Test predictions, compare versions, and export your trained model.",
          },
          {
            icon: ShieldCheck,
            title: "Stay in control",
            text: "No logins. No image uploads. Your browser is your workspace.",
          },
        ].map((item) => (
          <article key={item.title}>
            <div className="feature-icon">
              <item.icon size={21} />
            </div>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </article>
        ))}
      </section>
      <section className="start-banner">
        <div className="banner-icon">
          <Sparkles size={24} />
        </div>
        <div>
          <span className="eyebrow">A SIMPLE PLACE TO START</span>
          <h2>
            Image classification.{" "}
            <span className="muted">Real possibilities.</span>
          </h2>
          <p>
            Teach a model to tell your categories apart. Build something
            uniquely yours.
          </p>
        </div>
        <a className="btn btn-secondary" href="#/projects">
          Create a project <ArrowRight size={16} />
        </a>
      </section>
      <p className="phase-note">
        Phase 06 · Real local image/CSV/text/audio/video classifiers, custom numeric
        models, private backups, encrypted image links and direct WebRTC model transfer.
        These are bounded feature pipelines—not arbitrary AI architectures or universal accuracy.

      </p>
    </>
  );
}
