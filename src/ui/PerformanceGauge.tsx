import type { ReactNode } from "react";

export type PerformanceGaugeProps = {
  value?: number;
  displayValue?: string;
  label: string;
  ariaLabel: string;
  detail?: ReactNode;
  footer?: ReactNode;
};

export const PerformanceGauge = ({
  value,
  displayValue,
  label,
  ariaLabel,
  detail,
  footer,
}: PerformanceGaugeProps) => {
  const clamped = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="performance-gauge" aria-live="polite">
      <p className="gauge-label">{label}</p>
      <div className="gauge-visual" role="img" aria-label={ariaLabel}>
        <svg viewBox="0 0 200 108" aria-hidden="true">
          {value === undefined ? (
            <path className="gauge-empty" d="M18 100 A82 82 0 0 1 182 100" />
          ) : (
            <>
              {clamped < 100 && (
                <path
                  className="gauge-incorrect"
                  d="M18 100 A82 82 0 0 1 182 100"
                  pathLength="100"
                  strokeDasharray={`${100 - clamped} ${clamped}`}
                  strokeDashoffset={-clamped}
                />
              )}
              {clamped > 0 && (
                <path
                  className="gauge-correct"
                  d="M18 100 A82 82 0 0 1 182 100"
                  pathLength="100"
                  strokeDasharray={`${clamped} ${100 - clamped}`}
                />
              )}
            </>
          )}
        </svg>
        <div className="gauge-reading">
          {value === undefined ? (
            <strong className="no-attempts">No attempts yet</strong>
          ) : (
            <>
              <strong>{displayValue ?? `${Math.round(clamped)}%`}</strong>
              {detail && <span>{detail}</span>}
            </>
          )}
        </div>
      </div>
      {footer}
    </div>
  );
};
