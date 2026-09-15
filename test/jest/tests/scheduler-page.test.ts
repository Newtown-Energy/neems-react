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

  it('should open the Library editor when editing the original schedule', async () => {
    const today = new Date();
    const nextMonthName = new Date(today.getFullYear(), today.getMonth() + 1, 1)
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    await page.goto(`${baseUrl}/scheduler`);
    // Wait for the calendar's month header and its next-month button, not
    // just the page title, which also renders when no site is selected.
    await page.waitForFunction(
      () => (Array.from(document.querySelectorAll('h5')) as HTMLElement[]).some(h =>
        /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/
          .test(h.textContent || '') &&
        h.parentElement?.querySelector('button svg[data-testid="ChevronRightIcon"]')
      ),
      { timeout: 10000 }
    );

    // Move to next month so the chosen day is never in the past (past
    // days are read-only and hide the Edit Schedule button).
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
    await page.waitForFunction(
      (name) => Array.from(document.querySelectorAll('h5')).some(h => h.textContent === name),
      { timeout: 10000 },
      nextMonthName
    );
    await page.waitForFunction(
      () => (Array.from(document.querySelectorAll('div')) as HTMLDivElement[]).some(d =>
        window.getComputedStyle(d).cursor === 'pointer' &&
        d.querySelector('.MuiTypography-caption')?.textContent?.trim() === '15'
      ),
      { timeout: 10000 }
    );

    const clicked = await page.evaluate(() => {
      const allDivs = Array.from(document.querySelectorAll('div')) as HTMLDivElement[];
      const day15 = allDivs.find(d => {
        if (window.getComputedStyle(d).cursor !== 'pointer') return false;
        const caption = d.querySelector('.MuiTypography-caption');
        return caption?.textContent?.trim() === '15';
      });
      day15?.click();
      return Boolean(day15);
    });
    expect(clicked).toBe(true);
    // Click through the dialogs with DOM clicks: MUI dialogs are still
    // animating in when their buttons first exist, so coordinate-based
    // clicks can land on the backdrop.
    await page.waitForFunction(
      () => Array.from(document.querySelectorAll('[role="dialog"] button')).some(b =>
        b.textContent?.includes('Edit Schedule')
      ),
      { timeout: 10000 }
    );
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('[role="dialog"] button')) as HTMLButtonElement[];
      buttons.find(b => b.textContent?.includes('Edit Schedule'))?.click();
    });

    await page.waitForFunction(
      () => document.body.innerText.includes('Edit the original schedule'),
      { timeout: 5000 }
    );
    // "This day is currently using: <strong>name</strong>"
    const scheduleName = await page.evaluate(() =>
      document.querySelector('[role="dialog"] strong')?.textContent?.trim() || null
    );
    expect(scheduleName).toBeTruthy();
    await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label')) as HTMLLabelElement[];
      labels.find(l => l.textContent?.includes('Edit the original schedule'))?.click();
    });
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('[role="dialog"] button')) as HTMLButtonElement[];
      buttons.find(b => b.textContent?.includes('Continue'))?.click();
    });

    // Lands on the Library with the `edit` param already consumed and the
    // card for the schedule chosen on the calendar in edit mode.
    await page.waitForFunction(
      (name) => {
        if (window.location.pathname !== '/library') return false;
        if (window.location.search.includes('edit=')) return false;
        const editingCards = Array.from(document.querySelectorAll('.MuiCard-root')).filter(card =>
          Array.from(card.querySelectorAll('button')).some(b => b.textContent?.includes('Add Command'))
        );
        return editingCards.length === 1 &&
          Array.from(editingCards[0].querySelectorAll('input')).some(i => i.value === name);
      },
      { timeout: 10000 },
      scheduleName
    );
  });
});
