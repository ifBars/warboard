import { mapImage } from "../mapImagery";
import TerrainColorChoice from "../components/TerrainColorChoice";
import TerrainLoading from "../components/TerrainLoading";
import ForestDetection from "../components/ForestDetection";
import BoardTrees from "../components/BoardTrees";
import { emptyFlight } from "../flight";
import HelpDialog from "../components/HelpDialog";
import AppNavigation from "../components/AppNavigation";
import Home from "./Home";
import {
  usePage,
  navigate,
  pageNames,
  type Page,
  type ToolPage,
} from "../navigation";
import Shape from "../components/AnnotationShape";
import FireSupportPanel, {
  type Placement,
} from "../components/FireSupportPanel";
import TacticalOverlay from "../components/TacticalOverlay";
import FieldGuide from "../components/FieldGuide";
import PlanLibrary from "../components/PlanLibrary";
import ReferenceLayer, {
  type LayerSettings,
  type Landmark,
} from "../components/ReferenceLayer";
import MapLayers from "../components/MapLayers";
import MapLayersDropdown from "../components/MapLayersDropdown";
import OperationsPanel from "../components/OperationsPanel";
import DetailTiles from "../components/DetailTiles";
import { exportImage } from "../exportImage";
import OfflineStatus from "../components/OfflineStatus";
import CoordinateReadout from "../components/CoordinateReadout";
import { createCursorStore } from "../cursor";
import { planBriefing } from "../briefing";
import { readView, saveView, type ViewPreferences } from "../preferences";
import { listPlans, type SavedPlan } from "../library";
import { emptyMission, coordinateText, type Mission } from "../ballistics";
import { mapData, toGame, toPixel } from "../cartography";
import { visibleMap, type Camera } from "../viewport";
import {
  useCallback,
  lazy,
  Suspense,
  useRef,
  useState,
  type PointerEvent,
  type KeyboardEvent,
} from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Eraser,
  FolderOpen,
  Hand,
  ImagePlus,
  Minus,
  MousePointer2,
  Pencil,
  Plus,
  Redo2,
  Scan,
  StickyNote,
  Trash2,
  Undo2,
  X,
  HelpCircle,
  Maximize,
  PanelRightClose,
  PanelRightOpen,
  Eye,
  EyeOff,
  Ruler,
  Circle,
  Grid2X2,
  Crosshair,
  SlidersHorizontal,
} from "lucide-react";
import {
  colors,
  moveMark,
  validatePlan,
  type Mark,
  type Plan,
  type Point,
  type Tool,
} from "../model";
import { download, flushSaves, loadImage, savePlan } from "../storage";
import { builtIns, openMap } from "../maps";

const tools = [
  { id: "select", label: "Select", key: "V", icon: MousePointer2 },
  { id: "pan", label: "Pan", key: "H", icon: Hand },
  { id: "pen", label: "Draw", key: "P", icon: Pencil },
  { id: "line", label: "Line", key: "L", icon: Minus },
  { id: "arrow", label: "Arrow", key: "A", icon: ArrowUpRight },
  { id: "note", label: "Note", key: "N", icon: StickyNote },
  { id: "ruler", label: "Measure", key: "R", icon: Ruler },
  { id: "circle", label: "Area", key: "C", icon: Circle },
  { id: "erase", label: "Erase", key: "E", icon: Eraser },
] as const;
const hints: Record<Tool, string> = {
  select: "Select or drag drawings, gun and target markers. Right-drag to pan.",
  pan: "Drag to move around the map.",
  pen: "Drag to draw a route.",
  line: "Drag from start to end.",
  arrow: "Drag in the direction of travel.",
  note: "Click the map to place a note.",
  erase: "Click an annotation to erase it.",
  ruler: "Drag to measure distance and bearing. Imported maps use pixels.",
  circle: "Drag from the center to mark an area.",
};
type Gesture =
  | { kind: "draw"; mark: Mark }
  | { kind: "move"; mark: Mark; start: Point }
  | {
      kind: "mission";
      field: "gun" | "target";
      mission: Mission;
      start: Point;
      origin: Point;
    }
  | {
      kind: "tap";
      action: "note" | "gun" | "target" | "erase";
      point: Point;
      mark?: Mark;
      id?: string;
      start: Point;
      camera: Camera;
    }
  | {
      kind: "pinch";
      distance: number;
      camera: Camera;
      anchor: Point;
      midpoint: Point;
      scale: number;
    }
  | { kind: "pan"; start: Point; camera: Camera };

