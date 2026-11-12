import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
// Automated checks are scoped gates, not a full human accessibility audit.
for (const route of ["/#/projects", "/#/tabular", "/#/settings", "/#/media", "/#/custom", "/#/peer"]) {
  test(`keyboard landmarks and serious/critical axe violations: ${route}`, async ({
    page,
  }) => {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }),
    ).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Skip to workspace" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      ),
    ).toEqual([]);
  });
}
test("mobile studio and settings have no document-level horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/#/projects", "/#/tabular", "/#/settings", "/#/media", "/#/custom", "/#/peer"]) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
