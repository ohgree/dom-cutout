import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";

import { createCutout, type CutoutInstance, type CutoutShape } from "./core";

export interface CutoutProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Overlay content whose silhouette is cut out of `children`. Rendered on
   * top of `children`; position it within the overlay layer (e.g.
   * `position: 'absolute'`). Nullish/false renders `children` unmasked.
   */
  overlay?: ReactNode;
  /** Content the cutout is carved out of. */
  children?: ReactNode;
  /**
   * Gap width in rendered pixels between the overlay's silhouette and
   * `children`.
   * @default 2
   */
  gap?: number;
  /**
   * How the overlay's silhouette is traced — see `CutoutOptions['shape']`.
   * @default 'auto'
   */
  shape?: CutoutShape;
}

// useLayoutEffect warns when rendered on the server; measurement can only
// happen in a browser anyway, so fall back to useEffect there.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export const Cutout = forwardRef<HTMLDivElement, CutoutProps>(
  ({ overlay, children, gap = 2, shape = "auto", style, ...divProps }, ref) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<CutoutInstance | null>(null);

    useIsomorphicLayoutEffect(() => {
      const content = contentRef.current;
      const overlayEl = overlayRef.current;
      if (!content || !overlayEl) return undefined;

      const instance = createCutout(content, overlayEl, { gap, shape });
      instanceRef.current = instance;
      return () => {
        instanceRef.current = null;
        instance.destroy();
      };
    }, [gap, shape]);

    // Recompute before every paint — catches `overlay`/`children` DOM changes
    // without needing them (new references each render) as dependencies. The
    // core's mask-url comparison makes unchanged geometry a no-op.
    useIsomorphicLayoutEffect(() => {
      instanceRef.current?.update();
    });

    return (
      <div ref={ref} style={{ display: "inline-grid", ...style }} {...divProps}>
        <div ref={contentRef} data-cutout-content="" style={{ gridArea: "1 / 1", display: "flex" }}>
          {children}
        </div>
        <div
          ref={overlayRef}
          data-cutout-overlay=""
          style={{ gridArea: "1 / 1", position: "relative" }}
        >
          {overlay}
        </div>
      </div>
    );
  },
);

Cutout.displayName = "Cutout";
