import {
  Children,
  cloneElement,
  type FunctionComponent,
  type ReactElement,
  type ReactNode,
  type Ref,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
} from "react";

import { createCutout, type CutoutInstance, type CutoutOptions, type CutoutShape } from "./core";

// useLayoutEffect warns on the server; measurement needs a browser anyway.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export interface UseCutoutResult<
  Content extends HTMLElement = HTMLElement,
  Overlay extends HTMLElement = HTMLElement,
> {
  /** Ref for the element the cutout is carved out of. */
  contentRef: RefObject<Content | null>;
  /** Ref for the element whose silhouette is cut out. */
  overlayRef: RefObject<Overlay | null>;
  /** Recompute after changes ResizeObserver and re-renders can't see. */
  update: () => void;
}

/**
 * Headless `<Cutout>`: wire the refs to elements you own — the hook inserts
 * no DOM. Both refs must be attached during the first commit.
 *
 * @example
 * ```tsx
 * const { contentRef, overlayRef } = useCutout({ gap: 6 });
 * return (
 *   <div style={{ position: "relative" }}>
 *     <Card ref={contentRef} />
 *     <div ref={overlayRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
 *       <Badge style={{ position: "absolute", top: 0, right: 0 }} />
 *     </div>
 *   </div>
 * );
 * ```
 */
export const useCutout = <
  Content extends HTMLElement = HTMLElement,
  Overlay extends HTMLElement = HTMLElement,
>({ gap, shape }: CutoutOptions = {}): UseCutoutResult<Content, Overlay> => {
  const contentRef = useRef<Content>(null);
  const overlayRef = useRef<Overlay>(null);
  const instanceRef = useRef<CutoutInstance | null>(null);
  // One instance per element lifetime, options mutated live: recreating on
  // option change would clear the mask while the new image decodes, and
  // Safari blinks the children out in that window.
  const optionsRef = useRef<CutoutOptions>({});
  optionsRef.current.gap = gap;
  optionsRef.current.shape = shape;

  useIsomorphicLayoutEffect(() => {
    const content = contentRef.current;
    const overlay = overlayRef.current;
    if (!content || !overlay) return undefined;

    const instance = createCutout(content, overlay, optionsRef.current);
    instanceRef.current = instance;
    return () => {
      instanceRef.current = null;
      instance.destroy();
    };
  }, []);

  // Recompute before every paint; the core makes unchanged geometry a no-op.
  useIsomorphicLayoutEffect(() => {
    instanceRef.current?.update();
  });

  const update = useCallback(() => instanceRef.current?.update(), []);

  return { contentRef, overlayRef, update };
};

/** Props `<Cutout>` injects into its cloned child. */
interface InjectedChildProps {
  ref?: Ref<HTMLElement>;
  "data-cutout-anchor"?: string;
}

export interface CutoutProps {
  /**
   * Content whose silhouette is cut out of the child. Rendered in a layer
   * covering the child's box — position it there (e.g. `position: 'absolute'`).
   * Nullish/false leaves the child unmasked.
   */
  overlay?: ReactNode;
  /**
   * The single element the cutout is carved out of — cloned and masked
   * directly, never wrapped. Must take a ref to a DOM element (React 18
   * custom components: `forwardRef`).
   */
  children: ReactElement<InjectedChildProps>;
  /**
   * Gap width in rendered pixels between the overlay's silhouette and the
   * child.
   * @default 4 (DEFAULT_GAP)
   */
  gap?: number;
  /**
   * How the overlay's silhouette is traced — see `CutoutOptions['shape']`.
   * @default 'auto'
   */
  shape?: CutoutShape;
}

