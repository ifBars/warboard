import BoardTrees from "./BoardTrees";
import type { Plan } from "../model";
import Shape from "./AnnotationShape";
import ReferenceLayer, { type LayerSettings } from "./ReferenceLayer";
import TacticalOverlay from "./TacticalOverlay";
import type { Camera } from "../viewport";
export default function ExportMap({
  plan,
  omitBase = false,
  brightness,
  layers,
  grid,
  rings,
  view,
}: {
  plan: Plan;
  omitBase?: boolean;
  brightness: number;
  layers: LayerSettings;
  grid: boolean;
  rings: boolean;
  view?: Camera;
}) {
  const unit = plan.map.width / 1200;
  const bounds = view ?? { x: 0, y: 0, w: plan.map.width, h: plan.map.height };
  const overlayUnit = view ? Math.max(view.w, view.h) / 1200 : unit;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={bounds.w}
      height={bounds.h}
      viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}
    >
      <defs>
        <filter id="export-brightness" colorInterpolationFilters="sRGB">
          <feComponentTransfer>
            <feFuncR type="linear" slope={brightness} />
            <feFuncG type="linear" slope={brightness} />
            <feFuncB type="linear" slope={brightness} />
          </feComponentTransfer>
        </filter>
      </defs>
      {!view && !omitBase && (
        <image
          href={plan.map.image}
          width={plan.map.width}
          height={plan.map.height}
          filter="url(#export-brightness)"
        />
      )}
      <BoardTrees plan={plan} />
      {plan.marks.map((m) => (
        <Shape key={m.id} mark={m} unit={overlayUnit} map={plan.map} />
      ))}
      <ReferenceLayer
        map={plan.map}
        layers={layers}
        unit={view ? overlayUnit : unit / 2}
        onSelect={() => {}}
      />
      <TacticalOverlay
        plan={plan}
        grid={grid}
        rings={rings}
        unit={overlayUnit}
      />
    </svg>
  );
}
