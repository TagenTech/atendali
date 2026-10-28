const { chromium } = require('/Users/filipegonzaga/Documents/clinicas/node_modules/.pnpm/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 600 } });
  await p.goto('file://' + __dirname + '/capa.html');
  await p.screenshot({ path: 'capa.png', clip: { x: 0, y: 0, width: 1600, height: 600 } });
  const l = await b.newPage({ viewport: { width: 512, height: 512 } });
  await l.goto('file://' + __dirname + '/logo.svg');
  await l.screenshot({ path: 'logo.png', omitBackground: true });
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
