import {
  clearBrowserState,
  navigateToApp,
  navigateToAdmin,
  findButtonByText,
  loginAsUser,
  loginAsSuperAdmin,
  createNetworkErrorHandler,
  verifyEntityExists
} from './test-utils';

describe('Admin Company Management Tests', () => {
  let testCompanyName: string;
  const timestamp = Date.now();
  testCompanyName = `Test Company ${timestamp}`;
  const editedCompanyName = testCompanyName + ' (Edited)';
 
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

  it('should navigate to companies tab', async () => {
    if (! await switchToCompaniesTab() ) {
        throw new Error('Companies tab not available - user may not be super admin');
      }
  });

  it('should create companies (super admin only)', async () => {
      // Create Company
      await createCompany(testCompanyName);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify company was created
      await verifyEntityExists(page, testCompanyName, 'Company');
  });
      
  it('should edit companies (super admin only)', async () => {
      // Edit Company
      await editCompany(testCompanyName, editedCompanyName);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify company was edited
      await verifyEntityExists(page, editedCompanyName, 'Company');
  });

  it('should delete test company', async () => {
      await deleteCompanyIfExists(editedCompanyName);
  });

  // Helper Functions
async function switchToCompaniesTab(): Promise<boolean> {
  // Switch to Companies tab (third tab, only visible for super admin)
  const companyTab = await page.$('[role="tab"]:nth-child(3)');
  if (companyTab) {
    await companyTab.click();
    await new Promise(resolve => setTimeout(resolve, 2000));
    return true;
  } else {
    throw new Error('Companies tab not found - user may not be super admin');
  }
  return false;
}


  async function createCompany(companyName: string) {
    // Look for "Add Company" button
    const addButton = await findButtonByText(page, ['Add Company']);
    if (addButton && await addButton.evaluate((el: any) => !!el)) {
      await addButton.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Wait for dialog and fill in company name
      await page.waitForSelector('[role="dialog"]');
      const nameInput = await page.$('[role="dialog"] input[type="text"]');
      if (nameInput) {
        await nameInput.type(companyName);
      }
      
      // Click Create button
      const createButton = await findButtonByText(page, ['Create']);
      if (createButton && await createButton.evaluate((el: any) => !!el)) {
        // Set up network monitoring to catch server errors and their messages
        const errorHandler = createNetworkErrorHandler();
        
        page.on('response', errorHandler.handler);
        
        try {
          await createButton.click();
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Check if server returned an error
          const serverError = errorHandler.getError();
          if (serverError !== null) {
            throw new Error(`Company creation failed with server validation: ${serverError.message}`);
          }
          
        } finally {
          // Clean up event listener
          page.off('response', errorHandler.handler);
        }
      } else {
        // Let's check what buttons are available in the dialog
        const allButtons = await page.$$('[role="dialog"] button');
        console.log(`Available buttons in dialog: ${allButtons.length}`);
        for (let i = 0; i < allButtons.length; i++) {
          const buttonText = await allButtons[i].evaluate(el => el.textContent);
          console.log(`Button ${i}: "${buttonText}"`);
        }
        throw new Error('Create button not found in dialog');
      }
    } else {
      throw new Error('ERROR: Add Company button not found');
    }
  }

  async function editCompany(currentName: string, newName: string) {
    // Find company row in table and click edit button
    const tableRows = await page.$$('tbody tr');
    for (const row of tableRows) {
      const text = await row.evaluate(el => el.textContent);
      if (text?.includes(currentName)) {
        // Look for edit button (pencil icon) - usually second button after admin panel button
        const actionButtons = await row.$$('button');
        let editButton = null;
        
        // Try to find edit button by icon or position
        for (const btn of actionButtons) {
          const hasEditIcon = await btn.$('svg[data-testid="EditIcon"]');
          const title = await btn.evaluate(el => el.getAttribute('title'));
          if (hasEditIcon || title?.includes('Edit')) {
            editButton = btn;
            break;
          }
        }
        
        // Fallback: try second button (after admin panel button)
        if (!editButton && actionButtons.length > 1) {
          editButton = actionButtons[1];
        }
        
        if (editButton) {
          await editButton.click();
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Wait for dialog and update company name
          await page.waitForSelector('[role="dialog"]');
          const nameInput = await page.$('[role="dialog"] input[type="text"]');
          if (nameInput) {
            await nameInput.click({ clickCount: 3 }); // Select all
            await nameInput.type(newName);
          }
          
          // Click Update button
          const updateButton = await findButtonByText(page, ['Update']);
          if (updateButton && await updateButton.evaluate((el: any) => !!el)) {
            await updateButton.click();
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          break;
        }
      }
    }
  }


  async function deleteCompanyIfExists(companyName: string) {
    const content = await page.content();

    if (content.includes(companyName)) {
    } else {
      throw new Error(`Company not found for deletion: ${companyName}`);
    }

    const tableRows = await page.$$('tbody tr');
    for (const row of tableRows) {
      const text = await row.evaluate(el => el.textContent);
      if (text?.includes(companyName)) {
        // Look for delete button (trash icon) - usually the last button
        const actionButtons = await row.$$('button');
        let deleteButton = null;
        
        // Try to find delete button by icon or color
        for (const btn of actionButtons) {
          const hasDeleteIcon = await btn.$('svg[data-testid="DeleteIcon"]');
          const title = await btn.evaluate(el => el.getAttribute('title'));
          const color = await btn.evaluate(el => el.getAttribute('color'));
          if (hasDeleteIcon || title?.includes('Delete') || color === 'error') {
            deleteButton = btn;
            break;
          }
        }
        
        // Fallback: try last button
        if (!deleteButton && actionButtons.length > 0) {
          deleteButton = actionButtons[actionButtons.length - 1];
        }
        
        if (deleteButton) {
          await deleteButton.click();
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Confirm deletion if confirmation dialog appears
          const confirmButton = await findButtonByText(page, ['Delete']);
          if (confirmButton && await confirmButton.evaluate((el: any) => !!el)) {
            await confirmButton.click();
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          break;
        }
      }
    }
  }
});
