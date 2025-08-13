import {
  clearBrowserState,
  navigateToApp,
  navigateToAdmin,
  findButtonByText,
  loginAsSuperAdmin,
  createNetworkErrorHandler,
  verifyEntityExists
} from './test-utils';

describe('Admin Site Management Tests', () => {
  let testSiteName: string;
  const timestamp = Date.now();
  testSiteName = `Test Site ${timestamp}`;
  const editedSiteName = testSiteName + ' (Edited)';

  // it('should clear browser cache', async () => {
  //   Generate unique test data name to avoid conflicts
  //   // Clear cookies to ensure clean state between tests
  //   const client = await page.target().createCDPSession();
  //   await client.send('Network.clearBrowserCookies');
  //   await client.send('Network.clearBrowserCache');
  //   await client.detach();
  // });

  it('should navigate to start page', async () => {
    await page.goto(`http://localhost:${process.env.NEEMS_REACT_PORT || '5173'}`);
  });

  it('should successfully login with valid credentials', async () => {
    await loginAsSuperAdmin(page);
  });

  it('should navigate to admin page...', async () => {
      // Navigate to admin page
      await page.goto(`http://localhost:${process.env.NEEMS_REACT_PORT || '5173'}/admin`);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify we're on the admin page
      const currentUrl = await page.url();
      try {
        expect(currentUrl).toContain('/admin');
      } catch (error) {
        console.log(`ERROR: Expected to be on admin page, but got: ${currentUrl}`);
        throw error;
      }
  });

  it('should switch to sites tab', async () => {
      await switchToSitesTab();
  });

  it('should create site', async () => {
      await createSite(testSiteName, 'Test Location Address');
      await new Promise(resolve => setTimeout(resolve, 1000));
      await verifySiteExists(testSiteName);
  });

  it('should edit site', async () => {
      await editSite(testSiteName, editedSiteName, 'Updated Location Address');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify site was edited
      await verifySiteExists(editedSiteName);
      
      // Update testSiteName for cleanup
      testSiteName = editedSiteName;
  });

  it('should NOT duplicate site', async () => {
      // Test invalid state: try to create duplicate site
      try {
        await createSite(editedSiteName, 'Another Address', true); // expectError=true
        throw new Error(`Duplicate site creation should have failed for site: ${editedSiteName}`);
      } catch (error) {
        // Check if it's our expected error or an actual validation error
        if (error instanceof Error && (
            error.message.includes('Duplicate site creation should have failed') ||
            error.message.includes('Expected duplicate site validation to fail')
        )) {
          throw error; // Re-throw our test failure
        }
      }
  });

  it('should delete test site', async () => {
      await page.goto(`http://localhost:${process.env.NEEMS_REACT_PORT || '5173'}/admin`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await switchToSitesTab();
      await deleteSiteIfExists(testSiteName);
  });


  // Helper Functions
  async function findButtonByText(text: string[]): Promise<any> {
    return await page.evaluateHandle((texts) => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => 
        texts.some(text => btn.textContent?.includes(text))
      );
    }, text);
  }

  async function switchToSitesTab() {
    // Switch to Sites tab (second tab)
    const siteTab = await page.$('[role="tab"]:nth-child(2)');
    if (siteTab) {
      await siteTab.click();
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      // Log available tabs for debugging
      const allTabs = await page.$$('[role="tab"]');
      throw new Error(`Can't switch to sites tab. Available tabs: ${allTabs.length}`);
    }
  }

  async function createSite(siteName: string, location: string, expectError: boolean = false) {
    // Look for "Add Site" button
    const addButton = await findButtonByText(['Add Site']);
    if (addButton && await addButton.evaluate((el: any) => !!el)) {
      await addButton.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Wait for dialog and fill in site details
      await page.waitForSelector('[role="dialog"]');
      
      // Fill site name and location
      const textInputs = await page.$$('[role="dialog"] input[type="text"]');
      if (textInputs.length >= 2) {
        await textInputs[0].type(siteName); // Site name
        await textInputs[1].type(location); // Location
      }
      
      // Click Create button
      const createButton = await findButtonByText(['Create']);
      if (createButton && await createButton.evaluate((el: any) => !!el)) {
        // Set up network monitoring to catch server errors and their messages
        let serverError: { status: number; message: string } | null = null;
        const responseHandler = async (response: any) => {
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
        
        page.on('response', responseHandler);
        
        try {
          await createButton.click();
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Check if server returned an error
          if (serverError !== null) {
            const error = serverError as { status: number; message: string };
            
            // Verify the error message is displayed in the modal (without dumping HTML)
            const dialogErrorText = await page.evaluate(() => {
              const dialog = document.querySelector('[role="dialog"]');
              return dialog ? dialog.textContent : '';
            });
            if (dialogErrorText?.includes(error.message)) {
              throw new Error(`Site creation failed with server validation: ${error.message}`);
            } else {
              throw new Error(`UI failed to display server error: ${error.message}`);
            }
          } else if (expectError) {
            // We expected an error but didn't get one - this is a validation failure
            throw new Error(`Expected duplicate site validation to fail for: ${siteName}`);
          }
        } finally {
          // Clean up event listener
          page.off('response', responseHandler);
        }
      }
    } else {
      throw new Error('Add Site button not found');
    }
  }

  async function editSite(currentName: string, newName: string, newLocation: string) {
    // Find site row in table and click edit button
    const tableRows = await page.$$('tbody tr');
    for (const row of tableRows) {
      const text = await row.evaluate(el => el.textContent);
      if (text?.includes(currentName)) {
        // Look for edit button (pencil icon)
        const editButton = await row.$('button[aria-label*="edit"], button svg[data-testid="EditIcon"]');
        if (!editButton) {
          // Try finding by position (first action button)
          const actionButtons = await row.$$('button');
          if (actionButtons.length > 0) {
            await actionButtons[0].click(); // Usually edit is the first button
          }
        } else {
          await editButton.click();
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Wait for dialog and update site details
        await page.waitForSelector('[role="dialog"]');
        const textInputs = await page.$$('[role="dialog"] input[type="text"]');
        
        if (textInputs.length >= 2) {
          // Update site name
          await textInputs[0].click({ clickCount: 3 }); // Select all
          await textInputs[0].type(newName);
          
          // Update location
          await textInputs[1].click({ clickCount: 3 }); // Select all
          await textInputs[1].type(newLocation);
        }
        
        // Click Update button
        const updateButton = await findButtonByText(['Update']);
        if (updateButton && await updateButton.evaluate((el: any) => !!el)) {
          await updateButton.click();
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        break;
      }
    }
  }

  async function verifySiteExists(siteName: string) {
    // Avoid dumping full HTML - search for site in table rows instead
    const tableRows = await page.$$('tbody tr');
    let found = false;
    for (const row of tableRows) {
      const text = await row.evaluate(el => el.textContent);
      if (text?.includes(siteName)) {
        found = true;
        break;
      }
    }
    if (!found) {
      throw new Error(`Site not found in table: ${siteName}`);
    }
  }

  async function deleteSiteIfExists(siteName: string) {
    // Check if site exists without fetching full HTML
    const siteExists = await page.evaluate((name) => {
      const rows = document.querySelectorAll('tbody tr');
      return Array.from(rows).some(row => row.textContent?.includes(name));
    }, siteName);
    
    if (siteExists) {
      const tableRows = await page.$$('tbody tr');
      for (const row of tableRows) {
        const text = await row.evaluate(el => el.textContent);
        if (text?.includes(siteName)) {
          // Look for delete button (trash icon) - usually the last button
          const actionButtons = await row.$$('button');
          if (actionButtons.length > 0) {
            const deleteButton = actionButtons[actionButtons.length - 1]; // Delete is usually last
            await deleteButton.click();
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Confirm deletion if confirmation dialog appears
            const confirmButton = await findButtonByText(['Delete']);
            if (confirmButton && await confirmButton.evaluate((el: any) => !!el)) {
              await confirmButton.click();
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            break;
          }
        }
      }
    } else {
      throw new Error (`Site not found for deletion: ${siteName}`);
    }
  }
});
