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
    await page.waitForSelector('[data-testid="sld-emergency-shutdown-button"]', { timeout: 20000 });
    expect(await page.url()).toContain('/sld');
  }, 30000);

  it('should not render a page heading above the diagram', async () => {
    const headings = await page.$$eval('h1, h2, h3', els =>
      els.map(el => el.textContent || '')
    );
    expect(headings).not.toContain('Single Line');
  });

  it('should render the project info inside the diagram', async () => {
    const diagramText = await page.$$eval('svg text', els =>
      els.map(el => el.textContent || '')
    );
    expect(diagramText).toContain('Demo BESS 1A');
    expect(diagramText).toContain('Address');
    expect(diagramText).toContain('BESS Rating');
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

  it('should render the Emergency Shutdown button inside the diagram', async () => {
    await page.waitForSelector('[data-testid="sld-emergency-shutdown-button"]', { timeout: 5000 });
    const text = await page.$eval(
      '[data-testid="sld-emergency-shutdown-button"]',
      el => el.textContent || ''
    );
    expect(text).toContain('EMERGENCY');
    expect(text).toContain('SHUTDOWN');
  });

  it('should render the Emergency Shutdown button as idle when the site is not tripped', async () => {
    // With no E-stop alarm active the button must be actionable rather than
    // showing a trip the RTAC never reported.
    const state = await page.$eval(
      '[data-testid="sld-emergency-shutdown-button"]',
      el => el.getAttribute('data-shutdown-state')
    );
    expect(state).toBe('idle');
  });

  it('should render the E-stop indicator as not tripped', async () => {
    // Read-only, and driven by alarm 104 alone. `unknown` is allowed: a dev
    // server with no site data has told us nothing about the E-stop.
    const state = await page.$eval(
      '[data-testid="sld-estop-indicator"]',
      el => el.getAttribute('data-estop-state')
    );
    expect(['normal', 'unknown']).toContain(state);
  });

  it('should open the Emergency Shutdown confirmation dialog when clicked', async () => {
    const rect = await page.evaluate(() => {
      const target = document.querySelector('[data-testid="sld-emergency-shutdown-button"]');
      if (!target) return null;
      const r = target.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    expect(rect).not.toBeNull();

    await page.mouse.click(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2);
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    const dialogText = await page.$eval('[role="dialog"]', el => el.textContent || '');
    // Engage-only: the dialog asks for a shutdown and says so, and tells the
    // operator this is not how a trip gets cleared.
    expect(dialogText).toMatch(/Request Emergency Shutdown/i);
    expect(dialogText).toMatch(/reset at\s+the panel/i);
  });

  it('should dismiss the Emergency Shutdown dialog via Cancel without requesting one', async () => {
    const cancelButton = await findButtonByText(page, ['Cancel']);
    expect(await cancelButton.evaluate((el: any) => !!el)).toBe(true);
    await cancelButton.click();
    await new Promise(resolve => setTimeout(resolve, 500));

    const dialog = await page.$('[role="dialog"]');
    expect(dialog).toBeNull();

    // Neither a trip nor a request should have been recorded.
    const content = await page.content();
    expect(content).not.toContain('E-Stop is active.');
    expect(content).not.toContain('Emergency shutdown requested');

    const state = await page.$eval(
      '[data-testid="sld-emergency-shutdown-button"]',
      el => el.getAttribute('data-shutdown-state')
    );
    expect(state).toBe('idle');
  });
});
