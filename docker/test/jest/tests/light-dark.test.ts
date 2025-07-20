import { Page } from 'puppeteer';

describe('Theme Switcher', () => {
  let page: Page;

  beforeAll(async () => {
    page = await browser.newPage();
    await page.goto(process.env.NEEMS_CORE_SERVER || 'http://nginx');
  });

  afterAll(async () => {
    await page.close();
  });

  it('should successfully login with valid credentials', async () => {
    // Wait for login form to be present
    await page.waitForSelector('input[type="email"]');
    
    // Fill in the email field
    await page.type('input[type="email"]', 'superadmin@example.com');
    
    // Fill in the password field
    await page.type('input[type="password"]', 'admin');
    
    // Click the login button
    await page.click('button[type="submit"]');
    
    // Wait for page to change after successful login
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verify login was successful by checking the current page content
    const content = await page.content();
    expect(content).not.toMatch('NEEMS Login');
  });


  test('should toggle from light to dark and back to light', async () => {
    // Wait for the theme switcher to be visible
    await page.waitForSelector('[aria-label*="Switch to"]');
    
    // Get initial theme state from document attribute
    const initialTheme = await page.evaluate(() => 
      document.documentElement.getAttribute('data-theme')
    );
    
    // Click the theme toggle switch
    await page.click('[aria-label*="Switch to"]');
    
    // Wait for theme change to be applied
    await page.waitForFunction(
      (previousTheme) => document.documentElement.getAttribute('data-theme') !== previousTheme,
      {},
      initialTheme
    );
    
    // Verify theme has changed
    const newTheme = await page.evaluate(() => 
      document.documentElement.getAttribute('data-theme')
    );
    
    expect(newTheme).not.toBe(initialTheme);
    expect(['light', 'dark']).toContain(newTheme);
    
    // Click the toggle again to switch back
    await page.click('[aria-label*="Switch to"]');
    
    // Wait for theme to change back
    await page.waitForFunction(
      (previousTheme) => document.documentElement.getAttribute('data-theme') !== previousTheme,
      {},
      newTheme
    );
    
    // Verify theme has changed back to original
    const finalTheme = await page.evaluate(() => 
      document.documentElement.getAttribute('data-theme')
    );
    
    expect(finalTheme).toBe(initialTheme);
  });

  test('should update switch state when theme changes', async () => {
    // Wait for the theme switcher to be visible
    await page.waitForSelector('[aria-label*="Switch to"]');
    
    // Get initial switch state
    const initialChecked = await page.evaluate(() => {
      const switchElement = document.querySelector('[aria-label*="Switch to"]') as HTMLInputElement;
      return switchElement?.checked;
    });
    
    // Click the theme toggle switch
    await page.click('[aria-label*="Switch to"]');
    
    // Wait for switch state to change
    await page.waitForFunction(
      (previousChecked) => {
        const switchElement = document.querySelector('[aria-label*="Switch to"]') as HTMLInputElement;
        return switchElement?.checked !== previousChecked;
      },
      {},
      initialChecked
    );
    
    // Verify switch state has changed
    const newChecked = await page.evaluate(() => {
      const switchElement = document.querySelector('[aria-label*="Switch to"]') as HTMLInputElement;
      return switchElement?.checked;
    });
    
    expect(newChecked).toBe(!initialChecked);
  });

  test('should persist theme preference in localStorage', async () => {
    // Wait for the theme switcher to be visible
    await page.waitForSelector('[aria-label*="Switch to"]');
    
    // Get initial theme
    const initialTheme = await page.evaluate(() => 
      document.documentElement.getAttribute('data-theme')
    );
    
    // Click the theme toggle switch
    await page.click('[aria-label*="Switch to"]');
    
    // Wait for theme change
    await page.waitForFunction(
      (previousTheme) => document.documentElement.getAttribute('data-theme') !== previousTheme,
      {},
      initialTheme
    );
    
    // Check that localStorage was updated
    const storedTheme = await page.evaluate(() => 
      localStorage.getItem('theme-preference')
    );
    
    const currentTheme = await page.evaluate(() => 
      document.documentElement.getAttribute('data-theme')
    );
    
    expect(storedTheme).toBe(currentTheme);
  });
});