// React 19 keeps an element's ref in props, React 18 on the element — and
// each poisons the other spot with a dev-warning getter; probe so neither logs.
const getElementRef = (element: ReactElement): Ref<HTMLElement> | undefined => {
  const propsGetter = Object.getOwnPropertyDescriptor(element.props, "ref")?.get;
  if (propsGetter && "isReactWarning" in propsGetter) {
    return (element as unknown as { ref?: Ref<HTMLElement> }).ref;
  }
  const elementGetter = Object.getOwnPropertyDescriptor(element, "ref")?.get;
  if (elementGetter && "isReactWarning" in elementGetter) {
    return (element.props as { ref?: Ref<HTMLElement> }).ref;
  }
  return (
    (element.props as { ref?: Ref<HTMLElement> }).ref ??
    (element as unknown as { ref?: Ref<HTMLElement> }).ref
  );
};

const composeRefs =
  (...refs: Array<Ref<HTMLElement> | undefined>) =>
  (node: HTMLElement | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    }
  };

const supportsAnchor = () =>
  typeof CSS !== "undefined" && CSS.supports("anchor-name", "--dom-cutout-probe");

let warnedNoAnchor = false;

/**
 * Cut the overlay's silhouette out of the child element.
 *
 * Renders the child itself (no wrapper) plus one out-of-flow overlay layer
 * pinned to its box with CSS anchor positioning (Baseline 2026), so the
 * component never affects how the child lays out. Without anchor support
 * the layer stretches the nearest positioned ancestor instead — see the
 * README for the polyfill.
 *
 * @example
 * ```tsx
 * <Cutout gap={6} overlay={<StatusDot style={{ position: "absolute", bottom: 0, right: 0 }} />}>
 *   <Avatar />
 * </Cutout>
 * ```
 */
export const Cutout: FunctionComponent<CutoutProps> = ({ overlay, children, gap, shape }) => {
  const child = Children.only(children);
  const { contentRef, overlayRef } = useCutout({ gap, shape });
  // useId's colons aren't valid in a <dashed-ident> or an attribute selector.
  const id = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const anchorName = `--dom-cutout-${id}`;

  // A <style> element, not setProperty: setProperty drops what the engine
  // can't parse, and the polyfill reads stylesheet text. In the layer rule,
  // CSS error handling does the branching: engines without anchor() keep the
  // inset: 0 base; engines with it override top/left/width/height, and the
  // leftover right/bottom: 0 lose to over-constrained absolute positioning.
  const css =
    `[data-cutout-anchor="${id}"]{anchor-name:${anchorName}}` +
    `[data-cutout-layer="${id}"]{inset:0;` +
    `top:anchor(${anchorName} top);left:anchor(${anchorName} left);` +
    `width:anchor-size(${anchorName} width);height:anchor-size(${anchorName} height)}`;

  // The anchor attribute goes on as a cloned prop (reaches server-rendered
  // HTML) AND through the ref (covers custom children that forward a ref
  // but don't spread unknown props to their root).
  const stampAnchor = (node: HTMLElement | null) => {
    node?.setAttribute("data-cutout-anchor", id);
  };

  useIsomorphicLayoutEffect(() => {
    if (warnedNoAnchor || supportsAnchor()) return;
    warnedNoAnchor = true;
    console.warn(
      "dom-cutout: this browser has no CSS anchor positioning (Chrome 125+, Firefox 132+, Safari 26+), so the overlay layer stretches its nearest positioned ancestor instead of the content element. @oddbird/css-anchor-positioning polyfills it — run it after your app renders, and ignore this warning if you already do.",
    );
  }, []);

  return (
    <>
      <style>{css}</style>
      {cloneElement(child, {
        ref: composeRefs(getElementRef(child), contentRef, stampAnchor),
        "data-cutout-anchor": id,
      })}
      <div
        ref={overlayRef as RefObject<HTMLDivElement | null>}
        data-cutout-overlay=""
        data-cutout-layer={id}
        // pointerEvents: none so the layer doesn't swallow clicks aimed at the
        // child; interactive overlay content re-enables its own.
        style={{ position: "absolute", pointerEvents: "none" }}
      >
        {overlay}
      </div>
    </>
  );
};
