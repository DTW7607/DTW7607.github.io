// NODE_PATH can point to external test dependencies; no packages are needed by the site.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const original = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const test = fs.readFileSync(path.join(root, 'test/index.html'), 'utf8');
const stripped = test
  .replace(/\/\* HIT_REGIONS_STYLE_START \*\/[\s\S]*?\/\* HIT_REGIONS_STYLE_END \*\/\n/, '')
  .replace(/^.*<svg id="hit-regions".*\n/m, '')
  .replace(/\/\/ HIT_REGIONS_SCRIPT_START[\s\S]*?\/\/ HIT_REGIONS_SCRIPT_END\n\n/, '')
  .replace('renderArrows(); renderHitRegions(); renderHints();', 'renderArrows(); renderHints();');
assert.equal(stripped, original, 'test page must preserve every original game feature');
assert.equal(original, fs.readFileSync(path.join(root, 'huarongdao/index.html'), 'utf8'));
const expose = 'window.hitTest={game,render,moveRegions,pickGameMove,metrics,key,PRESETS,get drag(){return drag},get active(){return playback.active}};';
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(test.replace('</script>', expose + '</script>'));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_EXECUTABLE || undefined});
  try {
    let layouts = 0, clicks = 0, samples = 0;
    for (const viewport of [{width:320,height:844},{width:390,height:844},{width:768,height:1024},{width:1280,height:900},{width:844,height:390}]) {
      const context = await browser.newContext({viewport, locale:'zh-CN', reducedMotion:'reduce'});
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/test/`);
      await page.waitForSelector('#hit-regions polygon', {state:'attached'});
      assert.equal(await page.locator('#hit-regions').evaluate(e => getComputedStyle(e).pointerEvents), 'none');
      for (let preset=0;preset<8;preset++) {
        await page.evaluate(i => {hitTest.game.selectPreset(i);hitTest.render()}, preset);
        const checked = await page.evaluate(() => {
          const {game,metrics,moveRegions,pickGameMove,key} = hitTest;
          const cells = moveRegions(game.pieces), m = metrics();
          const shapes = [...document.querySelectorAll('#hit-regions polygon')].map(e => ({action:e.dataset.action,points:[...e.points].map(p=>({x:p.x,y:p.y}))}));
          const contains = (pts,x,y) => {
            let inside=false;
            for(let i=0,j=pts.length-1;i<pts.length;j=i++) {
              const a=pts[i],b=pts[j];
              if((a.y>y)!==(b.y>y) && x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
            }
            return inside;
          };
          let samples=0;
          for(const cell of cells)for(let yi=0;yi<25;yi++)for(let xi=0;xi<25;xi++) {
            // Avoid exact bisectors: hit tests have a deterministic tie priority.
            const x=cell.x+(xi+.371)/25,y=cell.y+(yi+.613)/25;
            const expected=pickGameMove(cells,x,y,{x:m.cellX,y:m.cellY});
            const actual=shapes.filter(s=>contains(s.points,x,y));
            if(expected?actual.length!==1||actual[0].action!==key(expected):actual.length!==0)throw Error(`region mismatch ${x},${y}`);
            samples++;
          }
          const totalArea=shapes.reduce((sum,s)=>sum+Math.abs(s.points.reduce((a,p,i)=>{const q=s.points[(i+1)%s.points.length];return a+p.x*q.y-q.x*p.y},0))/2,0);
          const activeCells=cells.filter(c=>pickGameMove(cells,c.x+.371,c.y+.613,{x:m.cellX,y:m.cellY}));
          if(Math.abs(totalArea-activeCells.length)>1e-7)throw Error('regions do not cover the active empty cells');
          const points=shapes.map(s=>({action:s.action,x:s.points.reduce((a,p)=>a+p.x,0)/s.points.length,y:s.points.reduce((a,p)=>a+p.y,0)/s.points.length}));
          for(const p of points) {
            const arrow=document.querySelector(`.move-arrow[data-piece-id="${p.action.split(':')[0]}"][data-direction="${p.action.split(':')[1]}"]`);
            if(!arrow||arrow.hidden)throw Error('region has no visible arrow');
            const shape=document.querySelector(`#hit-regions polygon[data-action="${p.action}"]`);
            if(arrow.style.getPropertyValue('--region-color')!==shape.style.getPropertyValue('--region-color'))throw Error('arrow color mismatch');
          }
          return {samples,points};
        });
        samples+=checked.samples;layouts++;
        // Click the interior of every polygon through the actual board listener.
        for(const target of checked.points) {
          await page.evaluate(i=>{hitTest.game.selectPreset(i);hitTest.render()},preset);
          const m=await page.evaluate(()=>hitTest.metrics());
          await page.mouse.click(m.left+target.x*m.cellX,m.top+target.y*m.cellY);
          await page.waitForFunction(()=>hitTest.game.history.length===1&&!hitTest.active);
          assert.equal(await page.evaluate(()=>hitTest.game.history[0].selected),Number(target.action.split(':')[0]));
          const moved=await page.evaluate(()=>({old:hitTest.game.history[0].pieces.find(p=>p.id===hitTest.game.selected),now:hitTest.game.pieces.find(p=>p.id===hitTest.game.selected)}));
          const delta={up:[0,-1],right:[1,0],down:[0,1],left:[-1,0]}[target.action.split(':')[1]];
          assert.deepEqual([moved.now.x-moved.old.x,moved.now.y-moved.old.y],delta);
          clicks++;
        }
      }
      await page.evaluate(()=>{hitTest.game.selectPreset(0);hitTest.render()});
      const before=await page.locator('#hit-regions').innerHTML();
      await page.locator('#hint-button').click();
      assert.equal(await page.locator('#hit-regions').innerHTML(),before,'hint animation must not change regions');
      await page.locator('[data-language=en]').click();
      assert.equal(await page.locator('#hit-regions').innerHTML(),before,'translation must not change regions');
      await page.locator('#edit-toggle').click();
      assert.equal(await page.locator('#hit-regions').evaluate(e=>e.hidden),true);
      await page.locator('#copy-layout').click();
      await page.waitForSelector('#hit-regions polygon',{state:'attached'});
      const m=await page.evaluate(()=>hitTest.metrics());
      const piece=await page.evaluate(()=>hitTest.game.pieces.find(p=>p.id===6));
      await page.mouse.move(m.left+(piece.x+.5)*m.cellX,m.top+(piece.y+.5)*m.cellY);
      await page.mouse.down();await page.mouse.move(m.left+(piece.x+.5)*m.cellX+12,m.top+(piece.y+.5)*m.cellY,{steps:3});
      assert.equal(await page.locator('#hit-regions').evaluate(e=>e.hidden),true,'hide while dragging');
      await page.mouse.up();await page.waitForFunction(()=>!hitTest.drag&&!hitTest.active);
      await page.evaluate(()=>{hitTest.game.phase='won';hitTest.render()});
      assert.equal(await page.locator('#hit-regions').evaluate(e=>e.hidden),true);
      assert.deepEqual(errors,[]);
      if(process.env.SCREENSHOT_DIR) {
        await page.evaluate(()=>{hitTest.game.selectPreset(0);hitTest.render()});
        await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,`hit-regions-${viewport.width}.png`)});
      }
      await context.close();
    }
    console.log(`PASS: ${layouts} layouts at five viewport sizes, ${samples} region samples, ${clicks} actual polygon clicks; colors, hints, language, editor, drag and victory; original game unchanged.`);
  } finally {await browser.close();server.close()}
})().catch(error=>{console.error(error);server.close();process.exitCode=1});
