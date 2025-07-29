describe('Admin User Management Tests', () => {
  let testUsers: Array<{name: string, email: string, role: string}>;
  let debugMessages: string[] = [];

  function addDebugMessage(message: string) {
    debugMessages.push(`[${new Date().toISOString()}] ${message}`);
  }

  function dumpDebugMessages() {
    if (debugMessages.length > 0) {
      console.log('\n=== DEBUG TRAIL ===');
      debugMessages.forEach(msg => console.log(msg));
      console.log('===================\n');
    }
  }

  function clearDebugMessages() {
    debugMessages = [];
  }

  beforeEach(async () => {
    // Clear debug messages for clean test start
    clearDebugMessages();
    addDebugMessage('Test initialization started');

    // Generate unique test data names to avoid conflicts
    const timestamp = Date.now();
    testUsers = [
      { name: `Admin User ${timestamp}`, email: `admin${timestamp}@test.com`, role: 'admin' },
      { name: `Staff User ${timestamp}`, email: `staff${timestamp}@test.com`, role: 'staff' },
    ];
    addDebugMessage(`Generated test users: ${testUsers.map(u => u.email).join(', ')}`);

    // Clear cookies to ensure clean state between tests
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
    await client.send('Network.clearBrowserCache');
    await client.detach();
    addDebugMessage('Browser cookies and cache cleared');

    await page.goto('http://localhost:5173');
    addDebugMessage('Navigated to login page');
  });

  afterEach(async () => {
    // Cleanup: Delete all created test users
    try {
      addDebugMessage('Starting cleanup process');
      await page.goto('http://localhost:5173/admin');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await selectTestCompany();
      await switchToUsersTab();
      
      for (const user of testUsers) {
        try {
          await deleteUserIfExists(user.email);
          addDebugMessage(`Cleaned up user: ${user.email}`);
        } catch (error) {
          console.warn(`Failed to delete user ${user.email}:`, error);
          dumpDebugMessages(); // Show debug trail on cleanup failure
        }
      }
      addDebugMessage('Cleanup completed successfully');
    } catch (error) {
      console.warn('Cleanup failed:', error);
      dumpDebugMessages(); // Show debug trail on cleanup failure
    }
  });

  it('should create, edit, and delete users', async () => {
    // Set up timeout handler to dump debug messages
    const timeoutHandler = setTimeout(() => {
      console.error('Test is about to timeout!');
      dumpDebugMessages();
    }, 58000); // 2 seconds before the 60 second timeout

    try {
      addDebugMessage('Test step 1: Starting login...');
      // Login with superadmin credentials
      await loginAsSuperAdmin();

      addDebugMessage('Test step 2: Navigating to admin page...');
      // Navigate to admin page
      await page.goto('http://localhost:5173/admin');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify we're on the admin page
      const currentUrl = await page.url();
      try {
        expect(currentUrl).toContain('/admin');
        addDebugMessage(`Test step 3: On admin page: ${currentUrl}`);
      } catch (error) {
        addDebugMessage(`ERROR: Expected to be on admin page, but got: ${currentUrl}`);
        throw error;
      }

      addDebugMessage('Test step 4: Selecting company...');
      // Select a company and switch to Users tab
      await selectTestCompany();
      addDebugMessage('Test step 5: Switching to Users tab...');
      await switchToUsersTab();
      addDebugMessage('Test step 6: Ready to test user operations...');

      // Test each user
      for (const user of testUsers) {
        addDebugMessage(`Starting operations for user: ${user.email}`);
        
        // Create User
        await createUser(user.email, user.role);
        await new Promise(resolve => setTimeout(resolve, 1000));
        addDebugMessage(`Created user: ${user.email}`);
        
        // Verify user was created
        await verifyUserExists(user.email);
        addDebugMessage(`Verified user exists: ${user.email}`);
        
        // Edit User (change email)
        const editedEmail = user.email.replace('@test.com', '-edited@test.com');
        await editUser(user.email, editedEmail);
        await new Promise(resolve => setTimeout(resolve, 1000));
        addDebugMessage(`Edited user: ${user.email} → ${editedEmail}`);
        
        // Verify user was edited
        await verifyUserExists(editedEmail);
        addDebugMessage(`Verified edited user exists: ${editedEmail}`);
        
        // Update email for cleanup
        user.email = editedEmail;
      }

      // Test invalid state: try to create duplicate user
      addDebugMessage('Testing duplicate user creation...');
      try {
        await createUser(testUsers[0].email, testUsers[0].role, true); // expectError=true
        // If we get here, the duplicate creation didn't fail as expected
        addDebugMessage('ERROR: Duplicate user creation should have failed but did not');
        dumpDebugMessages();
        throw new Error(`Duplicate user creation should have failed for email: ${testUsers[0].email}`);
      } catch (error) {
        // Check if it's our expected error or an actual validation error
        if (error instanceof Error && (
            error.message.includes('Duplicate user creation should have failed') ||
            error.message.includes('Expected duplicate user validation to fail')
        )) {
          throw error; // Re-throw our test failure
        }
        // This should fail - verify appropriate error handling
        addDebugMessage('Duplicate user creation correctly failed');
      }

      addDebugMessage('Test completed successfully');
      clearTimeout(timeoutHandler); // Clear timeout since test completed successfully
    } catch (error) {
      clearTimeout(timeoutHandler); // Clear timeout since we're handling the failure
      console.error('Test failed:', error);
      dumpDebugMessages(); // Show debug trail on test failure
      throw error; // Re-throw to fail the test
    }

  }, 60000);


  // Helper Functions
  async function findButtonByText(text: string[]): Promise<any> {
    return await page.evaluateHandle((texts) => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => 
        texts.some(text => btn.textContent?.includes(text))
      );
    }, text);
  }

  async function loginAsSuperAdmin() {
    addDebugMessage('Waiting for login form to load...');
    await page.waitForSelector('input[type="email"]');
    addDebugMessage('Login form loaded, filling credentials...');
    await page.type('input[type="email"]', 'superadmin@example.com');
    await page.type('input[type="password"]', 'admin');
    await page.click('button[type="submit"]');
    addDebugMessage('Login form submitted');
    
    // Wait for login to complete
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verify login was successful
    const content = await page.content();
    try {
      expect(content).not.toMatch('NEEMS Login');
      addDebugMessage('Login successful - no longer on login page');
    } catch (error) {
      addDebugMessage('ERROR: Login failed - still on login page');
      dumpDebugMessages();
      throw error;
    }
  }

  async function selectTestCompany() {
    // Look for "Company Selection" text to confirm the selector exists
    const content = await page.content();
    if (content.includes('Company Selection')) {
      addDebugMessage('Company Selection section found - user can select companies');
      
      // Wait for the company selector to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Use the new ID selector for the company dropdown
      const selectElement = await page.$('#company-selector');
      if (selectElement) {
        addDebugMessage('Company dropdown found by ID, clicking...');
        await selectElement.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Select first company that's not "Select Company"
        const menuItems = await page.$$('[role="listbox"] [role="option"]');
        addDebugMessage(`Available company options: ${menuItems.length}`);
        if (menuItems.length > 1) {
          await menuItems[1].click(); // Skip first item which is likely "Select Company"
          await new Promise(resolve => setTimeout(resolve, 2000));
          addDebugMessage('Company selected successfully');
        }
      } else {
        console.log('ERROR: Company Selection section exists but dropdown with ID not found');
        dumpDebugMessages();
      }
    } else {
      addDebugMessage('Company Selection section not found - user may not be super admin, checking for default company selection');
      // Wait longer for the page to load and automatically select the user's company
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check if we still see "Please select a company" message
      if (content.includes('Please select a company to manage users and sites')) {
        console.log('ERROR: No company selected - this indicates a problem with auto-selection');
        dumpDebugMessages();
        throw new Error('Admin page requires company selection but no company was auto-selected');
      } else {
        addDebugMessage('Company appears to be auto-selected, proceeding with test');
      }
    }
  }

  async function switchToUsersTab() {
    addDebugMessage('Looking for Users tab...');
    // Switch to Users tab (first tab)
    const userTab = await page.$('[role="tab"]:nth-child(1)');
    if (userTab) {
      addDebugMessage('Users tab found, clicking...');
      await userTab.click();
      await new Promise(resolve => setTimeout(resolve, 2000));
      addDebugMessage('Users tab clicked successfully');
    } else {
      console.log('ERROR: Users tab not found!');
      // Log available tabs for debugging
      const allTabs = await page.$$('[role="tab"]');
      console.log('Available tabs:', allTabs.length);
      dumpDebugMessages();
    }
  }

  async function createUser(email: string, role: string, expectError: boolean = false) {
    addDebugMessage(`Creating user: ${email} with role: ${role}`);
    // Look for "Add User" button
    const addButton = await findButtonByText(['Add User']);
    if (addButton && await addButton.evaluate((el: any) => !!el)) {
      addDebugMessage('Add User button found, clicking...');
      await addButton.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Wait for dialog and fill in user details
      await page.waitForSelector('[role="dialog"]');
      addDebugMessage('User creation dialog opened');
      
      // Fill email
      const emailInput = await page.$('[role="dialog"] input[type="email"]');
      if (emailInput) {
        await emailInput.type(email);
        addDebugMessage(`Filled email: ${email}`);
      }
      
      // Select role using radio buttons
      const roleRadio = await page.$(`[role="dialog"] input[value="${role}"]`);
      if (roleRadio) {
        await roleRadio.click();
        addDebugMessage(`Selected role: ${role}`);
      }
      
      // Click Create button
      const createButton = await findButtonByText(['Create']);
      if (createButton && await createButton.evaluate((el: any) => !!el)) {
        addDebugMessage('Clicking Create button...');
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
              addDebugMessage(`Server returned error: ${response.status()} - ${errorMessage}`);
            } catch (err) {
              serverError = { status: response.status(), message: 'Could not parse error response' };
              addDebugMessage(`Server returned error: ${response.status()} - Could not parse response`);
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
            addDebugMessage(`Server error detected: ${error.status} - ${error.message}`);
            
            // Verify the error message is displayed in the modal
            const dialogContent = await page.content();
            if (dialogContent.includes(error.message)) {
              addDebugMessage(`Error message "${error.message}" is properly displayed in modal`);
              throw new Error(`User creation failed with server validation: ${error.message}`);
            } else {
              addDebugMessage(`ERROR: Server returned error "${error.message}" but it's not displayed in the modal`);
              addDebugMessage('This indicates the UI is not properly handling server errors');
              throw new Error(`UI failed to display server error: ${error.message}`);
            }
          } else if (expectError) {
            // We expected an error but didn't get one - this is a validation failure
            addDebugMessage('ERROR: Expected server validation error but none occurred');
            addDebugMessage('This indicates duplicate validation is not working properly');
            throw new Error(`Expected duplicate user validation to fail for: ${email}`);
          }
          
          addDebugMessage('User creation completed');
        } finally {
          // Clean up event listener
          page.off('response', responseHandler);
        }
      }
    } else {
      addDebugMessage('ERROR: Add User button not found');
      dumpDebugMessages();
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
        const updateButton = await findButtonByText(['Update']);
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
      addDebugMessage(`User verification successful: ${email}`);
    } catch (error) {
      addDebugMessage(`ERROR: User not found on page: ${email}`);
      dumpDebugMessages(); // Show debug trail on verification failure
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
            const confirmButton = await findButtonByText(['Delete']);
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
