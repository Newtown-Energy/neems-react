/**
 * User profile / sidebar identity tests.
 *
 * The standalone UserProfile dropdown was consolidated into the sidebar
 * (commit 934d7c9). The user's email is rendered inline in the sidebar header,
 * Admin Panel and Logout are sidebar list items at the bottom.
 */
import {
  navigateToApp,
  loginAsSuperAdmin,
} from './test-utils';

const baseUrl = `http://localhost:${process.env.NEEMS_REACT_PORT || '5173'}`;

describe('Sidebar User Identity Tests', () => {
  beforeEach(async () => {
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
    await client.send('Network.clearBrowserCache');
    await client.detach();
    // Sidebar auto-collapses below 900px wide and hides email + item labels.
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(baseUrl);
  });

  it('should display the logged-in user email in the sidebar', async () => {
    await loginAsSuperAdmin(page);

    // Sidebar shows the user's email under the NEEMS header.
    await page.waitForFunction(
      () => document.body.innerText.includes('superadmin@example.com'),
      { timeout: 10000 }
    );
  });

  it('should expose an Admin Panel sidebar item for super admins', async () => {
    await loginAsSuperAdmin(page);
    await page.waitForSelector('#authed-ui-box', { timeout: 10000 });

    const adminItemPresent = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.MuiListItemText-primary'));
      return items.some(el => el.textContent === 'Admin Panel');
    });
    expect(adminItemPresent).toBe(true);
  });

  it('should log out via the sidebar Logout item', async () => {
    await loginAsSuperAdmin(page);
    await page.waitForSelector('#authed-ui-box', { timeout: 10000 });

    // Click the Logout sidebar item by matching its text.
    const clicked = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('.MuiListItemText-primary'));
      const logoutLabel = labels.find(el => el.textContent === 'Logout');
      const button = logoutLabel?.closest('[role="button"]') as HTMLElement | null;
      if (button) {
        button.click();
        return true;
      }
      return false;
    });
    expect(clicked).toBe(true);

    // Logout reloads the page and returns to the login form.
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    const content = await page.content();
    expect(content).toMatch('NEEMS Login');
  });
});
