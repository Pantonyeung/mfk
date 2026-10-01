import {defineConfig,devices} from '@playwright/test';

export default defineConfig({
  testDir:'./test',
  timeout:30_000,
  fullyParallel:false,
  use:{
    baseURL:'http://127.0.0.1:4175',
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
    video:'off'
  },
  webServer:{
    command:'npm run dev -- --port 4175',
    url:'http://127.0.0.1:4175',
    reuseExistingServer:true,
    timeout:60_000
  },
  projects:[
    {name:'chromium-390',use:{...devices['Desktop Chrome'],viewport:{width:390,height:844}}},
  ]
});