const BoardTerrain = lazy(() => import("../components/BoardTerrain"));
const FlightPlanner = lazy(() => import("./FlightPlanner"));
export default function App({
  initial,
  warning,
}: {
  initial: Plan;
  warning: string;
}) {
  const [plan, setPlan] = useState(initial),
    [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState(colors[0]),
    [width, setWidth] = useState(5),
    [selected, setSelected] = useState<string | null>(null);
  const [camera, setCamera] = useState<Camera>({
    x: 0,
    y: 0,
    w: initial.map.width,
    h: initial.map.height,
  });
  const [draft, setDraft] = useState<Mark | null>(null),
    [status, setStatus] = useState("Ready · saves as you draw");
  const [view, setView] = useState(readView);
  const {
    brightness,
    layers,
    grid,
    rings,
    terrainColor,
    terrainLighting,
    treeOutlines,
  } = view;
  const [landmark, setLandmark] = useState<Landmark | null>(null);
  const [terrainView, setTerrainView] = useState(false);
  const [mapOptions, setMapOptions] = useState(false);
  const page = usePage();
  const [fireOpen, setFireOpen] = useState(false);
  const [missionDraft, setMissionDraft] = useState<Mission | null>(null);
  const [selectedMission, setSelectedMission] = useState<Placement>(null);
  const workingPlan = missionDraft ? { ...plan, mission: missionDraft } : plan;
  const showTerrain =
    terrainView && page === "board" && !fireOpen && !!mapData(plan.map);
  const section =
    page === "fire" || (page === "board" && fireOpen)
      ? "fire"
      : page === "home" || page === "flight"
        ? "board"
        : page;
  const [library, setLibrary] = useState<SavedPlan[] | null>(null);
  const [requestedPlacement, setPlacement] = useState<Placement>(null);
  const placement = section === "fire" ? requestedPlacement : null;
  const [cursor] = useState(createCursorStore);
  const setCursor = cursor.set;
  const [viewport, setViewport] = useState({ width: 1200, height: 1200 });
  const observeCanvas = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0)
        setViewport((previous) =>
          previous.width === width && previous.height === height
            ? previous
            : { width, height },
        );
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const [notePreset, setNotePreset] = useState("New note");
  const [panel, setPanel] = useState(true),
    [drawings, setDrawings] = useState(true);
  const [history, setHistory] = useState<Plan[]>([]),
    [future, setFuture] = useState<Plan[]>([]);
  const [error, setError] = useState(warning),
    [busy, setBusy] = useState(false),
    [menu, setMenu] = useState(false),
    [help, setHelp] = useState(false);
  const gesture = useRef<Gesture | null>(null),
    saveRevision = useRef(0);
  const touches = useRef(new globalThis.Map<number, Point>());
  const landmarkClickAfter = useRef(0);
  const svg = useRef<SVGSVGElement>(null),
    imageInput = useRef<HTMLInputElement>(null),
    planInput = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const active = plan.marks.find((m) => m.id === selected);
  const overlayUnit = visibleMap(camera, viewport).unit;
  const shown = draft
    ? [...plan.marks.filter((m) => m.id !== draft.id), draft]
    : plan.marks;
  function visit(next: Page) {
    setPlacement(null);
    setPanel(true);
    setMenu(false);
    setMapOptions(false);
    setFireOpen(next === "fire");
    if (next === "fire") setTerrainView(false);
    navigate(next === "fire" ? "board" : next);
  }
  function setSection(next: ToolPage) {
    visit(next);
  }
  async function showPlans() {
    try {
      const entries = await listPlans();
      visit("board");
      setLibrary(entries);
    } catch (cause) {
      visit("board");
      setError(
        cause instanceof Error ? cause.message : "Could not open saved plans.",
      );
    }
  }
  function updateMission(mission: Mission) {
    commit({ ...plan, mission });
  }
  function updateView(patch: Partial<ViewPreferences>) {
    const next = { ...view, ...patch };
    setView(next);
    saveView(next);
  }
  function setBrightness(value: number) {
    updateView({ brightness: value });
  }
  function setTerrainColor(terrainColor: boolean) {
    updateView({ terrainColor, brightness: terrainColor ? 1 : 1.5 });
  }
  function setLayers(value: LayerSettings) {
    updateView({ layers: value });
  }
  function setGrid(value: boolean) {
    updateView({ grid: value });
  }
  function setRings(value: boolean) {
    updateView({ rings: value });
  }
  function targetCoordinate(point: Point) {
    updateMission({ ...(plan.mission ?? emptyMission()), target: point });
    setSection("fire");
    setPanel(true);
    setLandmark(null);
    setPlacement(plan.mission?.gun ? null : "gun");
  }
  function focusCoordinate(p: Point) {
    const pixel = toPixel(p, plan.map);
    if (!pixel) return;
    const w = Math.min(camera.w, plan.map.width / 3);
    setCamera({ x: pixel.x - w / 2, y: pixel.y - w / 2, w, h: w });
  }
  function frameMission() {
    const mission = plan.mission;
    if (!mission?.gun || !mission.target) return;
    const a = toPixel(mission.gun, plan.map),
      b = toPixel(mission.target, plan.map);
    if (!a || !b) return;
    const w = Math.max(
      plan.map.width / 10,
      Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) * 1.8,
    );
    setCamera({ x: (a.x + b.x - w) / 2, y: (a.y + b.y - w) / 2, w, h: w });
  }

  function persist(next: Plan) {
    const revision = ++saveRevision.current;
    setStatus("Saving…");
    savePlan(next)
      .then(() => {
        if (revision === saveRevision.current)
          setStatus("Saved on this device");
      })
      .catch(() => {
        if (revision === saveRevision.current) {
          setStatus("Not saved");
          setError(
            "Local storage is unavailable or full. Export your plan to keep a copy.",
          );
        }
      });
  }
  function commit(next: Plan) {
    setHistory([...history.slice(-49), plan]);
    setFuture([]);
    setPlan(next);
    persist(next);
  }
  function undo() {
    const previous = history.at(-1);
    if (previous) {
      setHistory(history.slice(0, -1));
      setFuture([...future, plan]);
      setPlan(previous);
      persist(previous);
      if (previous.map !== plan.map) fit(previous.map);
      setLandmark(null);
      setPlacement(null);
      setCursor(null);
      setSelected(null);
      setDraft(null);
      gesture.current = null;
    }
  }
  function redo() {
    const next = future.at(-1);
    if (next) {
      setFuture(future.slice(0, -1));
      setHistory([...history, plan]);
      setPlan(next);
      persist(next);
      if (next.map !== plan.map) fit(next.map);
      setLandmark(null);
      setPlacement(null);
      setCursor(null);
      setDraft(null);
      gesture.current = null;
      setSelected(null);
    }
  }
  function editMark(patch: Partial<Mark>) {
    if (active)
      commit({
        ...plan,
        marks: plan.marks.map((m) =>
          m.id === active.id ? { ...m, ...patch } : m,
        ),
      });
  }
  function remove(id = selected) {
    if (id) {
      commit({ ...plan, marks: plan.marks.filter((m) => m.id !== id) });
      setSelected(null);
    }
  }
  function fit(map = plan.map) {
    setCamera({ x: 0, y: 0, w: map.width, h: map.height });
  }
  function position(clientX: number, clientY: number): Point {
    const m = svg.current!.getScreenCTM()!;
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }
  function zoom(factor: number, anchor?: Point) {
    const w = Math.max(
        plan.map.width / 20,
        Math.min(plan.map.width * 3, camera.w * factor),
      ),
      ratio = w / camera.w;
    const p = anchor ?? {
      x: camera.x + camera.w / 2,
      y: camera.y + camera.h / 2,
    };
    setCamera({
      x: p.x - (p.x - camera.x) * ratio,
      y: p.y - (p.y - camera.y) * ratio,
      w,
      h: camera.h * ratio,
    });
  }
  function down(e: PointerEvent<SVGSVGElement>) {
    if (!drawings && tool !== "pan" && e.button === 0) setDrawings(true);
    if (e.pointerType === "touch" && !busy) {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.current.size === 2) {
        e.preventDefault();
        const [a, b] = [...touches.current.values()];
        const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        gesture.current = {
          kind: "pinch",
          distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
          camera,
          anchor: position(midpoint.x, midpoint.y),
          midpoint,
          scale: svg.current!.getScreenCTM()!.a,
        };
        setDraft(null);
        setMissionDraft(null);
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }
    if (e.button === 0 && (e.target as Element).closest(".landmark")) return;
    if (
      busy ||
      gesture.current ||
      (e.button !== 0 && e.button !== 1 && e.button !== 2)
    )
      return;
    e.preventDefault();
    e.currentTarget.focus();
    const p = position(e.clientX, e.clientY),
      id = (e.target as Element)
        .closest("[data-mark]")
        ?.getAttribute("data-mark");
    if (placement && e.button === 0 && !e.altKey) {
      if (e.pointerType === "touch") {
        gesture.current = {
          kind: "tap",
          action: placement,
          point: p,
          start: { x: e.clientX, y: e.clientY },
          camera,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
      const coordinate = toGame(p, plan.map);
      if (
        coordinate &&
        p.x >= 0 &&
        p.y >= 0 &&
        p.x <= plan.map.width &&
        p.y <= plan.map.height
      ) {
        updateMission({
          ...(plan.mission ?? emptyMission()),
          [placement]: coordinate,
        });
        setPlacement(
          placement === "gun" && !plan.mission?.target ? "target" : null,
        );
      }
      return;
    }
    const missionField = (e.target as Element)
      .closest("[data-mission]")
      ?.getAttribute("data-mission");
    if (
      (missionField === "gun" || missionField === "target") &&
      (tool === "select" || tool === "pan") &&
      e.button === 0 &&
      !e.altKey
    ) {
      const mission = plan.mission;
      const origin = mission?.[missionField];
      if (mission && origin) {
        setSection("fire");
        setSelected(null);
        setSelectedMission(missionField);
        gesture.current = {
          kind: "mission",
          field: missionField,
          mission,
          start: p,
          origin,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      return;
    }
    if (tool === "pan" || e.button === 1 || e.button === 2 || e.altKey) {
      gesture.current = {
        kind: "pan",
        start: { x: e.clientX, y: e.clientY },
        camera,
      };
    } else if (tool === "erase") {
      if (e.pointerType === "touch") {
        gesture.current = {
          kind: "tap",
          action: "erase",
          point: p,
          id: id ?? undefined,
          start: { x: e.clientX, y: e.clientY },
          camera,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
      if (id) remove(id);
      return;
    } else if (tool === "select") {
      setSelected(id ?? null);
      const mark = plan.marks.find((m) => m.id === id);
      if (!mark) return;
      gesture.current = { kind: "move", mark, start: p };
    } else {
      if (p.x < 0 || p.y < 0 || p.x > plan.map.width || p.y > plan.map.height)
        return;
      if (
        plan.marks.length >= 2000 ||
        plan.marks.reduce((n, m) => n + m.points.length, 0) > 180000
      ) {
        setError(
          "This plan has reached its drawing capacity. Export it and start a new plan.",
        );
        return;
      }
      const mark: Mark = {
        id: crypto.randomUUID(),
        type: tool,
        color,
        width,
        points: [p],
        text: "",
      };
      if (tool === "note") {
        mark.text = notePreset;
        if (e.pointerType === "touch") {
          gesture.current = {
            kind: "tap",
            action: "note",
            point: p,
            mark,
            start: { x: e.clientX, y: e.clientY },
            camera,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
          return;
        }
        placeNote(mark);
        return;
      }
      mark.points.push(p);
      gesture.current = { kind: "draw", mark };
      setDraft(mark);
      setSelected(null);
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function placeNote(mark: Mark) {
    setPanel(true);
    setSection("board");
    commit({ ...plan, marks: [...plan.marks, mark] });
    setSelected(mark.id);
    setTool("select");
    requestAnimationFrame(() => {
      noteRef.current?.focus();
      noteRef.current?.select();
    });
  }
  function move(e: PointerEvent<SVGSVGElement>) {
    setCursor(toGame(position(e.clientX, e.clientY), plan.map));
    if (touches.current.has(e.pointerId))
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "mission") {
      const p = position(e.clientX, e.clientY);
      if (
        Math.hypot(p.x - g.start.x, p.y - g.start.y) < overlayUnit * 3 &&
        !missionDraft
      )
        return;
      const origin = toPixel(g.origin, plan.map);
      if (!origin) return;
      const coordinate = toGame(
        {
          x: Math.max(0, Math.min(plan.map.width, origin.x + p.x - g.start.x)),
          y: Math.max(0, Math.min(plan.map.height, origin.y + p.y - g.start.y)),
        },
        plan.map,
      );
      if (coordinate) setMissionDraft({ ...g.mission, [g.field]: coordinate });
      return;
    }
    if (g.kind === "tap") {
      if (Math.hypot(e.clientX - g.start.x, e.clientY - g.start.y) > 8)
        gesture.current = { kind: "pan", start: g.start, camera: g.camera };
      return;
    }
    if (g.kind === "pinch") {
      const [a, b] = [...touches.current.values()];
      if (!a || !b) return;
      const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const w = Math.max(
        plan.map.width / 20,
        Math.min(plan.map.width * 3, (g.camera.w * g.distance) / distance),
      );
      const ratio = w / g.camera.w;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      setCamera({
        x:
          g.anchor.x -
          (g.anchor.x - g.camera.x) * ratio -
          ((mid.x - g.midpoint.x) / g.scale) * ratio,
        y:
          g.anchor.y -
          (g.anchor.y - g.camera.y) * ratio -
          ((mid.y - g.midpoint.y) / g.scale) * ratio,
        w,
        h: g.camera.h * ratio,
      });
      return;
    }
    if (g.kind === "pan") {
      const scale = svg.current!.getScreenCTM()!.a;
      setCamera({
        ...g.camera,
        x: g.camera.x - (e.clientX - g.start.x) / scale,
        y: g.camera.y - (e.clientY - g.start.y) / scale,
      });
      return;
    }
    const p = position(e.clientX, e.clientY);
    if (g.kind === "move")
      setDraft(moveMark(g.mark, { x: p.x - g.start.x, y: p.y - g.start.y }));
    else {
      const points =
        g.mark.type === "pen"
          ? [...g.mark.points, p].slice(-19999)
          : [g.mark.points[0], p];
      g.mark = { ...g.mark, points };
      setDraft(g.mark);
    }
  }
  function up(e: PointerEvent<SVGSVGElement>) {
    touches.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "pinch" || g.kind === "pan")
      landmarkClickAfter.current = performance.now() + 350;
    if (g.kind === "mission") {
      if (missionDraft) updateMission(missionDraft);
      setMissionDraft(null);
    } else if (g.kind === "tap") {
      if (g.action === "note" && g.mark) placeNote(g.mark);
      else if (g.action === "erase" && g.id) remove(g.id);
      else if (g.action === "gun" || g.action === "target") {
        const coordinate = toGame(g.point, plan.map);
        if (
          coordinate &&
          g.point.x >= 0 &&
          g.point.y >= 0 &&
          g.point.x <= plan.map.width &&
          g.point.y <= plan.map.height
        ) {
          updateMission({
            ...(plan.mission ?? emptyMission()),
            [g.action]: coordinate,
          });
          setPlacement(
            g.action === "gun" && !plan.mission?.target ? "target" : null,
          );
        }
      }
    } else if (g.kind === "draw") {
      const p = position(e.clientX, e.clientY);
      const m = {
        ...g.mark,
        points:
          g.mark.type === "pen" ? [...g.mark.points, p] : [g.mark.points[0], p],
      };
      if (
        m.points.some(
          (p) => Math.hypot(p.x - m.points[0].x, p.y - m.points[0].y) > 2,
        )
      ) {
        commit({ ...plan, marks: [...plan.marks, m] });
        setSelected(m.id);
      }
    } else if (g.kind === "move" && draft)
      commit({
        ...plan,
        marks: plan.marks.map((m) => (m.id === draft.id ? draft : m)),
      });
    gesture.current = null;
    setDraft(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  }
  function keys(e: KeyboardEvent) {
    if (help || library) return;
    if ((e.target as HTMLElement).closest("input, textarea, select")) return;
    if (e.key === "Escape") {
      setLandmark(null);
      setPlacement(null);
      gesture.current = null;
      setMissionDraft(null);
      setDraft(null);
      setSelected(null);
      setMenu(false);
      setMapOptions(false);
      setHelp(false);
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
      e.preventDefault();
      redo();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "3") {
      document
        .querySelector<HTMLButtonElement>(
          '.app button[aria-label="Map layers"]',
        )
        ?.click();
      return;
    }
    const sections = ["board", "fire", "board", "flight", "guide"] as const;
    if (/^[1-5]$/.test(e.key)) {
      setSection(sections[Number(e.key) - 1]);
      setPanel(true);
      setPlacement(null);
      return;
    }
    if (["+", "=", "-", "_"].includes(e.key)) {
      e.preventDefault();
      zoom(e.key === "-" || e.key === "_" ? 1.2 : 1 / 1.2);
      return;
    }
    const next = tools.find((t) => t.key.toLowerCase() === e.key.toLowerCase());
    if (next) {
      setTerrainView(false);
      setTool(next.id);
      setPlacement(null);
      if (next.id !== "pan" && next.id !== "select") {
        setSection("board");
        setPanel(true);
      }
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      remove();
    }
    if (e.key === "0") fit();
  }
  async function importMap(file?: File) {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    try {
      const map = await loadImage(file);
      if (
        (plan.marks.length || plan.mission || plan.operations) &&
        !confirm(
          "Replace the map and clear its drawings, fire missions and operations? Save a copy first if needed. You can also undo this change.",
        )
      )
        return;
      commit({
        version: 1,
        name: `${map.name.replace(/\.[^.]+$/, "")} plan`.slice(0, 120),
        map,
        marks: [],
      });
      setSelected(null);
      setPlacement(null);
      setLandmark(null);
      setCursor(null);
      fit(map);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function switchMap(id: string) {
    if (!id || busy) return;
    setBusy(true);
    setError("");
    try {
      await flushSaves();
      const next = await openMap(id);
      commit(next);
      setSelected(null);
      fit(next.map);
      setLandmark(null);
      setPlacement(null);
      setCursor(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function importPlan(file?: File) {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    try {
      if (file.size > 35 * 1024 * 1024)
        throw new Error("Plan files must be under 35 MB.");
      const next = validatePlan(JSON.parse(await file.text()));
      const image = new Image();
      image.src = next.map.image;
      await image.decode();
      if (
        image.naturalWidth !== next.map.width ||
        image.naturalHeight !== next.map.height
      )
        throw new Error("The map dimensions do not match this plan.");
      if (
        (plan.marks.length || plan.mission || plan.operations) &&
        !confirm(
          "Open this plan in place of your current one? You can undo this change.",
        )
      )
        return;
      commit(next);
      setSelected(null);
      setPlacement(null);
      setLandmark(null);
      setCursor(null);
      fit(next.map);
    } catch (e) {
      setError(
        e instanceof SyntaxError
          ? "This file is not valid plan JSON."
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  async function exportPng(currentView = false) {
    setMenu(false);
    setBusy(true);
    try {
      const { blob, detailFallbacks } = await exportImage({
        plan,
        brightness,
        terrainColor,
        layers,
        grid,
        rings,
        view: currentView ? visibleMap(camera, viewport) : undefined,
      });
      download(blob, `${plan.name || "plan"}${currentView ? "-view" : ""}.png`);
      if (detailFallbacks)
        setError(
          "PNG exported with base-map detail in areas that were unavailable offline.",
        );
    } catch {
      setError(
        "Could not export the image. Export an editable plan to keep your work.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="product-shell">
      <AppNavigation
        page={page}
        onNavigate={visit}
        onPlans={() => void showPlans()}
      />
      {page === "home" && (
        <Home plan={plan} onNavigate={visit} onPlans={() => void showPlans()} />
      )}
      {page === "flight" && (
        <Suspense
          fallback={
            <TerrainLoading
              mapName={plan.map.name}
              title="Opening Flight planner"
              backToBoard
            />
          }
        >
          <FlightPlanner
            key={plan.map.name}
            plan={plan}
            status={status}
            terrainColor={terrainColor}
            treeOutlines={treeOutlines}
            onTreeOutlines={(treeOutlines) => updateView({ treeOutlines })}
            terrainLighting={terrainLighting}
            onTerrainColor={setTerrainColor}
            onTerrainLighting={(terrainLighting) =>
              updateView({ terrainLighting })
            }
            onMapChange={(id) => void switchMap(id)}
            mapBusy={busy}
            onChange={(flight) => commit({ ...plan, flight })}
          />
        </Suspense>
      )}
      <div
        hidden={page === "home" || page === "flight"}
        className={`app ${panel ? "" : "panel-hidden"} section-${section}`}
        onKeyDown={keys}
        onPointerDownCapture={(e) => {
          const target = e.target as Element;
          if (!target.closest(".export-wrap")) setMenu(false);
          if (!target.closest(".map-actions")) setMapOptions(false);
          if (!target.closest(".landmark-popover,.landmark")) setLandmark(null);
        }}
      >
        <div className="workspace">
          <div role="toolbar" className="tools" aria-label="Drawing tools">
            {tools
              .filter((t) => t.id !== "pan")
              .map((t) => (
                <button
                  type="button"
                  key={t.id}
                  title={`${t.label} (${t.key})`}
                  aria-label={`${t.label} (${t.key})`}
                  aria-pressed={tool === t.id}
                  className={tool === t.id ? "active" : ""}
                  onClick={() => {
                    setTerrainView(false);
                    setTool(t.id);
                    setPlacement(null);
                    if (t.id !== "select") {
                      setSection("board");
                      setPanel(true);
                    }
                    setMenu(false);
                  }}
                >
                  <t.icon size={20} />
                </button>
              ))}
            <button
              type="button"
              aria-label="Fire support tool"
              title="Fire support tool"
              aria-pressed={section === "fire"}
              onClick={() => {
                setSection(section === "fire" ? "board" : "fire");
                setTool("select");
              }}
            >
              <Crosshair size={20} />
            </button>
            <div className="tool-divider" />
            <button
              type="button"
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
              disabled={!history.length}
              onClick={undo}
            >
              <Undo2 size={20} />
            </button>
            <button
              type="button"
              title="Redo (Ctrl+Shift+Z)"
              aria-label="Redo"
              disabled={!future.length}
              onClick={redo}
            >
              <Redo2 size={20} />
            </button>
            <button
              type="button"
              className="help-button"
              title="Help"
              aria-label="Help"
              onClick={() => setHelp(true)}
            >
              <HelpCircle size={20} />
            </button>
          </div>
          <main>
            <div className="map-bar">
              <div>
                <span className="map-label">MAP</span>
                <select
                  aria-label="Map"
                  disabled={busy}
                  value={
                    builtIns.find((m) => m.name === plan.map.name)?.id ??
                    "custom"
                  }
                  onChange={(e) => void switchMap(e.target.value)}
                >
                  {builtIns.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                  {!builtIns.some((m) => m.name === plan.map.name) && (
                    <option value="custom">{plan.map.name}</option>
                  )}
                </select>
                <span className="terrain-label">Terrain map</span>
              </div>
              <div className="map-actions">
                {page === "board" && mapData(plan.map) && (
                  <div
                    className="board-view-toggle"
                    role="group"
                    aria-label="Board view"
                  >
                    <button
                      type="button"
                      aria-pressed={!showTerrain}
                      onClick={() => setTerrainView(false)}
                    >
                      2D
                    </button>
                    <button
                      type="button"
                      aria-pressed={showTerrain}
                      onClick={() => {
                        setDraft(null);
                        gesture.current = null;
                        setFireOpen(false);
                        setTerrainView(true);
                      }}
                    >
                      3D
                    </button>
                  </div>
                )}
                <MapLayersDropdown>
                  <TerrainColorChoice
                    treeOutlines={treeOutlines}
                    onTreeOutlines={(treeOutlines) =>
                      updateView({ treeOutlines })
                    }
                    enabled={terrainColor}
                    onChange={setTerrainColor}
                    lighting={terrainLighting}
                    onLightingChange={(terrainLighting) =>
                      updateView({ terrainLighting })
                    }
                  />
                  {page === "board" && mapData(plan.map) && (
                    <div className="board-tree-controls">
                      <ForestDetection
                        mapName={plan.map.name}
                        cover={plan.flight?.autoTrees}
                        onChange={(autoTrees) =>
                          commit({
                            ...plan,
                            flight: {
                              ...(plan.flight ?? emptyFlight()),
                              autoTrees,
                            },
                          })
                        }
                      />
                      <p>
                        Tree cover and manual corrections are shared with
                        Flight. Cover suggests concealment; it does not prove a
                        position is hidden.
                      </p>
                    </div>
                  )}
                  <MapLayers
                    map={plan.map}
                    layers={layers}
                    onChange={setLayers}
                    onFocus={focusCoordinate}
                    onTarget={targetCoordinate}
                  />
                </MapLayersDropdown>
                <button
                  type="button"
                  className="map-options-toggle"
                  aria-label="Map controls"
                  aria-expanded={mapOptions}
                  onClick={() => {
                    setMapOptions(!mapOptions);
                    setMenu(false);
                  }}
                >
                  <SlidersHorizontal size={18} />
                  Map
                </button>
                <div
                  className={`map-options-popup ${mapOptions ? "is-open" : ""}`}
                >
                  <button
                    type="button"
                    title="Coordinate grid (1 km)"
                    aria-label="Coordinate grid"
                    disabled={showTerrain || !mapData(plan.map)}
                    aria-pressed={grid}
                    onClick={() => setGrid(!grid)}
                  >
                    <Grid2X2 size={16} />
                  </button>
                  <button
                    type="button"
                    title="Artillery range rings"
                    aria-label="Artillery range rings"
                    disabled={showTerrain || !mapData(plan.map)}
                    aria-pressed={rings}
                    onClick={() => setRings(!rings)}
                  >
                    <Crosshair size={16} />
                  </button>
                  <button
                    type="button"
                    title={drawings ? "Hide drawings" : "Show drawings"}
                    aria-label={drawings ? "Hide drawings" : "Show drawings"}
                    aria-pressed={drawings}
                    onClick={() => setDrawings(!drawings)}
                  >
                    {drawings ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <button
                    type="button"
                    title="Fullscreen"
                    aria-label="Fullscreen"
                    onClick={() => {
                      const action = document.fullscreenElement
                        ? document.exitFullscreen()
                        : document.documentElement.requestFullscreen();
                      void action.catch(() =>
                        setError(
                          "Fullscreen is not available in this browser.",
                        ),
                      );
                    }}
                  >
                    <Maximize size={16} />
                  </button>
                  <button
                    type="button"
                    title={panel ? "Hide panel" : "Show panel"}
                    aria-label={panel ? "Hide panel" : "Show panel"}
                    aria-pressed={panel}
                    onClick={() => setPanel(!panel)}
                  >
                    {panel ? (
                      <PanelRightClose size={16} />
                    ) : (
                      <PanelRightOpen size={16} />
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    aria-label="Import map"
                    onClick={() => imageInput.current?.click()}
                  >
                    <ImagePlus size={16} />
                    <span>Import map</span>
                  </button>
                </div>
                <div className="export-wrap">
                  <button
                    type="button"
                    aria-label="Plan options"
                    disabled={busy}
                    aria-expanded={menu}
                    onClick={() => {
                      setMenu(!menu);
                      setMapOptions(false);
                    }}
                  >
                    <FolderOpen size={16} />
                    Plan
                    <ChevronDown size={13} />
                  </button>
                  {menu && (
                    <div
                      className="export-menu plan-menu"
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          setMenu(false);
                          event.currentTarget.parentElement
                            ?.querySelector<HTMLButtonElement>("button")
                            ?.focus();
                        }
                      }}
                    >
                      <div className="plan-heading">
                        <input
                          aria-label="Plan name"
                          maxLength={120}
                          value={plan.name}
                          onChange={(e) =>
                            commit({ ...plan, name: e.target.value })
                          }
                        />
                        <span
                          className={status === "Not saved" ? "unsaved" : ""}
                          role="status"
                        >
                          <Check size={12} />
                          {status}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          planInput.current?.click();
                          setMenu(false);
                        }}
                      >
                        Open plan <span>Import an editable backup</span>
                      </button>
                      <div className="plan-menu-label">Export</div>
                      <button
                        type="button"
                        onClick={() => {
                          download(
                            new Blob([JSON.stringify(plan)], {
                              type: "application/json",
                            }),
                            `${plan.name || "plan"}.warboard.json`,
                          );
                          setMenu(false);
                        }}
                      >
                        Editable plan <span>JSON · includes map</span>
                      </button>
                      <button type="button" onClick={() => void exportPng()}>
                        Map with drawings <span>PNG · full resolution</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void exportPng(true)}
                      >
                        Current map view <span>PNG · zoomed detail</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          download(
                            new Blob([planBriefing(plan)], {
                              type: "text/plain;charset=utf-8",
                            }),
                            `${plan.name || "plan"}-briefing.txt`,
                          );
                          setMenu(false);
                        }}
                      >
                        Squad briefing{" "}
                        <span>TXT · notes, targets & supplies</span>
                      </button>
                      <OfflineStatus onError={setError} />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div
              className="canvas-wrap"
              ref={observeCanvas}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!busy) void importMap(e.dataTransfer.files[0]);
              }}
            >
              {showTerrain ? (
                <Suspense fallback={<TerrainLoading mapName={plan.map.name} />}>
                  <BoardTerrain
                    treeOutlines={treeOutlines}
                    key={plan.map.name}
                    plan={plan}
                    layers={layers}
                    terrainColor={terrainColor}
                    terrainLighting={terrainLighting}
                    drawings={drawings}
                    onAdd={(p) => {
                      const pixel = toPixel(p, plan.map);
                      if (!pixel || plan.marks.length >= 2000) return;
                      const mark: Mark = {
                        id: crypto.randomUUID(),
                        type: "note",
                        color,
                        width,
                        points: [pixel],
                        text: "FOB candidate",
                      };
                      commit({ ...plan, marks: [...plan.marks, mark] });
                      setSelected(mark.id);
                      setPanel(true);
                    }}
                  />
                </Suspense>
              ) : (
                <>
                  <svg
                    ref={(node) => {
                      svg.current = node;
                      if (!node) return;
                      const wheel = (event: WheelEvent) => {
                        event.preventDefault();
                        if (!gesture.current && event.deltaY !== 0)
                          zoom(
                            event.deltaY > 0 ? 1.12 : 0.89,
                            position(event.clientX, event.clientY),
                          );
                      };
                      node.addEventListener("wheel", wheel, { passive: false });
                      return () => {
                        node.removeEventListener("wheel", wheel);
                        if (svg.current === node) svg.current = null;
                      };
                    }}
                    aria-label="Map drawing canvas"
                    tabIndex={0}
                    className={`canvas tool-${placement ? "note" : tool}`}
                    viewBox={`${camera.x} ${camera.y} ${camera.w} ${camera.h}`}
                    onContextMenu={(e) => e.preventDefault()}
                    onPointerDown={down}
                    onPointerMove={move}
                    onPointerUp={up}
                    onPointerCancel={() => {
                      setMissionDraft(null);
                      gesture.current = null;
                      touches.current.clear();
                      setDraft(null);
                    }}
                  >
                    <rect
                      width={plan.map.width}
                      height={plan.map.height}
                      fill="#c5c7ac"
                    />
                    <defs>
                      <filter
                        id="map-brightness"
                        colorInterpolationFilters="sRGB"
                      >
                        <feComponentTransfer>
                          <feFuncR type="linear" slope={brightness} />
                          <feFuncG type="linear" slope={brightness} />
                          <feFuncB type="linear" slope={brightness} />
                        </feComponentTransfer>
                      </filter>
                    </defs>
                    <image
                      key={mapImage(plan.map, terrainColor)}
                      href={mapImage(plan.map, terrainColor)}
                      onError={(e) => {
                        if (
                          e.currentTarget.getAttribute("href") !==
                          plan.map.image
                        ) {
                          e.currentTarget.setAttribute("href", plan.map.image);
                          setError(
                            "Color imagery unavailable. Showing grayscale terrain.",
                          );
                        }
                      }}
                      width={plan.map.width}
                      height={plan.map.height}
                      filter="url(#map-brightness)"
                    />
                    <DetailTiles
                      color={terrainColor}
                      map={plan.map}
                      camera={camera}
                      viewport={viewport}
                    />
                    {treeOutlines && <BoardTrees plan={plan} />}
                    <g
                      data-annotations="true"
                      display={drawings ? undefined : "none"}
                    >
                      {shown.map((m) => (
                        <Shape
                          key={m.id}
                          mark={m}
                          unit={overlayUnit}
                          selected={false}
                          map={plan.map}
                        />
                      ))}
                    </g>
                    <ReferenceLayer
                      map={plan.map}
                      layers={layers}
                      unit={overlayUnit}
                      onSelect={(next) => {
                        if (performance.now() >= landmarkClickAfter.current)
                          setLandmark(next);
                      }}
                      onCluster={(center, span) => {
                        if (performance.now() < landmarkClickAfter.current)
                          return;
                        const w = Math.max(
                          plan.map.width / 20,
                          Math.min(camera.w / 2, span * 2.5),
                        );
                        setCamera({
                          x: center.x - w / 2,
                          y: center.y - w / 2,
                          w,
                          h: w,
                        });
                        setLandmark(null);
                      }}
                    />
                    <TacticalOverlay
                      plan={workingPlan}
                      interactive
                      selected={selectedMission}
                      onActivate={(field) => {
                        setSection("fire");
                        setSelectedMission(field);
                        setTool("select");
                      }}
                      grid={grid}
                      rings={rings}
                      unit={overlayUnit}
                    />
                    {drawings && active && (
                      <g data-selection="true" pointerEvents="none">
                        <Shape
                          mark={draft?.id === active.id ? draft : active}
                          unit={overlayUnit}
                          selected
                          map={plan.map}
                        />
                      </g>
                    )}
                  </svg>
                  <div className="zoom-controls">
                    <button
                      type="button"
                      aria-label="Zoom out"
                      onClick={() => zoom(1.2)}
                    >
                      <Minus size={17} />
                    </button>
                    <span>
                      {Math.round((plan.map.width / camera.w) * 100)}%
                    </span>
                    <button
                      type="button"
                      aria-label="Zoom in"
                      onClick={() => zoom(1 / 1.2)}
                    >
                      <Plus size={17} />
                    </button>
                    <i />
                    <button
                      type="button"
                      aria-label="Fit map"
                      title="Fit map (0)"
                      onClick={() => fit()}
                    >
                      <Scan size={17} />
                    </button>
                  </div>
                </>
              )}
              {landmark && (
                <div className="landmark-popover">
                  <div className="section-heading">
                    <strong>{landmark.name}</strong>
                    <button
                      type="button"
                      aria-label="Close landmark"
                      onClick={() => setLandmark(null)}
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <p>{coordinateText(landmark.point)}</p>
                  <div>
                    <button
                      type="button"
                      onClick={() => focusCoordinate(landmark.point)}
                    >
                      Center
                    </button>
                    <button
                      type="button"
                      onClick={() => targetCoordinate(landmark.point)}
                    >
                      Use as target
                    </button>
                  </div>
                </div>
              )}
              {busy && (
                <div className="busy" role="status">
                  Processing file…
                </div>
              )}
            </div>
            {!panel && (
              <button
                className="restore-inspector"
                title="Show tool panel"
                type="button"
                aria-label={`Show ${pageNames[section]} panel`}
                onClick={() => setPanel(true)}
              >
                <PanelRightOpen size={18} />
                <span>{pageNames[section]}</span>
              </button>
            )}
            {!showTerrain && (
              <footer>
                <span>
                  {placement
                    ? `Click to place ${placement}. Escape cancels.`
                    : showTerrain
                      ? "Explore terrain · double-click to mark a FOB candidate · switch to 2D to draw"
                      : hints[tool]}
                </span>
                <CoordinateReadout store={cursor} />
              </footer>
            )}
          </main>
          <aside>
            <div className="inspector-heading">
              <h1>{pageNames[section]}</h1>
              <button
                type="button"
                aria-label="Hide tool panel"
                onClick={() => setPanel(false)}
              >
                <PanelRightClose size={17} />
              </button>
            </div>
            {section === "fire" ? (
              <FireSupportPanel
                key={plan.map.name}
                plan={workingPlan}
                onChange={updateMission}
                placement={placement}
                onPlace={setPlacement}
                onFocus={focusCoordinate}
                onError={setError}
                onFrame={frameMission}
              />
            ) : section === "guide" ? (
              <FieldGuide />
            ) : (
              <div className="board-panel">
                <details className="board-briefing">
                  <summary>Plan briefing & checklist</summary>
                  <OperationsPanel
                    value={plan.operations}
                    onChange={(operations) => commit({ ...plan, operations })}
                  />
                </details>
                <section className="properties">
                  <div className="section-heading">
                    <h2>{active ? "Edit annotation" : "Drawing style"}</h2>
                    {active && (
                      <button
                        type="button"
                        aria-label="Deselect annotation"
                        onClick={() => setSelected(null)}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                  <label>Color</label>
                  <div className="colors">
                    {colors.map((c, i) => (
                      <button
                        type="button"
                        key={c}
                        aria-label={`${["Gold", "Coral", "Blue", "White", "Charcoal"][i]} color`}
                        aria-pressed={(active?.color ?? color) === c}
                        style={{ background: c }}
                        onClick={() => {
                          setColor(c);
                          editMark({ color: c });
                        }}
                      >
                        {(active?.color ?? color) === c && (
                          <Check
                            size={16}
                            color={i === 4 ? "#fff" : "#20241f"}
                          />
                        )}
                      </button>
                    ))}
                  </div>
                  {!active && (
                    <>
                      <label htmlFor="note-preset">Quick marker</label>
                      <select
                        id="note-preset"
                        value={notePreset}
                        onChange={(e) => {
                          setNotePreset(e.target.value);
                          setTerrainView(false);
                          setTool("note");
                          setPlacement(null);
                        }}
                      >
                        {[
                          "New note",
                          "Friendly FOB",
                          "Enemy FOB",
                          "Rally point",
                          "Landing zone",
                          "Supply drop",
                          "Danger",
                          "Defend",
                          "Attack",
                        ].map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                    </>
                  )}
                  {active?.type !== "note" && (
                    <>
                      <label className="weight-label" htmlFor="weight">
                        Stroke width<span>{active?.width ?? width} px</span>
                      </label>
                      <input
                        id="weight"
                        type="range"
                        min="2"
                        max="12"
                        value={active?.width ?? width}
                        onChange={(e) => {
                          setWidth(Number(e.target.value));
                          editMark({ width: Number(e.target.value) });
                        }}
                      />
                    </>
                  )}
                  {active?.type === "note" && (
                    <>
                      <label htmlFor="note-text">Note text</label>
                      <textarea
                        id="note-text"
                        ref={noteRef}
                        maxLength={160}
                        value={active.text}
                        onChange={(e) => editMark({ text: e.target.value })}
                      />
                      <small>
                        {active.text.length}/160 · long notes are shortened on
                        the map
                      </small>
                    </>
                  )}
                </section>
                <section className="annotations">
                  <div className="section-heading">
                    <h2>
                      Annotations <span>{plan.marks.length}</span>
                    </h2>
                    {plan.marks.length > 0 && (
                      <button
                        type="button"
                        title="Clear annotations"
                        aria-label="Clear annotations"
                        onClick={() => {
                          if (
                            confirm(
                              "Clear all annotations? You can undo this change.",
                            )
                          ) {
                            commit({ ...plan, marks: [] });
                            setSelected(null);
                          }
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                  {plan.marks.length === 0 ? (
                    <div className="empty">
                      <Pencil size={25} />
                      <h3>Make a plan.</h3>
                      <p>
                        Draw a route, mark a direction,
                        <br />
                        or leave a note for later.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setTerrainView(false);
                          setTool("arrow");
                          svg.current?.focus();
                        }}
                      >
                        Start with an arrow <ArrowUpRight size={16} />
                      </button>
                    </div>
                  ) : (
                    <ol>
                      {plan.marks.map((m, i) => (
                        <li
                          key={m.id}
                          className={selected === m.id ? "selected" : ""}
                        >
                          <button
                            type="button"
                            className="annotation-row"
                            onClick={() => {
                              setSelected(m.id);
                              setTool("select");
                            }}
                          >
                            <span
                              className="annotation-icon"
                              style={{ color: m.color }}
                            >
                              {m.type === "note" ? (
                                <StickyNote size={17} />
                              ) : m.type === "arrow" ? (
                                <ArrowUpRight size={18} />
                              ) : (
                                <Pencil size={16} />
                              )}
                            </span>
                            <span>
                              {m.type === "note"
                                ? m.text || "Empty note"
                                : `${m.type === "pen" ? "Drawing" : m.type === "arrow" ? "Arrow" : m.type === "ruler" ? "Measurement" : m.type === "circle" ? "Area" : "Line"} ${i + 1}`}
                            </span>
                          </button>
                          <button
                            type="button"
                            title="Delete annotation"
                            aria-label={`Delete annotation ${i + 1}`}
                            onClick={() => remove(m.id)}
                          >
                            <X size={14} />
                          </button>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
                <div className="map-info">
                  <label htmlFor="brightness">
                    Map brightness <span>{Math.round(brightness * 100)}%</span>
                  </label>
                  <input
                    id="brightness"
                    type="range"
                    min=".6"
                    max="2.5"
                    step=".05"
                    value={brightness}
                    onChange={(e) => setBrightness(Number(e.target.value))}
                  />
                  <p>
                    Bakurani & Ozeti terrain renders.
                    <br />
                    Your drawings stay with each map.
                  </p>
                  <a
                    href="https://github.com/apollyon-sys/wardogs-calculator"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Terrain data: Apollyon <ArrowUpRight size={12} />
                  </a>
                  <small>
                    Independent community tool.
                    <br />
                    No connection to the game.
                  </small>
                </div>
              </div>
            )}
          </aside>
        </div>
        {error && (
          <div className="error" role="alert">
            <span>{error}</span>
            <button
              type="button"
              aria-label="Dismiss error"
              onClick={() => setError("")}
            >
              <X size={18} />
            </button>
          </div>
        )}
        {help && (
          <HelpDialog shortcuts={tools} onClose={() => setHelp(false)} />
        )}
        {library && (
          <PlanLibrary
            plan={plan}
            initial={library}
            onClose={() => setLibrary(null)}
            onOpen={(next) => {
              commit(next);
              setSelected(null);
              setPlacement(null);
              fit(next.map);
            }}
          />
        )}
        <input
          hidden
          aria-label="Map image file"
          ref={imageInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            void importMap(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <input
          hidden
          aria-label="Plan file"
          ref={planInput}
          type="file"
          accept=".json,.fieldboard.json,.warboard.json"
          onChange={(e) => {
            void importPlan(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
