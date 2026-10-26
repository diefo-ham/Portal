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
}: {
  graphs: GraphObject[];
  view: Viewport;
  onView: (v: Viewport) => void;
}) {
  const id = useId().replaceAll(":", "");
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    view: Viewport;
    moved: boolean;
  } | null>(null);
  const [inspect, setInspect] = useState(false);
  const [selected, setSelected] = useState<Interest>();
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
  const selectAt = (p: Point) => {
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
    setSelected(
      nearest && Math.hypot((nearest.x - p.x) * sx, (nearest.y - p.y) * sy) < 40
        ? nearest
        : { ...p, label: "cursor (not snapped to a curve)", graphIds: [] },
    );
  };
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
        aria-label="Cartesian graph. Drag to pan, use zoom buttons or scroll over the focused graph to zoom. Arrow keys pan."
        tabIndex={0}
        onKeyDown={(e) => {
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
          drag.current = { x: e.clientX, y: e.clientY, view, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
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
          keyboard-accessible coordinates.
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
      </svg>
      <p className="graph-hint">
        Drag to pan · focus graph to scroll-zoom · click a curve for coordinates
      </p>
      {notice && (
        <p className="calc-error" role="status">
          {notice}
        </p>
      )}
      {selected && (
        <output className="graph-coordinate">
          ≈ ({fmt(selected.x)}, {fmt(selected.y)}) · {selected.label}
        </output>
      )}
      {inspect && (
        <div className="interest-list" aria-label="Points of interest">
          <p className="small muted">
            Numerical points in this window; not an exhaustive symbolic
            solution.
          </p>
          {special.length ? (
            special.map((p, i) => (
              <button key={i} onClick={() => setSelected(p)}>
                {p.label} ≈ ({fmt(p.x)}, {fmt(p.y)})
              </button>
            ))
          ) : (
            <p className="small muted">
              No isolated points found in this window. Implicit curves do not
              have automatic points of interest.
            </p>
          )}
        </div>
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
