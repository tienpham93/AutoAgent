import playwright from 'playwright';
import repl from 'repl';

async function startInteractiveSession() {
  console.log('Launching browser and navigating to Agoda...');
  const browser = await playwright.chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://www.agoda.com/');

  console.log('Browser is ready. Starting Node.js REPL.');
  console.log('You can now use `browser` and `page` objects interactively.');

  // Start the REPL
  const r = repl.start({
    prompt: 'playwright> ',
    useGlobal: true,
    ignoreUndefined: true,
    useColors: true,
  });

  // Expose the browser and page objects to the REPL context
  r.context.browser = browser;
  r.context.page = page;

  // Optional: Handle cleanup when the user exits the REPL
  r.on('exit', async () => {
    console.log('Exiting REPL. Closing browser...');
    await browser.close();
    process.exit();
  });
}

startInteractiveSession().catch(console.error);
