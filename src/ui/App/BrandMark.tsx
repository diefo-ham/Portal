import { useId } from "react";
import { MARK_PATH, TILE_PATH } from "./mark";

/** The sparkles cut out of a tile lit from its top-left corner (see mark.ts). */
export const BrandMark = ({ className = "" }: { className?: string }) => {
  // Each drawing needs its own gradient id, in case two are on the page.
  const gradient = useId();
  return (
    <svg className={className} viewBox="0 0 512 512" aria-hidden="true">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className="brand-tile-light" />
          <stop offset="1" className="brand-tile-deep" />
        </linearGradient>
      </defs>
      <path
        fillRule="evenodd"
        fill={`url(#${gradient})`}
        d={TILE_PATH + MARK_PATH}
      />
    </svg>
  );
};
