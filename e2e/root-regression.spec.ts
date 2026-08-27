// Root-route regression (eng-review decision 1A, CRITICAL).
// Tereza's canonical galaxy must stay behaviorally identical through the
// GalaxyView extraction and everything that follows. If this fails, the gift
// broke — fix the regression, never the test.
import { test, expect } from "@playwright/test";

test.describe("root route — Tereza's galaxy", () => {
  test("intro appears, then fades away", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Tereza Slančíková", { exact: true })).toBeVisible();
    await expect(page.getByText("the shape of a mind, mapped in space")).toBeVisible();
    // 4.2s timer + 1.8s fade — gone by 8s
    await expect(page.getByText("the shape of a mind, mapped in space")).toBeHidden({ timeout: 8000 });
  });

  test("canvas renders and the persistent corner credit stays", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible();
    await expect(page.getByText("stare.na · tereza slančíková")).toBeVisible();
    // still there after the intro is long gone
    await page.waitForTimeout(6000);
    await expect(page.getByText("stare.na · tereza slančíková")).toBeVisible();
  });

  test("search → select → panel → ← Galaxy → Escape flow", async ({ page }) => {
    await page.goto("/");
    const input = page.getByPlaceholder("Search the galaxy…");
    await expect(input).toBeVisible();

    await input.fill("arch");
    // word-start ranking (FINDING-005): 'pillars, arches…' outranks 'research' matches
    const firstResult = page.locator("button", { hasText: "pillars, arches" }).first();
    await expect(firstResult).toBeVisible();
    await input.press("Enter");

    // SidePanel opens with the channel
    await expect(page.getByText("Channel", { exact: true })).toBeVisible();
    await expect(page.locator("h2")).toContainText("pillars, arches");
    await expect(page.getByText("Nearby", { exact: true })).toBeVisible();

    // universal Are.na link (FINDING 4A precondition: link exists and points at are.na)
    const arenaLink = page.locator('a[href*="are.na"]').last();
    await expect(arenaLink).toBeVisible();

    // overview button appears while zoomed in
    const galaxyBtn = page.getByRole("button", { name: /return to galaxy overview/i });
    await expect(galaxyBtn).toBeVisible();

    // Escape closes the panel (FINDING-010). Escape INSIDE the search input
    // clears the query instead (by design) — blur first, as a star-clicking
    // user's focus would be.
    await input.blur();
    await page.keyboard.press("Escape");
    await expect(page.getByText("Nearby", { exact: true })).toBeHidden();

    // selecting again and using the ← Galaxy button also works
    await input.fill("plantae");
    await input.press("Enter");
    await expect(page.getByText("Nearby", { exact: true })).toBeVisible();
    await galaxyBtn.click();
    await expect(page.getByText("Nearby", { exact: true })).toBeHidden();
  });

  test("no console errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      // GPU/driver noise from headless WebGL is environmental, not app errors
      if (msg.type() === "error" && !/WebGL|GPU|swiftshader/i.test(msg.text())) {
        errors.push(msg.text());
      }
    });
    await page.goto("/");
    await page.waitForTimeout(5000);
    expect(errors).toEqual([]);
  });
});
