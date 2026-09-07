import { useState, type MouseEvent } from "react";
import {
  House,
  Plane,
  Map,
  FolderOpen,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import Brand from "./Brand";
import { type Page, pageNames } from "../navigation";
import { useModal } from "../useModal";

const items = [
  { page: "home", icon: House },
  { page: "board", icon: Map },
  { page: "flight", icon: Plane },
] satisfies { page: Page; icon: typeof House }[];

function NavLinks({
  page,
  onNavigate,
  onPlans,
}: {
  page: Page;
  onNavigate: (page: Page) => void;
  onPlans: () => void;
}) {
  function visit(event: MouseEvent<HTMLAnchorElement>, next: Page) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    onNavigate(next);
    if (event.detail > 0) event.currentTarget.blur();
  }
  return (
    <>
      <a
        className="nav-brand"
        href="#/home"
        aria-label="WARBOARD home"
        onClick={(event) => visit(event, "home")}
      >
        <Brand />
      </a>
      <nav aria-label="Main navigation">
        {items.map(({ page: next, icon: Icon }) => (
          // The local rule only recognizes literal labels; this exhaustive page-name map supplies the visible and accessible name.
          // eslint-disable-next-line de-slop-ui/accessibility-icon-button-label
          <a
            key={next}
            href={`#/${next}`}
            aria-label={pageNames[next]}
            aria-current={
              (["guide", "fire"].includes(page) ? "board" : page) === next
                ? "page"
                : undefined
            }
            onClick={(event) => visit(event, next)}
          >
            <Icon size={20} />
            <span className="nav-label">{pageNames[next]}</span>
          </a>
        ))}
      </nav>
      <div className="nav-library">
        <div className="nav-divider" />
        <button type="button" aria-haspopup="dialog" onClick={onPlans}>
          <FolderOpen size={20} />
          <span>Saved plans</span>
        </button>
      </div>
      <div className="nav-bottom">
        <p>
          Independent companion
          <br />
          Built for WARDOGS
        </p>
      </div>
    </>
  );
}

function MobileNavigation({
  page,
  onNavigate,
  onPlans,
  onClose,
}: {
  page: Page;
  onNavigate: (page: Page) => void;
  onPlans: () => void;
  onClose: () => void;
}) {
  const modal = useModal();
  return (
    <dialog
      className="mobile-navigation"
      ref={modal}
      aria-label="WARBOARD navigation"
      onCancel={onClose}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="mobile-navigation-inner">
        <button
          className="close-navigation"
          type="button"
          aria-label="Close navigation"
          data-autofocus
          onClick={onClose}
        >
          <X size={22} />
        </button>
        <NavLinks
          page={page}
          onNavigate={(next) => {
            onClose();
            onNavigate(next);
          }}
          onPlans={() => {
            onClose();
            onPlans();
          }}
        />
      </div>
    </dialog>
  );
}

export default function AppNavigation({
  page,
  onNavigate,
  onPlans,
}: {
  page: Page;
  onNavigate: (page: Page) => void;
  onPlans: () => void;
}) {
  const [pinned, setPinned] = useState(false);
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className={`navigation-rail${pinned ? " navigation-pinned" : ""}`}>
        <NavLinks page={page} onNavigate={onNavigate} onPlans={onPlans} />
        <button
          className="pin-navigation"
          type="button"
          aria-label={pinned ? "Unpin navigation" : "Pin navigation open"}
          aria-pressed={pinned}
          onClick={() => setPinned(!pinned)}
        >
          {pinned ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
          <span>{pinned ? "Unpin navigation" : "Pin navigation"}</span>
        </button>
      </div>
      <button
        className="mobile-menu-toggle"
        type="button"
        aria-label="Open navigation"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu size={22} />
      </button>
      {open && (
        <MobileNavigation
          page={page}
          onNavigate={onNavigate}
          onPlans={onPlans}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
