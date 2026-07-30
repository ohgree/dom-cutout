import { createCutout } from "dom-cutout";

// Box A: the library's real code path (data-URI image mask).
const overlay = document.getElementById("overlay-a")!;
createCutout(document.getElementById("content-a")!, overlay, { gap: 4 });
overlay.style.visibility = "";

// Box B is masked declaratively in the HTML via `mask: url(#refmask)` —
// no JS involved, by design: it demonstrates the reference-mask approach.
