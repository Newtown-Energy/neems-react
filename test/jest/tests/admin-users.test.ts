import {
  clearBrowserState,
  navigateToApp,
  navigateToAdmin,
  findButtonByText,
  loginAsSuperAdmin,
  createNetworkErrorHandler,
} from './test-utils';


describe('Admin User Management Tests', () => {
  let testUsers: Array<{name: string, email: string, role: string}>;

  it('should generate unique test data names to avoid conflicts', async () => {
    // 
    const timestamp = Date.now();
    testUsers = [
      { name: `Admin User ${timestamp}`, email: `admin${timestamp}@test.com`, role: 'admin' },
      { name: `Staff User ${timestamp}`, email: `staff${timestamp}@test.com`, role: 'staff' },
    ];
  });

  // it('should clear cookies to ensure clean slate', async () => {
  //   // Clear cookies to ensure clean state between tests
  //   const client = await page.target().createCDPSession();
  //   await client.send('Network.clearBrowserCookies');
  //   await client.send('Network.clearBrowserCache');
  //   await client.detach();
  // });

  it('should navigate to start page', async () => {
    await navigateToApp(page)
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

  it('should switch to users tab', async () => {
      await switchToUsersTab();
  });

  it('should create and edit users', async () => {
      // Test each user
      for (const user of testUsers) {

        // Create User
        await createUser(user.email, user.role);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify user was created
        await verifyUserExists(user.email);
        
        // Edit User (change email)
        const editedEmail = user.email.replace('@test.com', '-edited@test.com');
        await editUser(user.email, editedEmail);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify user was edited
        await verifyUserExists(editedEmail);
        
        // Update email for cleanup
        user.email = editedEmail;
      }
  }, 60000);

  it('should NOT create duplicate user', async () => {
      // Test invalid state: try to create duplicate user
      try {
        await createUser(testUsers[0].email, testUsers[0].role, true); // expectError=true
        // If we get here, the duplicate creation didn't fail as expected
        throw new Error(`Duplicate user creation should have failed for email: ${testUsers[0].email}`);
      } catch (error) {
        // Check if it's our expected error or an actual validation error
        if (error instanceof Error && (
            error.message.includes('Duplicate user creation should have failed') ||
            error.message.includes('Expected duplicate user validation to fail')
        )) {
          throw error; // Re-throw our test failure
        }
      }
  });

  it('should delete users', async () => {
      for (const user of testUsers) {
        try {
          await deleteUserIfExists(user.email);
        } catch (error) {
          throw new Error(`Failed to delete user ${user.email}: ${error}`);
        }
      }
  });

// Tab navigation utilities
async function switchToUsersTab() {
  // Switch to Users tab (first tab)
  const userTab = await page.$('[role="tab"]:nth-child(1)');
  if (userTab) {
    await userTab.click();
    await new Promise(resolve => setTimeout(resolve, 2000));
  } else {
    // Log available tabs for debugging
    const allTabs = await page.$$('[role="tab"]');
    throw new Error(`Can't switch to user tab. Available tabs: ${allTabs.length}`);
  }
}


  async function createUser(email: string, role: string, expectError: boolean = false) {
    // Look for "Add User" button
    const addButton = await findButtonByText(page, ['Add User']);
    if (addButton && await addButton.evaluate((el: any) => !!el)) {
      await addButton.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Wait for dialog and fill in user details
      await page.waitForSelector('[role="dialog"]');
      
      // Fill email
      const emailInput = await page.$('[role="dialog"] input[type="email"]');
      if (emailInput) {
        await emailInput.type(email);
      }
      
      // Select role using radio buttons
      const roleRadio = await page.$(`[role="dialog"] input[value="${role}"]`);
      if (roleRadio) {
        await roleRadio.click();
      }
      
      // Click Create button
      const createButton = await findButtonByText(page, ['Create']);
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
            
            // Verify the error message is displayed in the modal
            const dialogContent = await page.content();
            if (dialogContent.includes(error.message)) {
              throw new Error(`User creation failed with server validation: ${error.message}`);
            } else {
              throw new Error(`UI failed to display server error: ${error.message}`);
            }
          } else if (expectError) {
            // We expected an error but didn't get one - this is a validation failure
            throw new Error(`Expected duplicate user validation to fail for: ${email}`);
          }
          
        } finally {
          // Clean up event listener
          page.off('response', responseHandler);
        }
      }
    } else {
      throw new Error('Create user failed.');
    }
  }

  async function editUser(currentEmail: string, newEmail: string) {
    // Find user row in table and click edit button
    const tableRows = await page.$$('tbody tr');
    for (const row of tableRows) {
      const text = await row.evaluate(el => el.textContent);
      if (text?.includes(currentEmail)) {
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
        
        // Wait for dialog and update email
        await page.waitForSelector('[role="dialog"]');
        const emailInput = await page.$('[role="dialog"] input[type="email"]');
        if (emailInput) {
          await emailInput.click({ clickCount: 3 }); // Select all
          await emailInput.type(newEmail);
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

  async function verifyUserExists(email: string) {
    const content = await page.content();
    try {
      expect(content).toContain(email);
    } catch (error) {
      throw error;
    }
  }

  async function deleteUserIfExists(email: string) {
    const content = await page.content();
    if (content.includes(email)) {
      const tableRows = await page.$$('tbody tr');
      for (const row of tableRows) {
        const text = await row.evaluate(el => el.textContent);
        if (text?.includes(email)) {
          // Look for delete button (trash icon) - usually the last button
          const actionButtons = await row.$$('button');
          if (actionButtons.length > 0) {
            const deleteButton = actionButtons[actionButtons.length - 1]; // Delete is usually last
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
  }
});
