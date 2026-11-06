import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests',
  timeout:120_000,
  expect:{timeout:15_000},
  retries:0,
  use:{headless:true,browserName:'chromium',acceptDownloads:true,
    launchOptions:{args:['--autoplay-policy=no-user-gesture-required','--use-fake-ui-for-media-stream']}},
  webServer:{command:'python3 -m http.server 8765 --bind 127.0.0.1',url:'http://127.0.0.1:8765',reuseExistingServer:!process.env.CI,timeout:20_000}
});
