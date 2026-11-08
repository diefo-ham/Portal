import { useEffect, useId, useMemo, useRef, useState } from "react";
import { clamp } from "@/src/utils/calculator";
import { defaultView, formatNumber as fmt, validView } from "./model";
import {
  implicitRegion,
  implicitSegments,
  interests,
  equalScaleViewport,
  nearestInterestInPixels,
  roots,
  safeValue,
  sampleFunction,
  type Interest,
} from "./numerics";
import type { GraphObject } from "./workspace";
import { coordinateForm } from "./exact";
import { clipAffineInequality } from "./affine";
import type { Point, Viewport } from "@/src/types/calculator";

function ticks(min: number, max: number, minor = false) {
  const rough = (max - min) / 8,
    power = 10 ** Math.floor(Math.log10(rough));
  const step =
    ([1, 2, 5, 10].find((n) => n * power >= rough)! * power) / (minor ? 5 : 1);
  const values: number[] = [];
  for (
    let v = Math.ceil(min / step) * step;
    v <= max + step * 1e-8 && values.length < (minor ? 125 : 25);
    v += step
  )
    values.push(Math.abs(v) < step * 1e-10 ? 0 : v);
  return values;
}
/** Zoom steps as in the reference calculator: the buttons halve or double the view, a wheel notch is gentle. */
const BUTTON_ZOOM = 0.5;
const WHEEL_ZOOM = 0.94;
export function Graph({
  graphs,
  view,
  onView,
  onParameter,
  equalAxes = true,
}: {
  graphs: GraphObject[];
  view: Viewport;
  onView: (v: Viewport, equalAxes?: boolean) => void;
  onParameter?: (id: string, name: string, value: number) => void;
  equalAxes?: boolean;
}) {
  const id = useId().replaceAll(":", "");
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    view: Viewport;
    moved: boolean;
    trace?: GraphObject;
    point?: Interest;
  } | null>(null);
  const [inspect, setInspect] = useState(false);
  const [selected, setSelected] = useState<Interest>();
  const [kept, setKept] = useState<Interest[]>([]);
  const pointKey = (p: Interest) =>
    `${p.graphIds.join(",")}:${p.x.toPrecision(10)}:${p.y.toPrecision(10)}`;
  const pinned = useRef(false);
  const suppressedHover = useRef<string | undefined>(undefined);
  const [notice, setNotice] = useState("");
  const [{ width, height }, setSize] = useState({ width: 640, height: 300 });
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      // Whole pixels: layout often lands a fraction of a pixel off (150.34px),
      // and an unrelated nudge, such as a message appearing below, would then
      // rescale the equal axes and change the window the person typed.
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      if (width > 0 && height > 0)
        setSize((size) =>
          size.width === width && size.height === height
            ? size
            : { width, height },
        );
    });
    if (svg.current) observer.observe(svg.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!equalAxes || width <= 0 || height <= 0) return;
    const adjusted = equalScaleViewport(view, width, height);
    if (
      Math.abs(adjusted.yMin - view.yMin) >
        Math.max(1, Math.abs(view.yMin)) * 1e-12 ||
      Math.abs(adjusted.yMax - view.yMax) >
        Math.max(1, Math.abs(view.yMax)) * 1e-12
    )
      if (validView(adjusted)) onView(adjusted, true);
  }, [width, height, equalAxes, view]);
  const sx = width / (view.xMax - view.xMin),
    sy = height / (view.yMax - view.yMin);
  const px = (x: number) => (x - view.xMin) * sx,
    py = (y: number) => height - (y - view.yMin) * sy;
  const changeView = (v: Viewport, contain = false) => {
    const adjusted = equalScaleViewport(v, width, height, contain);
    if (validView(adjusted)) {
      onView(adjusted, true);
      setSelected(undefined);
      setNotice("");
    } else
      setNotice(
        "The graph window is outside the supported range (±10¹⁰; minimum span 10⁻⁷).",
      );
  };
  const zoom = (
    factor: number,
    x = (view.xMin + view.xMax) / 2,
    y = (view.yMin + view.yMax) / 2,
  ) =>
    changeView({
      xMin: x + (view.xMin - x) * factor,
      xMax: x + (view.xMax - x) * factor,
      yMin: y + (view.yMin - y) * factor,
      yMax: y + (view.yMax - y) * factor,
    });
  useEffect(() => {
    const element = svg.current;
    const wheel = (e: WheelEvent) => {
      if (document.activeElement !== element) return;
      e.preventDefault();
      const p = locate(e.clientX, e.clientY);
      zoom(e.deltaY < 0 ? WHEEL_ZOOM : 1 / WHEEL_ZOOM, p.x, p.y);
    };
    element?.addEventListener("wheel", wheel, { passive: false });
    return () => element?.removeEventListener("wheel", wheel);
  }, [view, onView]);
  const geometry = useMemo(
    () =>
      graphs.map((g) => {
        if (g.kind !== "points" && g.affine)
          return { graph: g, region: clipAffineInequality(g.affine, view) };
        if (g.kind === "function")
          return {
            graph: g,
            paths: sampleFunction(g.fn, view, width, height, !!g.relation),
          };
        if (g.kind === "vertical")
          return {
            graph: g,
            xs:
              g.boundary !== undefined
                ? [g.boundary]
                : (g.rootsInWindow ?? ((min, max) => roots(g.fn, min, max)))(
                    view.xMin,
                    view.xMax,
                  ),
          };
        if (g.kind === "implicit")
          return {
            graph: g,
            segments: implicitSegments(g.fn, view),
            shade: g.region ? implicitRegion(g.fn, g.region, view) : undefined,
          };
        return { graph: g };
      }),
    [graphs, view, width, height],
  );
  const special = useMemo(
    () =>
      inspect
        ? interests(graphs, view).filter(
            (point) => point.label !== "data point",
          )
        : [],
    [graphs, view, inspect],
  );
  useEffect(() => {
    const reconcile = (point: Interest | undefined) => {
      const graph =
        point && graphs.find((graph) => point.graphIds.includes(graph.id));
      if (!point || !graph) {
        pinned.current = false;
        return undefined;
      }
      if (graph.kind === "points") {
        if (graph.points.length === 1) return { ...point, ...graph.points[0] };
        return graph.points.some((p) => p.x === point.x && p.y === point.y)
          ? point
          : undefined;
      }
      if (graph.kind === "function" && point.label === "curve point") {
        const y = safeValue(graph.fn, point.x);
        return Number.isFinite(y) ? { ...point, y } : undefined;
      }
      // A numerical POI must not retain stale coordinates after math edits.
      return special
        .filter(
          (p) =>
            p.label === point.label &&
            p.graphIds.every((id) => point.graphIds.includes(id)),
        )
        .sort(
          (a, b) =>
            Math.hypot(a.x - point.x, a.y - point.y) -
            Math.hypot(b.x - point.x, b.y - point.y),
        )[0];
    };
    setSelected(reconcile);
    setKept((points) =>
      points.map(reconcile).filter((point): point is Interest => !!point),
    );
  }, [graphs]);
  const path = (p: Point[]) =>
    p
      .map(
        (v, i) =>
          `${i ? "L" : "M"}${px(v.x).toFixed(2)},${clamp(py(v.y), -10000, 10000).toFixed(2)}`,
      )
      .join("");
  const locate = (clientX: number, clientY: number) => {
    const r = svg.current!.getBoundingClientRect();
    return {
      x: view.xMin + ((clientX - r.left) / r.width) * (view.xMax - view.xMin),
      y: view.yMax - ((clientY - r.top) / r.height) * (view.yMax - view.yMin),
    };
  };
  const nearestAt = (p: Point, pointerType = "mouse"): Interest | undefined => {
    const pointTolerance = pointerType === "touch" ? 30 : 22;
    // A real parameter-controlled point takes precedence over a nearby curve.
    const draggable: Interest[] = [];
    for (const graph of graphs)
      if (graph.kind === "points" && graph.drag) {
        draggable.push(
          ...graph.points.map((point) => ({
            ...point,
            label: "parameter point",
            graphIds: [graph.id],
          })),
        );
      }
    const parameter = nearestInterestInPixels(
      draggable,
      p,
      sx,
      sy,
      pointTolerance,
    );
    if (parameter) return parameter;
    const pointCandidates: Interest[] = [...special];
    for (const g of graphs) {
      if (g.kind === "points")
        pointCandidates.push(
          ...g.points.map((v) => ({
            ...v,
            label: "data point",
            graphIds: [g.id],
          })),
        );
    }
    const point = nearestInterestInPixels(
      pointCandidates,
      p,
      sx,
      sy,
      pointTolerance,
    );
    if (point) return point;
    const curves = graphs
      .filter(
        (g): g is Extract<GraphObject, { kind: "function" }> =>
          g.kind === "function",
      )
      .map((g) => ({
        x: p.x,
        y: safeValue(g.fn, p.x),
        label: "curve point",
        graphIds: [g.id],
      }));
    return nearestInterestInPixels(curves, p, sx, sy, 14);
  };
  const selectAt = (p: Point) => {
    const point = nearestAt(p);
    if (point && point.label !== "curve point") togglePoint(point);
    else {
      if (!point) setKept([]);
      pinned.current = !!point;
      setSelected(point);
    }
  };
  const togglePoint = (p: Interest) => {
    const key = pointKey(p);
    // Releasing pointer capture can fire PointerEnter again. A deselected
    // point must stay visibly deselected until the pointer actually leaves.
    suppressedHover.current = kept.some((point) => pointKey(point) === key)
      ? key
      : undefined;
    setKept((points) =>
      points.some((point) => pointKey(point) === key)
        ? points.filter((point) => pointKey(point) !== key)
        : [...points, p],
    );
    pinned.current = false;
    setSelected(undefined);
  };
  const selectPoint = (p: Interest, pin = true) => {
    if (!pin && suppressedHover.current === pointKey(p)) return;
    pinned.current = pin;
    setSelected(p);
  };
  const labels = [
    ...kept,
    ...(selected && !kept.some((p) => pointKey(p) === pointKey(selected))
      ? [selected]
      : []),
  ].filter(
    (p) =>
      Number.isFinite(p.y) &&
      px(p.x) >= 0 &&
      px(p.x) <= width &&
      py(p.y) >= 0 &&
      py(p.y) <= height,
  );
  const boxes: { x: number; y: number; width: number }[] = [];
  const pointLabels = labels.map((point) => {
    const label =
      "≈ (" + coordinateForm(point.x) + ", " + coordinateForm(point.y) + ")";
    const labelWidth = Math.min(width - 12, label.length * 7 + 18);
    const x = Math.max(6, Math.min(width - labelWidth - 6, px(point.x) + 12));
    let y = Math.max(6, Math.min(height - 32, py(point.y) - 37));
    for (
      let i = 0;
      i < 8 &&
      boxes.some(
        (b) =>
          x < b.x + b.width &&
          x + labelWidth > b.x &&
          y < b.y + 29 &&
          y + 29 > b.y,
      );
      i++
    )
      y = y >= 40 ? y - 33 : Math.min(height - 32, py(point.y) + 16 + i * 33);
    boxes.push({ x, y, width: labelWidth });
    return { point, label, x, y, labelWidth };
  });
  return (
    <section className="graph-area" aria-label="Graphing plane">
      <div className="graph-controls">
        <button aria-label="Zoom in" onClick={() => zoom(BUTTON_ZOOM)}>
          +
        </button>
        <button aria-label="Zoom out" onClick={() => zoom(1 / BUTTON_ZOOM)}>
          −
        </button>
        <button onClick={() => changeView(defaultView())}>Reset view</button>
        <button
          aria-pressed={inspect}
          onClick={() => {
            setInspect(!inspect);
            setSelected(undefined);
            setKept([]);
            pinned.current = false;
            suppressedHover.current = undefined;
          }}
        >
          Inspect points
        </button>
      </div>
      <svg
        ref={svg}
        className="graph-plane"
        data-x-min={view.xMin}
        data-x-max={view.xMax}
        data-y-min={view.yMin}
        data-y-max={view.yMax}
        data-equal-axes={equalAxes}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Cartesian graph. Drag empty space to pan or drag a curve to trace. Use zoom buttons or scroll over the focused graph to zoom. Arrow keys pan; with a curve selected, Left and Right trace it. Escape clears the selection."
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Escape" && (selected || kept.length)) {
            e.preventDefault();
            e.stopPropagation();
            setSelected(undefined);
            setKept([]);
            pinned.current = false;
            return;
          }
          const active =
            selected && graphs.find((g) => g.id === selected.graphIds[0]);
          if (
            (e.key === "ArrowLeft" || e.key === "ArrowRight") &&
            active?.kind === "function" &&
            selected
          ) {
            e.preventDefault();
            const x =
              selected.x +
              ((view.xMax - view.xMin) / 100) *
                (e.key === "ArrowLeft" ? -1 : 1);
            const y = safeValue(active.fn, x);
            setSelected(Number.isFinite(y) ? { ...selected, x, y } : undefined);
            return;
          }
          const dx = (view.xMax - view.xMin) * 0.1,
            dy = (view.yMax - view.yMin) * 0.1;
          if (
            ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
          ) {
            e.preventDefault();
            const x =
              e.key === "ArrowLeft" ? -dx : e.key === "ArrowRight" ? dx : 0;
            const y =
              e.key === "ArrowDown" ? -dy : e.key === "ArrowUp" ? dy : 0;
            changeView({
              xMin: view.xMin + x,
              xMax: view.xMax + x,
              yMin: view.yMin + y,
              yMax: view.yMax + y,
            });
          } else if (e.key === "+" || e.key === "=") {
            e.preventDefault();
            zoom(BUTTON_ZOOM);
          } else if (e.key === "-") {
            e.preventDefault();
            zoom(1 / BUTTON_ZOOM);
          } else if (e.key === "Home") {
            e.preventDefault();
            changeView(defaultView());
          }
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          svg.current?.focus();
          e.currentTarget.setPointerCapture(e.pointerId);
          const p = locate(e.clientX, e.clientY);
          const index = (e.target as Element)
            .closest("[data-interest-index]")
            ?.getAttribute("data-interest-index");
          const nearest =
            index !== undefined && index !== null
              ? special[Number(index)]
              : nearestAt(p, e.pointerType);
          const object =
            nearest && graphs.find((g) => g.id === nearest.graphIds[0]);
          const trace =
            (object?.kind === "function" && nearest?.label === "curve point") ||
            (object?.kind === "points" && object.drag)
              ? object
              : undefined;
          if (nearest) selectPoint(nearest);
          else {
            setSelected(undefined);
            setKept([]);
            suppressedHover.current = undefined;
            pinned.current = false;
          }
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            view,
            moved: false,
            trace,
            point: nearest,
          };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          if (d.trace) {
            const x = locate(e.clientX, e.clientY).x;
            const graph = d.trace;
            const y =
              graph.kind === "function"
                ? safeValue(graph.fn, x)
                : graph.kind === "points" && graph.drag
                  ? safeValue(graph.drag.y, x)
                  : NaN;
            d.moved = true;
            if (Number.isFinite(y)) {
              setSelected({
                x,
                y,
                graphIds: [graph.id],
                label:
                  graph.kind === "function" ? "curve point" : "parameter point",
              });
              if (graph.kind === "points" && graph.drag)
                onParameter?.(graph.drag.id, graph.drag.name, x);
            } else setSelected(undefined);
            return;
          }
          const r = svg.current!.getBoundingClientRect();
          const dx =
              ((e.clientX - d.x) / r.width) * (d.view.xMax - d.view.xMin),
            dy = ((e.clientY - d.y) / r.height) * (d.view.yMax - d.view.yMin);
          if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 3)
            d.moved = true;
          if (d.moved)
            changeView({
              xMin: d.view.xMin - dx,
              xMax: d.view.xMax - dx,
              yMin: d.view.yMin + dy,
              yMax: d.view.yMax + dy,
            });
        }}
        onPointerUp={(e) => {
          if (drag.current && !drag.current.moved) {
            const p = drag.current.point;
            if (p && p.label !== "curve point") togglePoint(p);
            else selectAt(locate(e.clientX, e.clientY));
          }
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <title>Local Cartesian graph</title>
        <desc>
          Numeric window x {fmt(view.xMin)} to {fmt(view.xMax)}, y{" "}
          {fmt(view.yMin)} to {fmt(view.yMax)}. Use Inspect points for
          keyboard-accessible points. Drag a curve to trace it; point labels
          appear on the graph.
        </desc>
        <defs>
          <clipPath id={id}>
            <rect width={width} height={height} />
          </clipPath>
        </defs>
        <rect width={width} height={height} className="graph-background" />
        <g className="graph-minor-grid">
          {ticks(view.xMin, view.xMax, true).map((x) => (
            <line key={x} x1={px(x)} x2={px(x)} y1={0} y2={height} />
          ))}
          {ticks(view.yMin, view.yMax, true).map((y) => (
            <line key={y} y1={py(y)} y2={py(y)} x1={0} x2={width} />
          ))}
        </g>
        <g className="graph-grid">
          {ticks(view.xMin, view.xMax).map((x) => (
            <line key={x} x1={px(x)} x2={px(x)} y1={0} y2={height} />
          ))}
          {ticks(view.yMin, view.yMax).map((y) => (
            <line key={y} y1={py(y)} y2={py(y)} x1={0} x2={width} />
          ))}
        </g>
        <g className="graph-axes">
          <line x1={px(0)} x2={px(0)} y1={0} y2={height} />
          <line y1={py(0)} y2={py(0)} x1={0} x2={width} />
        </g>
        <g className="graph-labels">
          {ticks(view.xMin, view.xMax)
            .filter((x) => x !== 0 && px(x) > 20 && px(x) < width - 20)
            .map((x) => (
              <text
                key={x}
                x={px(x) + 4}
                y={Math.max(18, Math.min(height - 10, py(0) + 17))}
              >
                {fmt(x)}
              </text>
            ))}
          {ticks(view.yMin, view.yMax)
            .filter((y) => py(y) > 20 && py(y) < height - 20)
            .map((y) => (
              <text
                key={y}
                x={Math.max(5, Math.min(width - 70, px(0) + 5))}
                y={py(y) - 4}
              >
                {fmt(y)}
              </text>
            ))}
          <text
            x={width - 14}
            y={Math.max(18, Math.min(height - 14, py(0) - 8))}
          >
            x
          </text>
          <text x={Math.max(8, Math.min(width - 18, px(0) + 8))} y={18}>
            y
          </text>
        </g>
        <g clipPath={`url(#${id})`}>
          {geometry.map(({ graph: g, paths, xs, segments, region, shade }) => (
            <g
              key={g.id}
              className={`graph-color-${g.color % 8}`}
              data-graph-id={g.id}
            >
              {region && g.affine && (
                <>
                  {region.shade.length > 2 && (
                    <path
                      d={`${path(region.shade)}Z`}
                      className="graph-shade"
                    />
                  )}
                  {region.boundary.length > 1 && (
                    <path
                      d={path(region.boundary)}
                      className="graph-curve"
                      strokeDasharray={
                        g.affine.op.length === 1 ? "7 5" : undefined
                      }
                    />
                  )}
                </>
              )}
              {paths?.map((p, i) => (
                <g key={i}>
                  {g.kind === "function" && g.relation && (
                    <path
                      d={`${path(p)}L${px(p.at(-1)!.x)},${g.relation.startsWith("<") ? height : 0}L${px(p[0].x)},${g.relation.startsWith("<") ? height : 0}Z`}
                      className="graph-shade"
                    />
                  )}
                  <path
                    d={path(p)}
                    className="graph-curve"
                    strokeDasharray={
                      g.kind === "function" && g.relation?.length === 1
                        ? "7 5"
                        : undefined
                    }
                  />
                </g>
              ))}
              {xs?.map((x) => (
                <g key={x}>
                  {g.kind === "vertical" && g.relation && (
                    <rect
                      x={
                        g.relation.startsWith("<")
                          ? 0
                          : Math.max(0, Math.min(width, px(x)))
                      }
                      y={0}
                      width={
                        g.relation.startsWith("<")
                          ? Math.max(0, Math.min(width, px(x)))
                          : width - Math.max(0, Math.min(width, px(x)))
                      }
                      height={height}
                      className="graph-shade"
                    />
                  )}
                  <line
                    x1={px(x)}
                    x2={px(x)}
                    y1={0}
                    y2={height}
                    className="graph-curve"
                    strokeDasharray={
                      g.kind === "vertical" && g.relation?.length === 1
                        ? "7 5"
                        : undefined
                    }
                  />
                </g>
              ))}
              {shade && shade.length > 0 && (
                <path
                  className="graph-shade"
                  d={shade
                    .map(
                      (r) =>
                        `M${px(r.x0)},${py(r.y1)}H${px(r.x1)}V${py(r.y0)}H${px(r.x0)}Z`,
                    )
                    .join("")}
                />
              )}
              {segments && (
                <path
                  className="graph-curve"
                  strokeDasharray={
                    g.kind === "implicit" && g.region?.length === 1
                      ? "7 5"
                      : undefined
                  }
                  d={segments.map(([a, b]) => path([a, b])).join("")}
                />
              )}
              {g.kind === "points" &&
                g.points.map((p, i) => (
                  <circle
                    key={i}
                    cx={px(p.x)}
                    cy={py(p.y)}
                    r={5}
                    className="graph-data-point"
                    role="button"
                    tabIndex={0}
                    aria-label={`Point (${fmt(p.x)}, ${fmt(p.y)})${g.drag ? `; draggable ${g.drag.name}` : ""}`}
                    onFocus={() => {
                      suppressedHover.current = undefined;
                      selectPoint(
                        {
                          ...p,
                          label: "data point",
                          graphIds: [g.id],
                        },
                        false,
                      );
                    }}
                    onPointerEnter={() => {
                      if (!pinned.current)
                        selectPoint(
                          { ...p, label: "data point", graphIds: [g.id] },
                          false,
                        );
                    }}
                    onPointerLeave={() => {
                      suppressedHover.current = undefined;
                      if (!pinned.current) setSelected(undefined);
                    }}
                    onBlur={() => {
                      suppressedHover.current = undefined;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        togglePoint({
                          ...p,
                          label: "data point",
                          graphIds: [g.id],
                        });
                      }
                      if (
                        g.drag &&
                        ["ArrowLeft", "ArrowRight"].includes(e.key)
                      ) {
                        e.preventDefault();
                        e.stopPropagation();
                        const x =
                          p.x +
                          (e.key === "ArrowLeft" ? -1 : 1) *
                            (e.shiftKey ? 1 : 0.1);
                        if (Number.isFinite(safeValue(g.drag.y, x)))
                          onParameter?.(g.drag.id, g.drag.name, x);
                      }
                    }}
                  />
                ))}
            </g>
          ))}
          {special.map((p, i) => (
            <circle
              data-interest-index={i}
              key={i}
              cx={px(p.x)}
              cy={py(p.y)}
              r={4}
              className="graph-interest"
              role="button"
              tabIndex={0}
              aria-label={`${p.label} ≈ (${fmt(p.x)}, ${fmt(p.y)})`}
              onFocus={() => {
                suppressedHover.current = undefined;
                selectPoint(p, false);
              }}
              onPointerEnter={() => {
                if (!pinned.current) selectPoint(p, false);
              }}
              onPointerLeave={() => {
                suppressedHover.current = undefined;
                if (!pinned.current) setSelected(undefined);
              }}
              onBlur={() => {
                suppressedHover.current = undefined;
              }}

              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  togglePoint(p);
                }
              }}
            />
          ))}
          {kept.map((p) => (
            <circle
              key={pointKey(p)}
              cx={px(p.x)}
              cy={py(p.y)}
              r={5}
              className="graph-selection"
            />
          ))}
          {selected && (
            <circle
              cx={px(selected.x)}
              cy={py(selected.y)}
              r={6}
              className="graph-selection"
            />
          )}
        </g>
        {pointLabels.map(({ point, label, x, y, labelWidth }) => (
          <g
            key={pointKey(point)}
            className="graph-point-label"
            aria-label={point.label + " " + label}
          >
            <line
              x1={px(point.x)}
              y1={py(point.y)}
              x2={x + labelWidth / 2}
              y2={y + 29}
              stroke="var(--muted)"
              strokeOpacity=".4"
            />
            <rect x={x} y={y} width={labelWidth} height={29} rx={4} />
            <text x={x + 9} y={y + 19}>
              {label}
            </text>
          </g>
        ))}
      </svg>
      <p className="graph-hint">
        Drag empty space to pan · drag a curve to trace · focus graph to
        scroll-zoom
      </p>
      {notice && (
        <p className="calc-error" role="status">
          {notice}
        </p>
      )}
      <details className="graph-window">
        <summary>Graph window</summary>
        <p>Bounds expand as needed to keep equal x/y unit scale.</p>
        <WindowFields view={view} onView={(next) => changeView(next, true)} />
      </details>
    </section>
  );
}

