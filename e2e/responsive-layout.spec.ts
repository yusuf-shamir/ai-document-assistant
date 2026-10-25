import { expect, test } from '@playwright/test';

test('keeps the workspace and PDF citation dialog within resized viewports', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 900, height: 768 },
    { width: 681, height: 500 },
    { width: 390, height: 844 },
    { width: 320, height: 600 },
  ]) {
    await page.setViewportSize(viewport);
    const workspaceBounds = await page.locator('.app-shell').evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
    });
    const documentBounds = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    }));

    expect(documentBounds.width).toBeLessThanOrEqual(documentBounds.viewportWidth);
    expect(documentBounds.height).toBeLessThanOrEqual(documentBounds.viewportHeight);
    expect(workspaceBounds.left).toBeGreaterThanOrEqual(0);
    expect(workspaceBounds.top).toBeGreaterThanOrEqual(0);
    expect(workspaceBounds.right).toBeLessThanOrEqual(viewport.width + 1);
    expect(workspaceBounds.bottom).toBeLessThanOrEqual(viewport.height + 1);
    const composerBounds = await page.locator('.composer').evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { rightGap: window.innerWidth - rect.right, bottomGap: window.innerHeight - rect.bottom };
    });
    expect(composerBounds.rightGap).toBeGreaterThanOrEqual(12);
    expect(composerBounds.bottomGap).toBeGreaterThanOrEqual(15);

    await page.evaluate(() => window.dispatchEvent(new CustomEvent('clarity-open-citation', {
      detail: { documentId: 'missing-pdf', documentName: 'sample.pdf', page: 1 },
    })));
    const dialog = page.getByRole('dialog', { name: 'sample.pdf' });
    await expect(dialog).toBeVisible();
    const dialogBounds = await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    });
    expect(dialogBounds.left).toBeGreaterThanOrEqual(0);
    expect(dialogBounds.top).toBeGreaterThanOrEqual(0);
    expect(dialogBounds.right).toBeLessThanOrEqual(viewport.width + 1);
    expect(dialogBounds.bottom).toBeLessThanOrEqual(viewport.height + 1);
    await page.getByRole('button', { name: 'Close PDF viewer' }).click();
  }
});
