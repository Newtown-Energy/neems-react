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

    // The day view is read-only: commands are edited in the Library, via
    // Edit Schedule, never in place here (#160). The per-row edit, delete
    // and stop-now controls were icon-only, so check the commands table
    // for any control at all rather than for button text.
    const editAffordances = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return null;
      return {
        addCommand: Array.from(dialog.querySelectorAll('button'))
          .map(b => b.textContent?.trim() || '')
          .filter(t => /add command/i.test(t)),
        rowControls: dialog.querySelectorAll('table button, table [role="button"]').length,
        actionsColumn: Array.from(dialog.querySelectorAll('table th'))
          .some(th => /actions/i.test(th.textContent || ''))
      };
    });
    expect(editAffordances).toEqual({
      addCommand: [],
      rowControls: 0,
      actionsColumn: false
    });

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
  it('should open the Library editor on the new copy when copying a schedule', async () => {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const nextMonthName = nextMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    // The calendar's own `m` / `d` URL params, used to reopen the day
    // later without walking the chevrons again.
    const nextMonthParam =
      `${nextMonth.getFullYear()}-${(nextMonth.getMonth() + 1).toString().padStart(2, '0')}`;

    await page.goto(`${baseUrl}/scheduler`);
    await page.waitForFunction(
      () => (Array.from(document.querySelectorAll('h5')) as HTMLElement[]).some(h =>
        /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/
          .test(h.textContent || '') &&
        h.parentElement?.querySelector('button svg[data-testid="ChevronRightIcon"]')
      ),
      { timeout: 10000 }
    );

    // Next month again, and a different day from the test above so the
    // two cases don't share a schedule.
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
        d.querySelector('.MuiTypography-caption')?.textContent?.trim() === '16'
      ),
      { timeout: 10000 }
    );

    const clicked = await page.evaluate(() => {
      const allDivs = Array.from(document.querySelectorAll('div')) as HTMLDivElement[];
      const day16 = allDivs.find(d => {
        if (window.getComputedStyle(d).cursor !== 'pointer') return false;
        return d.querySelector('.MuiTypography-caption')?.textContent?.trim() === '16';
      });
      day16?.click();
      return Boolean(day16);
    });
    expect(clicked).toBe(true);

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

    // "Create a copy and edit it" is the default selection; the name field
    // is pre-filled with the next free "<name> (n)".
    await page.waitForFunction(
      () => document.body.innerText.includes('Create a copy and edit it'),
      { timeout: 5000 }
    );
    await page.waitForFunction(
      () => {
        const input = document.querySelector('[role="dialog"] input:not([type="radio"])') as HTMLInputElement | null;
        return Boolean(input?.value);
      },
      { timeout: 5000 }
    );
    const copyName = await page.evaluate(() => {
      const input = document.querySelector('[role="dialog"] input:not([type="radio"])') as HTMLInputElement | null;
      return input?.value || null;
    });
    expect(copyName).toBeTruthy();

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('[role="dialog"] button')) as HTMLButtonElement[];
      buttons.find(b => b.textContent?.includes('Continue'))?.click();
    });

    // The copy is created, applied to the date, and opened for editing in
    // the Library — not re-opened in the read-only day view (#160).
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
      copyName
    );

    // Add a command in the Library editor — the only place commands can be
    // edited now — so the day view has a commands table to render.
    await page.evaluate((name) => {
      const card = Array.from(document.querySelectorAll('.MuiCard-root')).find(c =>
        Array.from(c.querySelectorAll('input')).some(i => (i as HTMLInputElement).value === name)
      );
      const add = Array.from(card?.querySelectorAll('button') || [])
        .find(b => /add command/i.test(b.textContent || '')) as HTMLButtonElement | undefined;
      add?.click();
    }, copyName);
    // The dialog defaults to 00:00 / Charge / no duration, which saves as-is.
    await page.waitForFunction(
      () => Array.from(document.querySelectorAll('[role="dialog"] h2'))
        .some(h => h.textContent?.trim() === 'Add Command'),
      { timeout: 5000 }
    );
    await page.evaluate(() => {
      const dialog = Array.from(document.querySelectorAll('[role="dialog"]')).find(d =>
        Array.from(d.querySelectorAll('h2')).some(h => h.textContent?.trim() === 'Add Command')
      );
      const save = Array.from(dialog?.querySelectorAll('button') || [])
        .find(b => b.textContent?.trim() === 'Save') as HTMLButtonElement | undefined;
      save?.click();
    });
    await page.waitForFunction(
      () => !Array.from(document.querySelectorAll('[role="dialog"] h2'))
        .some(h => h.textContent?.trim() === 'Add Command'),
      { timeout: 5000 }
    );

    // Save the schedule; the card asks for a change reason first.
    await page.evaluate((name) => {
      const card = Array.from(document.querySelectorAll('.MuiCard-root')).find(c =>
        Array.from(c.querySelectorAll('input')).some(i => (i as HTMLInputElement).value === name)
      );
      const save = Array.from(card?.querySelectorAll('button') || [])
        .find(b => b.textContent?.trim() === 'Save') as HTMLButtonElement | undefined;
      save?.click();
    }, copyName);
    await page.waitForSelector('[role="dialog"] textarea', { timeout: 5000 });
    await page.keyboard.type('E2E: read-only day view check');
    await page.waitForFunction(
      () => Array.from(document.querySelectorAll('[role="dialog"] button'))
        .some(b => b.textContent?.trim() === 'Save' && !(b as HTMLButtonElement).disabled),
      { timeout: 5000 }
    );
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('[role="dialog"] button')) as HTMLButtonElement[];
      buttons.find(b => b.textContent?.trim() === 'Save' && !b.disabled)?.click();
    });
    await page.waitForFunction(
      (name) => Array.from(document.querySelectorAll('.MuiCard-root h6'))
        .some(h => h.textContent?.trim() === name),
      { timeout: 10000 },
      copyName
    );

    // Back to the day: it now renders a commands table, and that table has
    // no controls at all — the edit, delete and stop-now icons are gone,
    // not merely the "Add command" button (#160).
    await page.goto(`${baseUrl}/scheduler?m=${nextMonthParam}&d=${nextMonthParam}-16`);
    await page.waitForSelector('[role="dialog"] table', { timeout: 10000 });
    const commandsTable = await page.evaluate(() => {
      const table = document.querySelector('[role="dialog"] table') as HTMLTableElement;
      return {
        headers: Array.from(table.querySelectorAll('th')).map(th => th.textContent?.trim()),
        rows: table.querySelectorAll('tbody tr').length,
        controls: table.querySelectorAll('button, [role="button"], input, select').length
      };
    });
    expect(commandsTable).toEqual({
      headers: ['Time', 'Type', 'Duration', 'Target SOC'],
      rows: 1,
      controls: 0
    });

    // Clean up: the copy is real data, and leaving it behind would stack
    // up "(3)", "(4)", ... across runs. Deleting it also drops the
    // specific-date rule, restoring the day to the default schedule.
    await page.goto(`${baseUrl}/library`);
    await page.waitForFunction(
      (name) => Array.from(document.querySelectorAll('.MuiCard-root h6'))
        .some(h => h.textContent?.trim() === name),
      { timeout: 10000 },
      copyName
    );
    await page.evaluate((name) => {
      const card = Array.from(document.querySelectorAll('.MuiCard-root')).find(c =>
        Array.from(c.querySelectorAll('h6')).some(h => h.textContent?.trim() === name)
      );
      const del = Array.from(card?.querySelectorAll('button') || [])
        .find(b => b.getAttribute('title') === 'Delete') as HTMLButtonElement | undefined;
      del?.click();
    }, copyName);
    await page.waitForFunction(
      () => document.body.innerText.includes('Delete Schedule'),
      { timeout: 5000 }
    );
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('[role="dialog"] button')) as HTMLButtonElement[];
      buttons.find(b => b.textContent?.trim() === 'Delete')?.click();
    });
    await page.waitForFunction(
      (name) => !Array.from(document.querySelectorAll('.MuiCard-root h6'))
        .some(h => h.textContent?.trim() === name),
      { timeout: 10000 },
      copyName
    );
  });
});
