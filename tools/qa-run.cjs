// Full four-seal run + Menu → Reset progress, driven through the real UI/keys with debug warps.
const puppeteer=require(process.env.PUPPETEER_CORE);const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:600000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage();await p.setViewport({width:800,height:500});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto('http://localhost:8090/?q=lite',{waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});
await p.click('#begin');await sleep(1500);
const Q=()=>p.evaluate(()=>window.__vale.quest());const log=(k,v)=>console.log(k,JSON.stringify(v));
let q=await Q();await p.evaluate((x,z)=>window.__vale.warp(x,z+1.5),q.wayfinder.x,q.wayfinder.z);await sleep(1500);
log('near wayfinder',(await Q()).near);await p.keyboard.press('KeyE');await sleep(800);q=await Q();log('dialog',{talking:q.talking,dlg:q.dlg,started:q.save.started});
for(let i=0;i<4;i++){await p.keyboard.press('Space');await sleep(400);}log('closed',(await Q()).talking);
for(const s of q.seals){await p.evaluate((x,z)=>window.__vale.warp(x+1.5,z+1.2),s.x,s.z);await sleep(1500);const n=(await Q()).near;await p.keyboard.press('KeyE');await sleep(700);const qq=await Q();log('seal '+s.id,{near:n,claimed:qq.save.seals[s.id],xp:qq.save.xp,toast:await p.$eval('#toast',e=>e.textContent)});}
// finale: cine → Wayfinder completion dialogue → chapter card
await p.waitForFunction('window.__vale.quest().cine',{timeout:60000}).catch(()=>{});log('cine started',(await Q()).cine);
await p.waitForFunction('window.__vale.quest().talking',{timeout:300000});q=await Q();log('completion dialog',{dlg:q.dlg,done:q.save.done,xp:q.save.xp});
for(let i=0;i<5&&(await Q()).talking;i++){await p.keyboard.press('Space');await sleep(400);}
q=await Q();log('chapter card',{chapter:q.chapter,text:await p.$eval('#chapter',e=>e.innerText.replace(/\n+/g,' | '))});
await p.screenshot({path:'shots/qa-chapter.png'});await p.click('#chok');await sleep(500);log('chapter closed',!(await Q()).chapter);
log('stored',await p.evaluate(()=>localStorage.getItem('vale3d-save')));
// Wind Shrine: tablet → wrong combination (feedback, 0 XP) → right combination (+35 once, blessing) → no farming → reload persists
const R=await p.evaluate(()=>({runes:window.__vale.runes,tablet:window.__vale.tablet}));const xp0=(await Q()).save.xp;
const toastTxt=()=>p.$eval('#toast',e=>e.textContent);
await p.evaluate((x,z)=>window.__vale.warp(x,z+1.3),R.tablet.x,R.tablet.z);await sleep(1200);log('near tablet',(await Q()).near);
await p.keyboard.press('KeyE');await sleep(600);log('tablet',(await Q()).dlg);for(let i=0;i<4&&(await Q()).talking;i++){await p.keyboard.press('Space');await sleep(300);}
const turn=async(i)=>{await p.evaluate((x,z)=>window.__vale.warp(x,z+1.4),R.runes[i].x,R.runes[i].z);await sleep(900);const near=(await Q()).near;await p.keyboard.press('KeyE');await sleep(500);const q=await Q();return {near,runes:q.save.runes,wind:q.save.wind,xp:q.save.xp,toast:await toastTxt()};};
log('west→Rise',await turn(0));log('north→Rise (wrong)',await turn(1));log('east→Rise (wrong)',await turn(2));
let wq=await Q();log('wrong combo: xp unchanged',{xp:wq.save.xp,xp0,wind:wq.save.wind,ok:wq.save.xp===xp0&&!wq.save.wind});
log('north→Gale',await turn(1));log('north→Still',await turn(1));const solved=await turn(2);log('east→Gale (solve)',solved);
await sleep(600);log('solve dialog',(await Q()).dlg);for(let i=0;i<4&&(await Q()).talking;i++){await p.keyboard.press('Space');await sleep(300);}
const again=await turn(0);log('turn after solve (no farming)',{xp:again.xp,toast:again.toast,runes:again.runes});
log('shrine xp once',{gain:solved.xp-xp0,afterRepeat:again.xp-xp0,speedMul:await p.evaluate(()=>window.__vale.speedMul())});
await p.reload({waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(800);
if(await p.evaluate(()=>!document.getElementById('create').hidden&&getComputedStyle(document.getElementById('create')).display!=='none')){await p.click('#begin');await sleep(800);}
wq=await Q();log('after reload (persisted)',{wind:wq.save.wind,runes:wq.save.runes,xp:wq.save.xp,done:wq.save.done,wtext:await p.$eval('#wtext',e=>e.textContent)});
// Menu → Reset progress (tap twice) → reload with a fresh save
await p.click('#menubtn');await sleep(300);await p.click('#reset');await sleep(300);log('reset armed',await p.$eval('#reset',e=>e.textContent));
await Promise.all([p.waitForNavigation({timeout:120000}),p.click('#reset')]);
await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(1000);
log('after reset',{save:(await Q()).save,wtext:await p.$eval('#wtext',e=>e.textContent),stored:await p.evaluate(()=>localStorage.getItem('vale3d-save')),profileKept:await p.evaluate(()=>!!localStorage.getItem('vale3d-hero'))});
log('errors',[...errs,...await p.evaluate(()=>window.__vale.errors)]);await b.close();})().catch(e=>{console.log('ERR',e.message);process.exit(1)});
