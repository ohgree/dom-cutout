import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";

// Each test pins a WebKit failure mode discovered during development — the
// full story lives in docs/webkit-masking.md. The fixture mounts a red
// content square with a centered square badge cut out of it (box shape),
// over a blue page background.

const rgbAt = (shot: PNG, deviceX: number, deviceY: number) => {
  const i = (Math.round(deviceY) * shot.width + Math.round(deviceX)) * 4;
  return [shot.data[i], shot.data[i + 1], shot.data[i + 2]] as const;
};
const isRed = ([r, g, b]: readonly number[]) => r > 230 && g < 25 && b < 25;
const isBlue = ([r, , b]: readonly number[]) => b > 150 && r < 120;

const shoot = async (page: import("@playwright/test").Page) => {
  await page.waitForTimeout(200);
  return PNG.sync.read(await page.screenshot());
};

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => typeof window.mount === "function");
});

test.describe("cutout renders", () => {
  test("hole is cut out and content is marked", async ({ page }) => {
    await page.evaluate(() => window.mount({ size: 100, dot: 40 }));
    const shot = await shoot(page);
    const dsf = test.info().project.use.deviceScaleFactor ?? 1;
    // hole center shows page background; content body stays painted
    expect(isBlue(rgbAt(shot, 50 * dsf, 50 * dsf))).toBe(true);
    expect(isRed(rgbAt(shot, 10 * dsf, 10 * dsf))).toBe(true);
    await expect(page.locator("#content")).toHaveAttribute("data-cutout", "");
  });
});

test.describe("edge crispness @2x", () => {
  // Guards the internal-<mask> regression: WebKit rasterizes mask images
  // containing internal <mask> elements at CSS-pixel resolution, which
  // measured as 2-3 blend px on this exact scanline. The composite
  // construction measures 0-1.
  test.use({ deviceScaleFactor: 2 });

  test("left hole edge blends within 1 device px", async ({ page }) => {
    await page.evaluate(() => window.mount({ size: 100, dot: 40, gap: 4 }));
    const shot = await shoot(page);
    // Hole spans css 26..74 (dot 30..70 + gap 4). Scan y=50 across the
    // left edge at x 16..36: red -> blue transition at 26.
    let blend = 0;
    for (let x = 16 * 2; x <= 36 * 2; x++) {
      const px = rgbAt(shot, x, 50 * 2);
      if (!isRed(px) && !isBlue(px)) blend++;
    }
    expect(blend).toBeLessThanOrEqual(1);
  });
});

test.describe("pattern-tile budget (WebKit bug 282530 class)", () => {
  // Guards mask survival on large elements: luminance masks silently stop
  // masking past 2048x2048 device px on desktop WebKit (512x512 on iOS).
  // 800css @ DSF3 = 2400^2 device px, past the desktop budget.
  test.use({ deviceScaleFactor: 3, viewport: { width: 900, height: 900 } });

  test("mask still applies far past the budget", async ({ page }) => {
    await page.evaluate(() => window.mount({ size: 800, dot: 120 }));
    const shot = await shoot(page);
    expect(isBlue(rgbAt(shot, 400 * 3, 400 * 3))).toBe(true);
    expect(isRed(rgbAt(shot, 100 * 3, 100 * 3))).toBe(true);
  });
});

test.describe("fractional-scale seams", () => {
  // Guards the tiled-canvas regression: repeated mask tiles seam into a
  // visible grid at fractional effective scales (8 dips per scanline when
  // it regressed). The gradient canvas must scan perfectly solid.
  test.use({ deviceScaleFactor: 3, viewport: { width: 700, height: 700 } });

  test("content body is seam-free under fractional scale", async ({ page }) => {
    await page.evaluate(() => window.mount({ size: 400, dot: 80, wrapperScale: 1.37 }));
    const shot = await shoot(page);
    // y=60css is well above the hole (which starts at css 156); the whole
    // scan must be solid red.
    let dips = 0;
    for (let cssX = 10; cssX < 390; cssX++) {
      if (!isRed(rgbAt(shot, cssX * 1.37 * 3, 60 * 1.37 * 3))) dips++;
    }
    expect(dips).toBe(0);
  });
});

test.describe("mask structure contract", () => {
  // The constraints that make the construction safe, asserted directly on
  // the computed style so a refactor can't silently reintroduce them.
  test("no internal <mask>, no mask-mode, no repeated tiles", async ({ page }) => {
    await page.evaluate(() => window.mount({ size: 100, dot: 40 }));
    const style = await page.evaluate(() => {
      const el = document.getElementById("content")!;
      const cs = getComputedStyle(el);
      return {
        image: cs.maskImage,
        composite: cs.maskComposite,
        repeat: cs.maskRepeat,
        mode: cs.maskMode,
      };
    });
    expect(decodeURIComponent(style.image)).not.toContain("<mask");
    expect(style.image).toContain("linear-gradient");
    expect(style.composite).toContain("subtract");
    expect(style.repeat).not.toMatch(/(^| )repeat/);
    expect(style.mode).not.toContain("luminance");
  });
});
