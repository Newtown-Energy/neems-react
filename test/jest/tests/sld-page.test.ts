import {
  navigateToApp,
  loginAsSuperAdmin,
  findButtonByText,
} from './test-utils';

describe('SLD Page Tests', () => {
  const baseUrl = `http://localhost:${process.env.NEEMS_REACT_PORT || '5173'}`;

  it('should navigate to start page and log in', async () => {
    // A larger viewport ensures the diagram lays out at a clickable size.
    await page.setViewport({ width: 1600, height: 1200 });
    await navigateToApp(page);
    await loginAsSuperAdmin(page);
  });

  it('should land on the SLD page when navigating to root', async () => {
    await page.goto(`${baseUrl}/`);
    await page.waitForFunction(
      () => document.body.innerText.includes('Single Line'),
      { timeout: 20000 }
    );
    expect(await page.url()).toContain('/sld');
  }, 30000);

  it('should render the project info card', async () => {
    const content = await page.content();
    expect(content).toContain('Project Info: Demo BESS 1A');
    expect(content).toContain('Address');
    expect(content).toContain('BESS Rating');
  });

  it('should render the legend chips', async () => {
    const chipLabels = await page.$$eval('.MuiChip-label', els =>
      els.map(el => el.textContent || '')
    );
    expect(chipLabels).toContain('Normal');
    expect(chipLabels).toContain('Warning');
    expect(chipLabels).toContain('Critical');
    expect(chipLabels).toContain('Emergency');
  });

  it('should render the E-Stop button inside the diagram', async () => {
    await page.waitForSelector('[data-testid="sld-estop-button"]', { timeout: 5000 });
  });

  it('should render the E-Stop button as idle when the site is not tripped', async () => {
    // The button reports what the site reports. With no E-stop alarm active it
    // must be actionable rather than showing a trip the RTAC never reported.
    const state = await page.$eval(
      '[data-testid="sld-estop-button"]',
      el => el.getAttribute('data-estop-state')
    );
    expect(state).toBe('idle');
  });

  it('should open the E-Stop confirmation dialog when clicked', async () => {
    const rect = await page.evaluate(() => {
      const target = document.querySelector('[data-testid="sld-estop-button"]');
      if (!target) return null;
      const r = target.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    expect(rect).not.toBeNull();

    await page.mouse.click(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2);
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    const dialogText = await page.$eval('[role="dialog"]', el => el.textContent || '');
    // Engage-only: the dialog asks for a trip and says so, and tells the
    // operator this is not how an E-stop gets cleared.
    expect(dialogText).toMatch(/Request E-Stop/i);
    expect(dialogText).toMatch(/reset at the panel/i);
  });

  it('should dismiss the E-Stop dialog via Cancel without requesting an E-Stop', async () => {
    const cancelButton = await findButtonByText(page, ['Cancel']);
    expect(await cancelButton.evaluate((el: any) => !!el)).toBe(true);
    await cancelButton.click();
    await new Promise(resolve => setTimeout(resolve, 500));

    const dialog = await page.$('[role="dialog"]');
    expect(dialog).toBeNull();

    // Neither a trip nor a request should have been recorded.
    const content = await page.content();
    expect(content).not.toContain('E-Stop is active.');
    expect(content).not.toContain('E-Stop requested');

    const state = await page.$eval(
      '[data-testid="sld-estop-button"]',
      el => el.getAttribute('data-estop-state')
    );
    expect(state).toBe('idle');
  });
});
