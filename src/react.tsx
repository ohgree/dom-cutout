import {
  forwardRef,
  type FunctionComponent,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";

import { createCutout, type CutoutInstance, type CutoutShape } from "./core";

export interface CutoutProps extends HTMLAttributes<HTMLDivElement> {
  /** Ref to the wrapper element stacking the two layers. */
  ref?: Ref<HTMLDivElement>;
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
   * @default 4 (DEFAULT_GAP)
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

// forwardRef is the runtime mechanism (required while React 18 is
// supported), but it pollutes the public signature with
// ForwardRefExoticComponent/RefAttributes noise — so `ref` is declared as a
// plain prop in CutoutProps and the export is typed as an ordinary function
// component. In React 19, ref-as-prop is the native behavior anyway.
const CutoutImpl = forwardRef<HTMLDivElement, CutoutProps>(
  // No local defaults for gap/shape: they pass through undefined so the
  // core's defaults are the single source of truth.
  ({ overlay, children, gap, shape, style, ...divProps }, ref) => {
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

CutoutImpl.displayName = "Cutout";

export const Cutout = CutoutImpl as FunctionComponent<CutoutProps>;
