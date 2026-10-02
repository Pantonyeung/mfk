import {defineConfig,devices} from '@playwright/test';

const port=Number(process.env.PLAYWRIGHT_PORT??4193);

export default defineConfig({
  testDir:'./test',
  timeout:30_000,
  fullyParallel:false,
  use:{
    baseURL:`http://127.0.0.1:${port}`,
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
    video:'off'
  },
  webServer:{
    command:`npm run dev -- --port ${port} --strictPort`,
    url:`http://127.0.0.1:${port}`,
    reuseExistingServer:false,
    timeout:60_000
  },
  projects:[
    {name:'chromium-390',use:{...devices['Desktop Chrome'],channel:process.env.PLAYWRIGHT_CHANNEL,viewport:{width:390,height:844}}},
  ]
});
