import {
  navigateToApp,
  loginAsSuperAdmin,
} from './test-utils';

describe('Alarms Page Tests', () => {
  const baseUrl = `http://localhost:${process.env.NEEMS_REACT_PORT || '5173'}`;

  it('should navigate to start page and log in', async () => {
    await navigateToApp(page);
    await loginAsSuperAdmin(page);
  });

  it('should load the Alarms page', async () => {
    await page.goto(`${baseUrl}/alarms`);
    // Either the alarms heading appears, or the initial loading spinner does.
    await page.waitForFunction(
      () => document.body.innerText.includes('Alarms'),
      { timeout: 10000 }
    );
    expect(await page.url()).toContain('/alarms');
  });

  it('should render all four severity filter chips', async () => {
    // After data loads, the severity summary chips appear.
    await page.waitForFunction(
      () => {
        const text = document.body.innerText;
        return text.includes('Emergency') && text.includes('Critical') && text.includes('Warning') && text.includes('Info');
      },
      { timeout: 15000 }
    );

    const chipLabels = await page.$$eval('.MuiChip-label', els =>
      els.map(el => el.textContent || '')
    );
    expect(chipLabels.some(l => /Emergency/.test(l))).toBe(true);
    expect(chipLabels.some(l => /Critical/.test(l))).toBe(true);
    expect(chipLabels.some(l => /Warning/.test(l))).toBe(true);
    expect(chipLabels.some(l => /Info/.test(l))).toBe(true);
  });

  it('should toggle a severity filter when a chip is clicked', async () => {
    // Find and click the "Critical" chip.
    const clicked = await page.evaluate(() => {
      const chips = Array.from(document.querySelectorAll('.MuiChip-clickable')) as HTMLElement[];
      const critical = chips.find(c => /Critical/.test(c.textContent || ''));
      if (critical) {
        critical.click();
        return true;
      }
      return false;
    });
    expect(clicked).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 500));

    // After toggling, a "Clear filters" chip appears.
    const hasClearFilters = await page.evaluate(() => {
      return document.body.innerText.includes('Clear filters');
    });
    expect(hasClearFilters).toBe(true);

    // Toggle "Critical" again to untoggle and clear the filter.
    await page.evaluate(() => {
      const chips = Array.from(document.querySelectorAll('.MuiChip-clickable')) as HTMLElement[];
      const critical = chips.find(c => /Critical/.test(c.textContent || ''));
      critical?.click();
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    const stillHasClearFilters = await page.evaluate(() => document.body.innerText.includes('Clear filters'));
    expect(stillHasClearFilters).toBe(false);
  });

  it('should expose the Filter by Zone dropdown', async () => {
    const zoneLabel = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      return labels.some(l => /Filter by Zone/.test(l.textContent || ''));
    });
    expect(zoneLabel).toBe(true);
  });

  it('should refresh data when the refresh button is clicked', async () => {
    const refreshButton = await page.$('button[title="Refresh"]');
    expect(refreshButton).not.toBeNull();
    await refreshButton!.click();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // After refresh, the "Updated <time>" indicator should be present.
    const hasUpdated = await page.evaluate(() => {
      return /Updated /.test(document.body.innerText);
    });
    expect(hasUpdated).toBe(true);
  });
});
