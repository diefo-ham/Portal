import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  defaultView,
  formatNumber as fmt,
  validView,
  type Point,
  type Viewport,
} from "./model";
import {
  fitViewport,
  implicitSegments,
  interests,
  roots,
  safeValue,
  sampleFunction,
  type Interest,
} from "./numerics";
import type { GraphObject } from "./workspace";

function ticks(min: number, max: number) {
  const rough = (max - min) / 8,
    power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].find((n) => n * power >= rough)! * power;
  const values: number[] = [];
  for (
    let v = Math.ceil(min / step) * step;
    v <= max + step * 1e-8 && values.length < 25;
    v += step
  )
    values.push(Math.abs(v) < step * 1e-10 ? 0 : v);
  return values;
}
export function Graph({
  graphs,
  view,
  onView,
  onParameter,
}: {
  graphs: GraphObject[];
  view: Viewport;
  onView: (v: Viewport) => void;
  onParameter?: (id: string, name: string, value: number) => void;
}) {
  const id = useId().replaceAll(":", "");
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    view: Viewport;
    moved: boolean;
    trace?: GraphObject;
  } | null>(null);
  const [inspect, setInspect] = useState(false);
  const [selected, setSelected] = useState<Interest>();
  const pinned = useRef(false);
  const [notice, setNotice] = useState("");
  const [{ width, height }, setSize] = useState({ width: 640, height: 300 });
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    if (svg.current) observer.observe(svg.current);
    return () => observer.disconnect();
  }, []);
  const sx = width / (view.xMax - view.xMin),
    sy = height / (view.yMax - view.yMin);
  const px = (x: number) => (x - view.xMin) * sx,
    py = (y: number) => height - (y - view.yMin) * sy;
  const changeView = (v: Viewport) => {
    if (validView(v)) {
      onView(v);
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
      zoom(e.deltaY < 0 ? 0.85 : 1 / 0.85, p.x, p.y);
    };
    element?.addEventListener("wheel", wheel, { passive: false });
    return () => element?.removeEventListener("wheel", wheel);
  }, [view, onView]);
  const geometry = useMemo(
    () =>
      graphs.map((g) => {
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
                : roots(g.fn, view.xMin, view.xMax),
          };
        if (g.kind === "implicit")
          return { graph: g, segments: implicitSegments(g.fn, view) };
        return { graph: g };
      }),
    [graphs, view, width, height],
  );
  const special = useMemo(
    () => (inspect ? interests(graphs, view) : []),
    [graphs, view, inspect],
  );
  useEffect(() => {
    setSelected((point) => {
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
    });
  }, [graphs, special]);
  const path = (p: Point[]) =>
    p
      .map(
        (v, i) =>
          `${i ? "L" : "M"}${px(v.x).toFixed(2)},${Math.max(-10000, Math.min(10000, py(v.y))).toFixed(2)}`,
      )
      .join("");
  const locate = (clientX: number, clientY: number) => {
    const r = svg.current!.getBoundingClientRect();
    return {
      x: view.xMin + ((clientX - r.left) / r.width) * (view.xMax - view.xMin),
      y: view.yMax - ((clientY - r.top) / r.height) * (view.yMax - view.yMin),
    };
  };
  const nearestAt = (p: Point): Interest | undefined => {
    // A real parameter-controlled point takes precedence over a nearby curve.
    for (const graph of graphs)
      if (graph.kind === "points" && graph.drag) {
        const point = graph.points.find(
          (point) =>
            Math.hypot((point.x - p.x) * sx, (point.y - p.y) * sy) < 12,
        );
        if (point)
          return { ...point, label: "parameter point", graphIds: [graph.id] };
      }
    const candidates: Interest[] = [...special];
    for (const g of graphs) {
      if (g.kind === "function")
        candidates.push({
          x: p.x,
          y: safeValue(g.fn, p.x),
          label: "curve point",
          graphIds: [g.id],
        });
      if (g.kind === "points")
        candidates.push(
          ...g.points.map((v) => ({
            ...v,
            label: "data point",
            graphIds: [g.id],
          })),
        );
    }
    candidates.sort(
      (a, b) =>
        Math.hypot((a.x - p.x) * sx, (a.y - p.y) * sy) -
        Math.hypot((b.x - p.x) * sx, (b.y - p.y) * sy),
    );
    const nearest = candidates.find((v) => Number.isFinite(v.y));
    return nearest &&
      Math.hypot((nearest.x - p.x) * sx, (nearest.y - p.y) * sy) < 14
      ? nearest
      : undefined;
  };
  const selectAt = (p: Point) => {
    pinned.current = true;
    setSelected(nearestAt(p));
  };
  const selectPoint = (p: Interest, pin = true) => {
    pinned.current = pin;
    setSelected(p);
  };
  // Coordinate inspection is approximate; avoid pixel-motion noise in labels.
  // Numerical computations and saved slider values retain their full precision.
  const coordinate = (value: number) => fmt(Number(value.toPrecision(6)));
  const label = selected
    ? `≈ (${coordinate(selected.x)}, ${coordinate(selected.y)})`
    : "";
  const labelWidth = Math.min(width - 12, label.length * 7 + 18);
  const labelX = selected
    ? Math.max(6, Math.min(width - labelWidth - 6, px(selected.x) + 12))
    : 0;
  const labelY = selected
    ? Math.max(6, Math.min(height - 32, py(selected.y) - 37))
    : 0;
  return (
    <section className="graph-area" aria-label="Graphing plane">
      <div className="graph-controls">
        <button aria-label="Zoom in" onClick={() => zoom(0.7)}>
          +
        </button>
        <button aria-label="Zoom out" onClick={() => zoom(1 / 0.7)}>
          −
        </button>
        <button onClick={() => changeView(defaultView())}>Reset view</button>
        <button
          disabled={
            !graphs.some(
              (g) =>
                g.kind === "function" ||
                (g.kind === "points" && g.points.length > 0),
            )
          }
          title="Fit sampled functions and data points"
          onClick={() => {
            const v = fitViewport(graphs, view);
            if (v) changeView(v);
            else
              setNotice(
                "No finite sampled values are available in this x window. Try changing the graph window.",
              );
          }}
        >
          Fit
        </button>
        <button
          onClick={() => {
            const center = (view.yMax + view.yMin) / 2;
            const span = ((view.xMax - view.xMin) * height) / width;
            changeView({
              ...view,
              yMin: center - span / 2,
              yMax: center + span / 2,
            });
          }}
        >
          Square axes
        </button>
        <button
          aria-pressed={inspect}
          onClick={() => {
            setInspect(!inspect);
            setSelected(undefined);
          }}
        >
          Inspect points
        </button>
      </div>
      <svg
        ref={svg}
        className="graph-plane"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Cartesian graph. Drag empty space to pan or drag a curve to trace. Use zoom buttons or scroll over the focused graph to zoom. Arrow keys pan; with a curve selected, Left and Right trace it. Escape clears the selection."
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Escape" && selected) {
            e.preventDefault();
            e.stopPropagation();
            setSelected(undefined);
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
            zoom(0.7);
          } else if (e.key === "-") {
            e.preventDefault();
            zoom(1 / 0.7);
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
          const nearest = nearestAt(p);
          const object =
            nearest && graphs.find((g) => g.id === nearest.graphIds[0]);
          const trace =
            object?.kind === "function" ||
            (object?.kind === "points" && object.drag)
              ? object
              : undefined;
          if (nearest) selectPoint(nearest);
          else {
            setSelected(undefined);
            pinned.current = false;
          }
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            view,
            moved: false,
            trace,
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
          if (drag.current && !drag.current.moved)
            selectAt(locate(e.clientX, e.clientY));
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
          {geometry.map(({ graph: g, paths, xs, segments }) => (
            <g
              key={g.id}
              className={`graph-color-${g.color % 8}`}
              data-graph-id={g.id}
            >
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
              {segments && (
                <path
                  className="graph-curve"
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
                    onFocus={() =>
                      selectPoint({
                        ...p,
                        label: "data point",
                        graphIds: [g.id],
                      })
                    }
                    onPointerEnter={() => {
                      if (!pinned.current)
                        selectPoint(
                          { ...p, label: "data point", graphIds: [g.id] },
                          false,
                        );
                    }}
                    onPointerLeave={() => {
                      if (!pinned.current) setSelected(undefined);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        selectPoint({
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
              key={i}
              cx={px(p.x)}
              cy={py(p.y)}
              r={4}
              className="graph-interest"
              role="button"
              tabIndex={0}
              aria-label={`${p.label} ≈ (${fmt(p.x)}, ${fmt(p.y)})`}
              onFocus={() => selectPoint(p)}
              onPointerEnter={() => {
                if (!pinned.current) selectPoint(p, false);
              }}
              onPointerLeave={() => {
                if (!pinned.current) setSelected(undefined);
              }}
              onClick={(e) => {
                e.stopPropagation();
                selectPoint(p);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  selectPoint(p);
                }
              }}
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
        {selected &&
          Number.isFinite(selected.y) &&
          px(selected.x) >= 0 &&
          px(selected.x) <= width &&
          py(selected.y) >= 0 &&
          py(selected.y) <= height && (
            <g
              className="graph-point-label"
              aria-label={`${selected.label} ${label}`}
            >
              <rect
                x={labelX}
                y={labelY}
                width={labelWidth}
                height={29}
                rx={4}
              />
              <text x={labelX + 9} y={labelY + 19}>
                {label}
              </text>
            </g>
          )}
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
        <WindowFields
          key={JSON.stringify(view)}
          view={view}
          onView={changeView}
        />
      </details>
    </section>
  );
}

function WindowFields({
  view,
  onView,
}: {
  view: Viewport;
  onView: (v: Viewport) => void;
}) {
  const [draft, setDraft] = useState(view);
  const [error, setError] = useState("");
  return (
    <form
      key={JSON.stringify(view)}
      onSubmit={(e) => {
        e.preventDefault();
        if (validView(draft)) {
          onView(draft);
          setError("");
        } else
          setError(
            "Use finite bounds, with each minimum below its maximum (range 10⁻⁷ to ±10¹⁰).",
          );
      }}
    >
      {(["xMin", "xMax", "yMin", "yMax"] as const).map((key) => (
        <label key={key}>
          {key}
          <input
            aria-label={key}
            type="number"
            step="any"
            defaultValue={view[key]}
            onChange={(e) =>
              setDraft((d) => ({ ...d, [key]: e.target.valueAsNumber }))
            }
          />
        </label>
      ))}
      <button>Apply window</button>
      {error && <p className="incorrect small">{error}</p>}
    </form>
  );
}
