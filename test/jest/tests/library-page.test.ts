import {
  navigateToApp,
  loginAsSuperAdmin,
  findButtonByText,
} from './test-utils';

describe('Library Page Tests', () => {
  const baseUrl = `http://localhost:${process.env.NEEMS_REACT_PORT || '5173'}`;

  it('should navigate to start page and log in', async () => {
    await navigateToApp(page);
    await loginAsSuperAdmin(page);
  });

  it('should load the Library page', async () => {
    await page.goto(`${baseUrl}/library`);
    await page.waitForFunction(
      () => document.body.innerText.includes('Schedule Library'),
      { timeout: 10000 }
    );
    expect(await page.url()).toContain('/library');
  });

  it('should render the Library heading and helper text', async () => {
    const content = await page.content();
    expect(content).toContain('Schedule Library');
    expect(content).toContain('Library');
    expect(content).toContain('Create and manage reusable schedules');
  });

  it('should expose the New Schedule action', async () => {
    const newScheduleButton = await findButtonByText(page, ['New Schedule']);
    expect(await newScheduleButton.evaluate((el: any) => !!el)).toBe(true);
  });

  it('should open and close the New Schedule dialog', async () => {
    const newScheduleButton = await findButtonByText(page, ['New Schedule']);
    await newScheduleButton.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Dialog should expose Name and Description fields.
    const dialogContent = await page.$eval('[role="dialog"]', el => el.textContent || '');
    expect(dialogContent).toMatch(/Name/i);

    // Close via Cancel.
    const cancelButton = await findButtonByText(page, ['Cancel']);
    expect(await cancelButton.evaluate((el: any) => !!el)).toBe(true);
    await cancelButton.click();
    await new Promise(resolve => setTimeout(resolve, 500));

    const dialog = await page.$('[role="dialog"]');
    expect(dialog).toBeNull();
  });

  it('should navigate back to the Scheduler via Back to Calendar', async () => {
    const backButton = await findButtonByText(page, ['Back to Calendar']);
    expect(await backButton.evaluate((el: any) => !!el)).toBe(true);
    await backButton.click();
    await new Promise(resolve => setTimeout(resolve, 1000));

    expect(await page.url()).toContain('/scheduler');
  });
});
