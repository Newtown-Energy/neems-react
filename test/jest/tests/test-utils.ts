import { Page } from 'puppeteer';

// Common browser utilities
export async function clearBrowserState(page: Page) {
  const client = await page.target().createCDPSession();
  await client.send('Network.clearBrowserCookies');
  await client.send('Network.clearBrowserCache');
  await client.detach();
}

export async function navigateToApp(page: Page) {
  await page.goto(`http://localhost:${process.env.NEEMS_REACT_PORT || '5173'}`);
}

export async function navigateToAdmin(page: Page) {
  await page.goto(`http://localhost:${process.env.NEEMS_REACT_PORT || '5173'}/admin`);
}

// Common test utilities
export async function findButtonByText(page: Page, text: string[]): Promise<any> {
  return await page.evaluateHandle((texts) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.find(btn =>
      texts.some(text => btn.textContent?.includes(text))
    );
  }, text);
}

// Authentication utilities
export async function loginAsUser(page: Page, email: string, password: string) {
  await page.waitForSelector('input[type="email"]');
  await page.type('input[type="email"]', email);
  await page.type('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for login to complete
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Check if authed UI box is displayed (indicates login success)
  try {
    await page.waitForSelector('#authed-ui-box', { timeout: 5000 });
    // Authed UI box found - login successful
    return;
  } catch (error) {
    // Authed UI box not found - login failed
    throw new Error('Login failed - authenticated UI not displayed');
  }
}

export async function loginAsSuperAdmin(page: Page) {
  await loginAsUser(page, 'superadmin@example.com', 'admin');
}

// Network error monitoring utilities
export interface ServerError {
  status: number;
  message: string;
}

export function createNetworkErrorHandler(): {
  handler: (response: any) => Promise<void>;
  getError: () => ServerError | null;
} {
  let serverError: ServerError | null = null;

  const handler = async (response: any) => {
    if (response.url().includes('/api/') && !response.ok()) {
      try {
        const responseBody = await response.text();
        let errorMessage = '';
        try {
          const jsonBody = JSON.parse(responseBody);
          errorMessage = jsonBody.message || jsonBody.error || 'Unknown error';
        } catch {
          errorMessage = responseBody || 'Unknown error';
        }
        serverError = { status: response.status(), message: errorMessage };
      } catch (err) {
        serverError = { status: response.status(), message: 'Could not parse error response' };
      }
    }
  };

  return {
    handler,
    getError: () => serverError
  };
}

// Generic entity verification utilities
export async function verifyEntityExists(page: Page, entityName: string, entityType: string) {
  const content = await page.content();
  expect(content).toContain(entityName);
}
