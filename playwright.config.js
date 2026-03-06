const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './test/e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:18889',
    headless: true,
  },
  webServer: {
    command: 'npx http-server web -p 18889 -c-1 --silent',
    port: 18889,
    reuseExistingServer: true,
  },
});
