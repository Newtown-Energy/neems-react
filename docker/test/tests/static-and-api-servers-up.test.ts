describe('NEEMS React App Tests', () => {
  beforeAll(async () => {
    await page.goto(process.env.NEEMS_CORE_SERVER || 'http://nginx');
  });

  // Test that we can load the home page, render the REACT, show the login page, and find the NEEMS EMS text.
  it('should load the home page', async () => {
    const content = await page.content();
    expect(content).toMatch('NEEMS EMS');
  });

  it('should hit API endpoints', async () => {
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/1/status');
      return await res.json();
    });
    
    expect(response).toEqual({"status":"running"});
  });

});
