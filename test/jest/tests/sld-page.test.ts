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
    // Wait for the diagram to mount and the EStopButton group to appear.
    await page.waitForFunction(
      () => {
        const groups = Array.from(document.querySelectorAll('g')) as SVGGElement[];
        return groups.some(g => {
          const children = Array.from(g.children);
          const hasEStopText = children.some(c => c.tagName.toLowerCase() === 'text' && c.textContent === 'E-STOP');
          const hasBigCircle = children.some(c => c.tagName.toLowerCase() === 'circle' && c.getAttribute('r') === '44');
          return hasEStopText && hasBigCircle;
        });
      },
      { timeout: 5000 }
    );
  });

  it('should open the E-Stop confirmation dialog when clicked', async () => {
    // Find the EStopButton g (one with E-STOP text and r=44 circle as direct children)
    // and click via mouse coordinates from its bounding box.
    const rect = await page.evaluate(() => {
      const groups = Array.from(document.querySelectorAll('g')) as SVGGElement[];
      const target = groups.find(g => {
        const children = Array.from(g.children);
        const hasEStopText = children.some(c => c.tagName.toLowerCase() === 'text' && c.textContent === 'E-STOP');
        const hasBigCircle = children.some(c => c.tagName.toLowerCase() === 'circle' && c.getAttribute('r') === '44');
        return hasEStopText && hasBigCircle;
      });
      if (!target) return null;
      const r = target.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    expect(rect).not.toBeNull();

    await page.mouse.click(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2);
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    const dialogText = await page.$eval('[role="dialog"]', el => el.textContent || '');
    expect(dialogText).toMatch(/Confirm E-Stop/i);
  });

  it('should dismiss the E-Stop dialog via Cancel without arming E-Stop', async () => {
    const cancelButton = await findButtonByText(page, ['Cancel']);
    expect(await cancelButton.evaluate((el: any) => !!el)).toBe(true);
    await cancelButton.click();
    await new Promise(resolve => setTimeout(resolve, 500));

    const dialog = await page.$('[role="dialog"]');
    expect(dialog).toBeNull();

    // Confirm we did not arm E-Stop: the page should NOT show the active banner.
    const content = await page.content();
    expect(content).not.toContain('E-Stop is active.');
  });
});
