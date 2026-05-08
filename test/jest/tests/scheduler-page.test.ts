import {
  navigateToApp,
  loginAsSuperAdmin,
  findButtonByText,
} from './test-utils';

describe('Scheduler Page Tests', () => {
  const baseUrl = `http://localhost:${process.env.NEEMS_REACT_PORT || '5173'}`;

  it('should navigate to start page and log in', async () => {
    await navigateToApp(page);
    await loginAsSuperAdmin(page);
  });

  it('should load the Scheduler page', async () => {
    await page.goto(`${baseUrl}/scheduler`);
    await page.waitForFunction(
      () => document.body.innerText.includes('Schedule Calendar'),
      { timeout: 10000 }
    );
    expect(await page.url()).toContain('/scheduler');
  });

  it('should render the calendar grid with weekday headers', async () => {
    const content = await page.content();
    for (const day of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
      expect(content).toContain(day);
    }
  });

  it('should display the current month name in the calendar header', async () => {
    const monthName = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const headerText = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll('h5')) as HTMLElement[];
      return headers.find(h =>
        /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/
          .test(h.textContent || '')
      )?.textContent || null;
    });
    expect(headerText).toBe(monthName);
  });

  it('should advance the calendar a month and return via the Today button', async () => {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const nextMonthName = nextMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const currentMonthName = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Locate the right-chevron icon button next to the calendar's month <h5>.
    await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll('h5')) as HTMLElement[];
      const monthHeader = headers.find(h =>
        /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/
          .test(h.textContent || '')
      );
      const parent = monthHeader?.parentElement;
      const buttons = parent ? Array.from(parent.querySelectorAll('button')) : [];
      const next = buttons.find(b => b.querySelector('svg[data-testid="ChevronRightIcon"]')) as HTMLElement | undefined;
      next?.click();
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    const afterAdvance = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll('h5')) as HTMLElement[];
      return headers.find(h =>
        /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/
          .test(h.textContent || '')
      )?.textContent || null;
    });
    expect(afterAdvance).toBe(nextMonthName);

    const todayButton = await findButtonByText(page, ['Today']);
    expect(await todayButton.evaluate((el: any) => !!el)).toBe(true);
    await todayButton.click();
    await new Promise(resolve => setTimeout(resolve, 500));

    const afterToday = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll('h5')) as HTMLElement[];
      return headers.find(h =>
        /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/
          .test(h.textContent || '')
      )?.textContent || null;
    });
    expect(afterToday).toBe(currentMonthName);
  });

  it('should open the day details modal when clicking a calendar date', async () => {
    // Day cells are rendered as divs with a CSS-applied cursor:pointer and a
    // direct child caption containing only a day number.
    const clicked = await page.evaluate(() => {
      const allDivs = Array.from(document.querySelectorAll('div')) as HTMLDivElement[];
      const day15 = allDivs.find(d => {
        if (window.getComputedStyle(d).cursor !== 'pointer') return false;
        const caption = d.querySelector('.MuiTypography-caption');
        return caption?.textContent?.trim() === '15';
      });
      if (day15) {
        day15.click();
        return true;
      }
      return false;
    });
    expect(clicked).toBe(true);
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Close the modal via Escape so subsequent steps see a clean state.
    await page.keyboard.press('Escape');
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  it('should navigate to Library via the Manage Library button', async () => {
    const manageLibraryButton = await findButtonByText(page, ['Manage Library']);
    expect(await manageLibraryButton.evaluate((el: any) => !!el)).toBe(true);

    await manageLibraryButton.click();
    await new Promise(resolve => setTimeout(resolve, 1500));

    expect(await page.url()).toContain('/library');
  });
});
