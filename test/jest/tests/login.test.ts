import {
  clearBrowserState,
  navigateToApp,
  loginAsUser,
  loginAsSuperAdmin,
} from './test-utils';

describe('Login Page Tests', () => {

  it('should open the app', async() => {
    await navigateToApp(page);
  });

  it('should successfully login with valid credentials', async () => {
    await loginAsSuperAdmin(page);
  });

  it('clear the browser cache', async() => {
    clearBrowserState(page);
  });

  it('should reopen the app to the login page', async() => {
    await navigateToApp(page);
  });

  it('should show error with invalid credentials', async () => {
    await expect(loginAsUser(page, "invalid@example.com", "invalid-password")).rejects.toThrow();
  });
});
