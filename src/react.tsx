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

// useLayoutEffect warns when rendered on the server; measurement can only
// happen in a browser anyway, so fall back to useEffect there.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export interface UseCutoutResult<
  Content extends HTMLElement = HTMLElement,
  Overlay extends HTMLElement = HTMLElement,
> {
  /** Attach to the element the cutout is carved out of. */
  contentRef: RefObject<Content | null>;
  /** Attach to the element whose silhouette is cut out. */
  overlayRef: RefObject<Overlay | null>;
  /**
   * Recompute the mask after changes ResizeObserver and re-renders can't
   * see (e.g. same-size content swaps done outside React).
   */
  update: () => void;
}

/**
 * Headless variant of `<Cutout>`: wire the refs to elements you own and the
 * hook inserts no DOM at all, so layout is untouched by construction. Both
 * refs must be attached during the first commit; the mask then follows
 * re-renders and size changes automatically.
 */
export const useCutout = <
  Content extends HTMLElement = HTMLElement,
  Overlay extends HTMLElement = HTMLElement,
>({ gap, shape }: CutoutOptions = {}): UseCutoutResult<Content, Overlay> => {
  const contentRef = useRef<Content>(null);
  const overlayRef = useRef<Overlay>(null);
  const instanceRef = useRef<CutoutInstance | null>(null);
  // One instance for the element's lifetime: the core reads options live on
  // every update, and swapping masks on an existing instance keeps the
  // previous mask applied while the new image decodes (Safari otherwise
  // blinks the children out on every option change). Recreating the
  // instance would clear the mask in between.
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

  // Recompute before every paint — catches overlay/content DOM changes and
  // gap/shape prop changes (read live from optionsRef) without needing
  // dependencies. The core's style comparison makes unchanged geometry a
  // no-op.
  useIsomorphicLayoutEffect(() => {
    instanceRef.current?.update();
  });

  const update = useCallback(() => instanceRef.current?.update(), []);

  return { contentRef, overlayRef, update };
};

export interface CutoutProps {
  /**
   * Overlay content whose silhouette is cut out of the child. Rendered in a
   * layer covering exactly the child's box; position it within that layer
   * (e.g. `position: 'absolute'`). Nullish/false renders the child
   * unmasked.
   */
  overlay?: ReactNode;
  /**
   * The single element the cutout is carved out of. `<Cutout>` inserts no
   * box around it — the element is cloned with a merged ref and masked
   * directly, so wrapping it never changes how it lays out. On React 18 a
   * custom component child must forward its ref to a DOM element.
   */
  children: ReactElement<{ ref?: Ref<HTMLElement> }>;
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

// React 19 exposes an element's ref as a normal prop; React 18 stores it on
// the element and poisons the prop with a dev warning getter. Probe for the
// warning getters so neither version logs.
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
 * Renders the child itself (cloned, no wrapper) plus one absolutely
 * positioned sibling layer for the overlay — out-of-flow, so the component
 * never affects how the child lays out. The layer covers exactly the
 * child's box via CSS anchor positioning (Baseline 2026). The anchor rules
 * live in a rendered `<style>` element rather than inline styles, so
 * engines drop what they can't parse (leaving the `inset: 0` base — the
 * layer stretches the nearest positioned ancestor, like a hand-positioned
 * badge) and the OddBird polyfill can read them (`style.setProperty` values
 * never reach the stylesheet text on engines that can't parse them).
 */
export const Cutout: FunctionComponent<CutoutProps> = ({ overlay, children, gap, shape }) => {
  const child = Children.only(children);
  const { contentRef, overlayRef } = useCutout({ gap, shape });
  // useId's colons aren't valid in a <dashed-ident> or an attribute selector.
  const id = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const anchorName = `--dom-cutout-${id}`;

  // In the layer rule, `inset: 0` is the base and the anchor() declarations
  // are the upgrade — CSS error handling does the branching. Engines without
  // anchor positioning drop the anchor() declarations at parse time and keep
  // inset: 0; engines with it override top/left/width/height, and the
  // leftover right/bottom: 0 lose to over-constrained absolute positioning.
  const css =
    `[data-cutout-anchor="${id}"]{anchor-name:${anchorName}}` +
    `[data-cutout-layer="${id}"]{inset:0;` +
    `top:anchor(${anchorName} top);left:anchor(${anchorName} left);` +
    `width:anchor-size(${anchorName} width);height:anchor-size(${anchorName} height)}`;

  // The data attribute is also set through the ref: cloneElement only
  // delivers it when a custom component spreads unknown props to its root,
  // while the ref contract is just "forwards to a DOM element".
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
        // Prop AND ref stamping: the prop reaches the server-rendered HTML
        // (no unanchored first paint) whenever the child passes it through.
        "data-cutout-anchor": id,
      } as Partial<unknown>)}
      {/* pointerEvents none keeps the layer from swallowing clicks aimed at
          the child; interactive overlay content re-enables with its own
          pointerEvents: 'auto'. Geometry comes from the <style> rules. */}
      <div
        ref={overlayRef as RefObject<HTMLDivElement | null>}
        data-cutout-overlay=""
        data-cutout-layer={id}
        style={{ position: "absolute", pointerEvents: "none" }}
      >
        {overlay}
      </div>
    </>
  );
};
