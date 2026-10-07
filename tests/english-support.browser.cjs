// Run with Playwright available; optionally set CHROMIUM_EXECUTABLE and SCREENSHOT_DIR.
const {chromium}=require('playwright');
const root=require('node:path').resolve(__dirname,'..');
const server=require('node:http').createServer((req,res)=>{const fs=require('node:fs');res.setHeader('Content-Type','text/html');res.end(fs.readFileSync(root+(req.url==='/huarongdao/'?'/huarongdao/index.html':'/index.html')))});
const assert=require('node:assert/strict');
(async()=>{await new Promise(r=>server.listen(8765,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--disable-gpu','--no-zygote'],headless:true});
let checks=0;
for(const langs of [['zh-CN'],['zh-TW'],['en-US'],['en-GB'],['fr'],['fr','en-GB','zh'],['fr','zh-TW','en']]){
 const c=await browser.newContext();await c.addInitScript(ls=>Object.defineProperty(navigator,'languages',{value:ls}),langs);const p=await c.newPage();await p.goto('http://127.0.0.1:8765/');await p.waitForSelector('.preset',{state:'attached'});assert.equal(await p.locator('html').getAttribute('lang'),langs.find(x=>/^(en|zh)/.test(x))?.startsWith('en')?'en':'zh-CN');checks++;await c.close();
}
for(const width of [320,375,390,768,1280])for(const locale of ['zh-CN','en-GB']){
 const c=await browser.newContext({viewport:{width,height:width===1280?900:844},locale,reducedMotion:'reduce'});const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8765/');await p.waitForSelector('.preset',{state:'attached'});
 await p.locator('[data-language=en]').focus();await p.keyboard.press('Enter');assert.equal(await p.locator('html').getAttribute('lang'),'en');
 assert.equal(await p.evaluate(()=>localStorage.getItem('huarongdao.language')),'en');
 assert(await p.evaluate(()=>[...document.querySelectorAll('.masthead a,.masthead button')].filter(e=>e.getBoundingClientRect().width).every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})),`header overflow ${width}`);
 await p.reload();assert.equal(await p.locator('html').getAttribute('lang'),'en');await p.goto('http://127.0.0.1:8765/huarongdao/');assert.equal(await p.locator('html').getAttribute('lang'),'en');
 await p.locator('[data-language=zh]').focus();await p.keyboard.press('Space');assert.equal(await p.locator('html').getAttribute('lang'),'zh-CN');
 await p.locator('.move-arrow:not([hidden])').first().focus();await p.keyboard.press('Enter');await p.waitForFunction(()=>document.querySelector('#move-count').textContent==='1');await p.keyboard.press('z');await p.waitForFunction(()=>document.querySelector('#move-count').textContent==='0');
 await p.locator('[data-language=en]').click();await p.locator('#rules-button').click();assert.equal(await p.locator('#rules-dialog h2').innerText(),'How to play');await p.keyboard.press('Escape');
 await p.locator('#edit-toggle').click();assert.equal(await p.locator('body').getAttribute('data-phase'),'editing');await p.locator('#copy-layout').click();assert.equal(await p.locator('body').getAttribute('data-phase'),'playing');
 await p.locator('#hint-button').click();await p.waitForFunction(()=>document.querySelector('#hint-button').getAttribute('aria-busy')==='false');assert(!/[\p{Script=Han}]/u.test(await p.locator('#hint-status').textContent()));
 if(process.env.SCREENSHOT_DIR)await p.screenshot({path:require('node:path').join(process.env.SCREENSHOT_DIR,`english-${width}-${locale}.png`)});assert.deepEqual(errors,[]);checks++;await c.close();
}
const c=await browser.newContext({locale:'en-US'});await c.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw Error('unavailable')}}));const p=await c.newPage();await p.goto('http://127.0.0.1:8765/');await p.locator('[data-language=zh]').click();assert.equal(await p.locator('html').getAttribute('lang'),'zh-CN');await c.close();
await browser.close();server.close();console.log(`PASS ${checks+1} browser scenarios: defaults/variants/fallback, keyboard Enter/Space, persistence/navigation, 320–1280px header bounds, game regression and worker hints, blocked storage.`);
})().catch(e=>{console.error(e);server.close();process.exit(1)});
