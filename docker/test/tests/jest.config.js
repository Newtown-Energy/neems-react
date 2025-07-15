
module.exports = {
  preset: 'jest-puppeteer',
  testMatch: ['**/*.test.js'],
  testTimeout: 30000,
  globalSetup: 'jest-environment-puppeteer/setup',
  globalTeardown: 'jest-environment-puppeteer/teardown',
  testEnvironment: 'jest-environment-puppeteer'
}
