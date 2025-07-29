describe('Login Page Tests', () => {
  beforeEach(async () => {
    // Clear cookies to ensure clean state between tests
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
    await client.send('Network.clearBrowserCache');
    await client.detach();

    await page.goto('http://localhost:5173');
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

  it('should show error with invalid credentials', async () => {
    // Wait for login form to be present
    await page.waitForSelector('input[type="email"]');
    
    // Fill in invalid credentials
    await page.type('input[type="email"]', 'invalid@example.com');
    await page.type('input[type="password"]', 'wrongpassword');
    
    // Click the login button
    await page.click('button[type="submit"]');
    
    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if we're still on the login page (login failed)
    const content = await page.content();
    expect(content).toMatch('NEEMS Login');
  });
});
