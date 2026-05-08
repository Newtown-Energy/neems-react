/**
 * Sidebar navigation tests.
 *
 * Verifies the NEEMS logo link, the Admin Panel sidebar item, and the
 * primary nav items route to their expected paths. The legacy
 * UserProfile dropdown was consolidated into the sidebar (commit 934d7c9).
 */
import {
  navigateToApp,
  loginAsSuperAdmin,
} from './test-utils';

const baseUrl = `http://localhost:${process.env.NEEMS_REACT_PORT || '5173'}`;

describe('NEEMS Navigation Tests', () => {
  beforeEach(async () => {
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
    await client.send('Network.clearBrowserCache');
    await client.detach();
    // Sidebar auto-collapses below 900px wide; expanded sidebar exposes labels.
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(baseUrl);
  });

  it('should expose a NEEMS logo link to the root path', async () => {
    await loginAsSuperAdmin(page);
    await page.waitForSelector('#authed-ui-box', { timeout: 10000 });

    // The logo link wraps a logo image and the "NEEMS" wordmark.
    const href = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href="/"]'));
      const neems = links.find(a => /NEEMS/.test(a.textContent || ''));
      return neems?.getAttribute('href') || null;
    });
    expect(href).toBe('/');
  });

  it('should navigate to /admin via the Admin Panel sidebar item', async () => {
    // Start somewhere other than admin.
    await page.goto(`${baseUrl}/scheduler`);
    await loginAsSuperAdmin(page);
    await page.waitForFunction(
      () => document.body.innerText.includes('Schedule Calendar'),
      { timeout: 10000 }
    );

    const clicked = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('.MuiListItemText-primary'));
      const adminLabel = labels.find(el => el.textContent === 'Admin Panel');
      const button = adminLabel?.closest('[role="button"]') as HTMLElement | null;
      if (button) {
        button.click();
        return true;
      }
      return false;
    });
    expect(clicked).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    expect(await page.url()).toContain('/admin');
  });

  it('should navigate via the primary sidebar items', async () => {
    await loginAsSuperAdmin(page);
    await page.waitForSelector('#authed-ui-box', { timeout: 10000 });

    // Click the "Schedule" sidebar item.
    const schedulerClicked = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('.MuiListItemText-primary'));
      const label = labels.find(el => el.textContent === 'Schedule');
      const button = label?.closest('[role="button"]') as HTMLElement | null;
      if (button) {
        button.click();
        return true;
      }
      return false;
    });
    expect(schedulerClicked).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    expect(await page.url()).toContain('/scheduler');

    // Then click "Single Line".
    const sldClicked = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('.MuiListItemText-primary'));
      const label = labels.find(el => el.textContent === 'Single Line');
      const button = label?.closest('[role="button"]') as HTMLElement | null;
      if (button) {
        button.click();
        return true;
      }
      return false;
    });
    expect(sldClicked).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    expect(await page.url()).toContain('/sld');
  });
});
