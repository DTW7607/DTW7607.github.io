// Run with Node.js and jsdom available (npm install --no-save jsdom).
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const root=require('node:path').resolve(__dirname,'..');
const html=fs.readFileSync(root+'/index.html','utf8');
assert.equal(html,fs.readFileSync(root+'/huarongdao/index.html','utf8'));
const source=html.split('<script type="module">')[1].split('</script>')[0];
function setup(languages,options={}){
 const dom=new JSDOM(html,{url:'https://example.test'+(options.path||'/'),runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;
 w.Element.prototype.getAnimations=()=>[];
 w.matchMedia=q=>({matches:q.includes('reduced-motion')||Boolean(options.mobile&&q.includes('900px')),addEventListener(){}});
 w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
 w.Worker=class{addEventListener(){}postMessage(){}terminate(){}};
 Object.defineProperty(w.navigator,'languages',{get(){if(options.failNavigator)throw Error('blocked');return languages;}});
 Object.defineProperty(w.navigator,'language',{value:options.fallback||'zh-CN'});
 if(options.saved)w.localStorage.setItem('huarongdao.language',options.saved);
 if(options.failStorage)Object.defineProperty(w,'localStorage',{get(){throw Error('blocked');}});
 w.eval(source+`;window.testGame={game,render,prediction,celebrate,toast,validateLayout,EN,t};`);
 return {dom,w,d:w.document,close:()=>w.close()};
}
function lang(env,value){assert.equal(env.d.documentElement.lang,value);assert.equal(env.d.querySelector(`[data-language="${value==='en'?'en':'zh'}"]`).getAttribute('aria-pressed'),'true');}
function cleanEnglish(env){
 for(const e of env.d.querySelectorAll('[aria-label]'))if(!e.closest('.language-picker'))assert(!/[\p{Script=Han}]/u.test(e.getAttribute('aria-label')),e.outerHTML);
 const walker=env.d.createTreeWalker(env.d.body,env.w.NodeFilter.SHOW_TEXT);
 while(walker.nextNode()){const n=walker.currentNode;if(n.parentElement.closest('script,.language-picker'))continue;assert(!/[\p{Script=Han}]/u.test(n.textContent),n.textContent);}
}
(async()=>{
for(const [langs,expected,opts] of [
 [['zh-CN'],'zh-CN'],[['zh-TW'],'zh-CN'],[['zh-Hant-TW'],'zh-CN'],[['en-US'],'en'],[['en-GB'],'en'],[['EN-gb'],'en'],[['fr-FR'],'zh-CN'],[['fr','en-GB','zh-CN'],'en'],[['fr','zh-TW','en-US'],'zh-CN'],[[],'en',{fallback:'en-GB'}],[['en'],'zh-CN',{failNavigator:true}],[['en'],'zh-CN',{saved:'zh'}],[['zh'],'en',{saved:'en'}],[['en'],'en',{saved:'invalid'}],
 ]){const e=setup(langs,opts);lang(e,expected);if(expected==='en')cleanEnglish(e);e.close();}
for(const mobile of [false,true])for(const langs of [['zh-CN'],['en-GB']]){
 const e=setup(langs,{mobile}),{d,w}=e,g=w.testGame;
 const initial=g.game.pieces.map(p=>({...p}));
 d.querySelector('[data-language=en]').click();lang(e,'en');cleanEnglish(e);
 assert.equal(w.localStorage.getItem('huarongdao.language'),'en');
 const persisted=w.localStorage.getItem('huarongdao.language');
 const refresh=setup(['zh-CN'],{saved:persisted,mobile,path:'/huarongdao/'});lang(refresh,'en');cleanEnglish(refresh);refresh.close();
 assert.equal(JSON.stringify(g.game.pieces),JSON.stringify(initial));
 d.querySelector('.move-arrow:not([hidden])').click();await new Promise(resolve=>setImmediate(resolve));assert.equal(g.game.history.length,1);
 d.querySelector('[data-language=zh]').click();lang(e,'zh-CN');assert.equal(d.querySelector('#layout-title').textContent,'横刀立马');
 assert.equal(g.game.history.length,1);d.querySelector('#undo-button').click();await new Promise(resolve=>setImmediate(resolve));assert.equal(g.game.history.length,0);
 d.querySelector('[data-language=en]').click();
 d.querySelector('#edit-toggle').click();assert.equal(g.game.phase,'editing');cleanEnglish(e);
 d.querySelector('#copy-layout').click();assert.equal(g.game.phase,'playing');
 d.querySelector('#restart-button').click();assert.equal(g.game.history.length,0);
 for(const status of ['checking','unsolvable','error','limit']){g.prediction.current.status=status;d.querySelector('#hint-button').click();g.prediction.current.status=status;g.render();cleanEnglish(e);d.querySelector('#hint-button').click();}
 g.game.phase='won';g.celebrate();g.render();cleanEnglish(e);
 d.querySelector('[data-language=zh]').click();assert(d.querySelector('#win-summary').textContent.includes('步'));assert.equal(d.querySelector('#restart-button').textContent,'再来一局');
 g.toast('空间不足');d.querySelector('[data-language=en]').click();assert.equal(d.querySelector('#toast').textContent,'Not enough space');
 e.close();
}
const blocked=setup(['en-US'],{failStorage:true});lang(blocked,'en');blocked.d.querySelector('[data-language=zh]').click();lang(blocked,'zh-CN');blocked.d.querySelector('[data-language=en]').click();cleanEnglish(blocked);blocked.close();
console.log('PASS: both entry points; browser language priority/variants/fallback; saved preference/reload/navigation; blocked storage; desktop/mobile state; translations/accessibility text; moves/undo/editor/restart/hints/victory.');

})().catch(error=>{console.error(error);process.exitCode=1;});
