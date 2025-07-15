// tests/jest-puppeteer.config.js
module.exports = {
  launch: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--single-process',
      '--no-zygote'
    ]
  }
}
