const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');

const root = path.resolve(__dirname, '..');
// Copyright © 2026 HacknFix. Developed by Pritam Nath Dipta. All rights reserved.
const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'gmit-logo-white.png')).toString('base64');

(async () => {
  const browser = await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
    await page.setContent(`<!doctype html><html lang="bn"><meta charset="utf-8"><style>
      *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%}
      body{font-family:'Nirmala UI','Hind Siliguri',sans-serif;color:#fff;
        background:radial-gradient(circle at 83% 45%,#5474b2 0%,#293d75 32%,#14234d 68%,#101a3b 100%);overflow:hidden}
      main{position:relative;width:1200px;height:630px;padding:62px 76px}
      main:before{content:"";position:absolute;width:500px;height:500px;right:-90px;top:50px;border:1px solid #ffffff2a;border-radius:50%;box-shadow:0 0 0 75px #ffffff08,0 0 0 150px #ffffff08}
      .logo{width:286px;height:112px;padding:20px 24px;border:1px solid #ffffff3c;border-radius:20px;background:#101a3b8c;display:grid;place-items:center}
      .logo img{width:100%;height:100%;object-fit:contain}
      .eyebrow{margin-top:45px;color:#cbd8fb;font:700 24px Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase}
      h1{position:relative;z-index:1;margin:16px 0 0;font-size:58px;line-height:1.22;max-width:1040px;text-shadow:0 3px 12px #101a3b55}
      p{font:400 29px Arial,sans-serif;color:#dbe6ff;margin:16px 0 0}
      .rule{width:95px;height:7px;border-radius:6px;background:#9db9ff;margin-top:35px}
      .footer{position:absolute;bottom:42px;left:76px;font:600 21px Arial,sans-serif;color:#cbd8fb}
    </style><main><div class="logo"><img src="${logo}" alt="GM IT"></div>
      <div class="eyebrow">Cyber Security Awareness Quiz</div>
      <h1>আপনি কতটা সাইবার সচেতন?</h1><p>How cyber aware are you?</p><div class="rule"></div>
      <div class="footer">GM IT · Developed by HacknFix</div></main></html>`);
    await page.locator('.logo img').evaluate(img=>img.decode());
    await page.screenshot({path:path.join(root,'og-image.png')});

    await page.setViewportSize({width:512,height:512});
    await page.setContent(`<!doctype html><html><meta charset="utf-8"><style>
      *{box-sizing:border-box}html,body{width:512px;height:512px;margin:0}
      body{display:grid;place-items:center;border-radius:104px;overflow:hidden;background:linear-gradient(145deg,#344b82,#1b2653 68%,#101a3b)}
      img{display:block;width:405px;height:230px;object-fit:contain}
    </style><img src="${logo}" alt="GM IT"></html>`);
    await page.locator('img').evaluate(img=>img.decode());
    await page.screenshot({path:path.join(root,'icon-512.png')});
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
