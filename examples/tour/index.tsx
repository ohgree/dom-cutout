import { domAnimation, LazyMotion } from "motion/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { Tour } from "./Tour";

// React island inside the otherwise-vanilla landing: everything above the
// tour stays plain DOM, so the zero-dependency story is still told by the
// page itself; the tour dogfoods the React adapter.
export const mountTour = (el: HTMLElement) => {
  createRoot(el).render(
    <StrictMode>
      <LazyMotion features={domAnimation} strict>
        <Tour />
      </LazyMotion>
    </StrictMode>,
  );
};
