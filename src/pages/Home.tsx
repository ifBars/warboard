import { assetUrl } from "../assetUrl";
import {
  ArrowUpRight,
  ArrowRight,
  Crosshair,
  Map,
  Plane,
  Backpack,
  Warehouse,
  FolderOpen,
} from "lucide-react";
import Brand from "../components/Brand";
import type { Plan } from "../model";
import type { Page } from "../navigation";

export default function Home({
  plan,
  onNavigate,
  onPlans,
}: {
  plan: Plan;
  onNavigate: (page: Page) => void;
  onPlans: () => void;
}) {
  return (
    <div className="home-page">
      <header className="home-header">
        <a href="#/home" aria-label="WARBOARD home">
          <Brand />
        </a>
        <span>Planning tools for WARDOGS</span>
        <a
          className="home-header-action"
          href="#/board"
          onClick={(event) => {
            event.preventDefault();
            onNavigate("board");
          }}
        >
          Open board <ArrowUpRight size={17} />
        </a>
      </header>
      <main id="home-content">
        <section className="home-hero" aria-labelledby="home-title">
          <img
            className="hero-terrain"
            src={assetUrl("/maps/bakurani.webp")}
            alt=""
            width="4096"
            height="4096"
          />
          <div className="hero-copy">
            <p className="hero-intro">A clearer plan. A ready squad.</p>
            <h1 id="home-title">
              Go in with
              <br />a plan<span>.</span>
            </h1>
            <p className="hero-description">
              Mark routes, prepare fire support, and bring your squad onto the
              same page.
            </p>
            <div className="hero-actions">
              <button
                className="home-primary"
                type="button"
                onClick={() => onNavigate("board")}
              >
                Open your board <ArrowUpRight size={21} />
              </button>
              <button
                className="home-secondary"
                type="button"
                onClick={onPlans}
              >
                <FolderOpen size={17} /> Saved plans
              </button>
            </div>
            <p className="hero-proof">
              On your device. Ready to export. No account needed.
            </p>
          </div>
          <div className="hero-caption">
            <span>BAKURANI</span>
            <span>
              Terrain imagery ·{" "}
              <a
                href="https://github.com/apollyon-sys/wardogs-calculator"
                target="_blank"
                rel="noreferrer"
              >
                Apollyon
              </a>
            </span>
          </div>
        </section>
        <section className="resume-plan" aria-labelledby="resume-title">
          <div className="resume-symbol">
            <Map size={25} />
          </div>
          <div>
            <p id="resume-title">Your working board</p>
            <h2>{plan.name || "Untitled plan"}</h2>
            <span>
              {plan.map.name} · {plan.marks.length}{" "}
              {plan.marks.length === 1 ? "annotation" : "annotations"}
            </span>
          </div>
          <button type="button" onClick={() => onNavigate("board")}>
            Continue planning <ArrowRight size={20} />
          </button>
        </section>
        <section className="home-tools" aria-labelledby="tools-title">
          <div className="home-section-heading">
            <h2 id="tools-title">Every move starts here.</h2>
            <p>Bring the route, the support and the briefing together.</p>
          </div>
          <div className="tool-directory">
            <button type="button" onClick={() => onNavigate("flight")}>
              <Plane size={26} />
              <span>
                <strong>Flight planner</strong>
                <span>
                  Explore terrain in 3D, plan altitudes and find flatter ground.
                </span>
              </span>
              <ArrowUpRight size={22} />
            </button>
            <button type="button" onClick={() => onNavigate("board")}>
              <Map size={26} />
              <span>
                <strong>The board</strong>
                <span>
                  Draw routes, mark landing zones and save your next approach.
                </span>
              </span>
              <ArrowUpRight size={22} />
            </button>
            <button type="button" onClick={() => onNavigate("fire")}>
              <Crosshair size={26} />
              <span>
                <strong>Fire support</strong>
                <span>
                  Prepare gun positions, firing estimates and named targets.
                </span>
              </span>
              <ArrowUpRight size={22} />
            </button>
            <button type="button" onClick={() => onNavigate("base")}>
              <Warehouse size={26} />
              <span>
                <strong>Base builder</strong>
                <span>
                  Arrange buildables, estimate supplies and bring your layout
                  onto the Board.
                </span>
              </span>
              <ArrowUpRight size={22} />
            </button>
          </div>
        </section>
        <section className="home-future" aria-labelledby="future-title">
          <div>
            <h2 id="future-title">More ways to prepare.</h2>
            <p>The next chapter of WARBOARD.</p>
          </div>
          <div className="future-tools">
            <div>
              <Backpack size={22} />
              <span>Loadout builder</span>
              <small>Planned</small>
            </div>
          </div>
        </section>
      </main>
      <footer className="home-footer">
        <Brand compact />
        <p>
          Independent WARDOGS companion. Not affiliated with or endorsed by the
          game’s developers.
        </p>
        <a
          href="#/guide"
          onClick={(event) => {
            event.preventDefault();
            onNavigate("guide");
          }}
        >
          Field guide <ArrowUpRight size={15} />
        </a>
      </footer>
    </div>
  );
}