const windowKeys = ["xMin", "xMax", "yMin", "yMax"] as const;
const windowText = (v: Viewport) =>
  Object.fromEntries(windowKeys.map((key) => [key, String(v[key])])) as Record<
    (typeof windowKeys)[number],
    string
  >;

function WindowFields({
  view,
  onView,
}: {
  view: Viewport;
  onView: (v: Viewport) => void;
}) {
  const [fields, setFields] = useState(() => windowText(view));
  // Numbers the person is typing are never replaced by a graph that moved or
  // resized in the meantime; untouched fields follow the graph.
  const [edited, setEdited] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!edited) setFields(windowText(view));
  }, [view, edited]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const draft = Object.fromEntries(
          windowKeys.map((key) => [
            key,
            fields[key].trim() === "" ? NaN : Number(fields[key]),
          ]),
        ) as unknown as Viewport;
        if (validView(draft)) {
          setEdited(false);
          onView(draft);
          setError("");
        } else
          setError(
            "Use finite bounds, with each minimum below its maximum (range 10⁻⁷ to ±10¹⁰).",
          );
      }}
    >
      {windowKeys.map((key) => (
        <label key={key}>
          {key}
          <input
            aria-label={key}
            type="number"
            step="any"
            value={fields[key]}
            onChange={(e) => {
              setEdited(true);
              setFields((f) => ({ ...f, [key]: e.target.value }));
            }}
          />
        </label>
      ))}
      <button>Apply window</button>
      {error && <p className="incorrect small">{error}</p>}
    </form>
  );
}
