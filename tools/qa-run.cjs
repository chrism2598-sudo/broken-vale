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
// Hollow Beacon locked before the seals
const B0=await p.evaluate(()=>window.__vale.beacon());await p.evaluate((x,z)=>window.__vale.warp(x,z+3),B0.updraft.x,B0.updraft.z);await sleep(1200);
log('updraft before seals',(await Q()).near);await p.keyboard.press('KeyE');await sleep(600);log('locked',{dlg:(await Q()).dlg,lift:(await p.evaluate(()=>window.__vale.beacon())).lift});
for(let i=0;i<4&&(await Q()).talking;i++){await p.keyboard.press('Space');await sleep(300);}
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
// Vale Warden: take hits → defeat → recovery keeps XP; then defeat the Warden (+40 once); reload persists
const W=await p.evaluate(()=>window.__vale.warden());const xpW0=(await Q()).save.xp;
const nearW=async(off)=>{const dx=0-W.x,dz=6-W.z,d=Math.hypot(dx,dz);await p.evaluate((x,z)=>window.__vale.warp(x,z),W.x+dx/d*off,W.z+dz/d*off);};
await nearW(2.6);const hpLog=[];
for(let i=0;i<200;i++){await sleep(500);const w=await p.evaluate(()=>window.__vale.warden());hpLog.push(w.playerHp);if((await Q()).talking)break;}
let qd=await Q();const wAfter=await p.evaluate(()=>window.__vale.warden());const pos=await p.evaluate(()=>{const v=window.__vale.debug.player.position;return {x:v.x,z:v.z};});
log('defeated by Warden → recovery',{hpSeq:[...new Set(hpLog)],dialog:qd.dlg,playerHp:wAfter.playerHp,wardenHp:wAfter.hp,xpKept:qd.save.xp===xpW0,xp:qd.save.xp,distFromRecovery:+Math.hypot(pos.x-W.recovery.x,pos.z-W.recovery.z).toFixed(1),distFromWarden:+Math.hypot(pos.x-W.x,pos.z-W.z).toFixed(1)});
for(let i=0;i<4&&(await Q()).talking;i++){await p.keyboard.press('Space');await sleep(300);}
await nearW(2.6);await sleep(700);log('near warden label',(await Q()).near);
const atk=[];for(let i=0;i<12&&!(await Q()).save.warden;i++){await p.keyboard.press('KeyE');await sleep(150);const w=await p.evaluate(()=>window.__vale.warden());atk.push({hp:w.hp,cd:+w.atkCd.toFixed(2),toast:await toastTxt()});await sleep(550);if((await Q()).talking){for(let j=0;j<4&&(await Q()).talking;j++){await p.keyboard.press('Space');await sleep(300);}await nearW(2.6);await sleep(500);}}
qd=await Q();log('attacks',atk.slice(0,6));log('warden defeated',{warden:qd.save.warden,xpGain:qd.save.xp-xpW0,toast:await toastTxt()});
await p.keyboard.press('KeyE');await sleep(400);await p.keyboard.press('KeyE');await sleep(400);log('no farming',{xpGain:(await Q()).save.xp-xpW0,near:(await Q()).near,phase:(await p.evaluate(()=>window.__vale.warden())).phase});
await p.reload({waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(800);
qd=await Q();log('after reload (warden persisted)',{warden:qd.save.warden,xp:qd.save.xp,phase:(await p.evaluate(()=>window.__vale.warden())).phase,wdtext:await p.$eval('#wdtext',e=>e.textContent)});
// Hollow Beacon: Updraft → island → carving → wrong mirror → right mirrors → dawn ending (+60 once) → ride down → reload persists
const closeDlg=async()=>{for(let i=0;i<5&&(await Q()).talking;i++){await p.keyboard.press('Space');await sleep(300);}};
const xpB0=(await Q()).save.xp;let B=await p.evaluate(()=>window.__vale.beacon());
await p.evaluate((x,z)=>window.__vale.warp(x,z+3),B.updraft.x,B.updraft.z);await sleep(1200);log('updraft after seals + shrine',(await Q()).near);
await p.keyboard.press('KeyE');await sleep(300);log('lift started',(await p.evaluate(()=>window.__vale.beacon())).lift);
await p.waitForFunction('window.__vale.beacon().onIsland&&!window.__vale.beacon().lift',{timeout:240000});await sleep(800);
B=await p.evaluate(()=>window.__vale.beacon());log('on island',{onIsland:B.onIsland,qline:await p.$eval('#qline',e=>e.textContent),y:await p.evaluate(()=>+window.__vale.debug.player.position.y.toFixed(1))});
await p.evaluate((x,z)=>window.__vale.warp(x,z),B.clueW.x+1.5,B.clueW.z+0.6);await sleep(900);log('near carving',(await Q()).near);await p.keyboard.press('KeyE');await sleep(500);log('carving',(await Q()).dlg);await closeDlg();
const atMirror=async(i)=>{await p.evaluate((x,z)=>window.__vale.warp(x,z),B.mirrorW[i].x+1.6,B.mirrorW[i].z);await sleep(800);};
const pressM=async()=>{await p.keyboard.press('KeyE');await sleep(450);const b=await p.evaluate(()=>window.__vale.beacon());return {mirrors:b.mirrors,cine:b.cine,toast:await toastTxt()};};
await atMirror(0);log('near Pale',(await Q()).near);const wrong=await pressM();await sleep(1500);
log('wrong mirror (Pale→East)',{...wrong,cineAfter:(await p.evaluate(()=>window.__vale.beacon())).cine,xpUnchanged:(await Q()).save.xp===xpB0});
for(let i=0;i<4;i++){const b=await p.evaluate(()=>window.__vale.beacon());const n=(b.solve[i]-b.mirrors[i]+4)%4;if(!n)continue;await atMirror(i);let r;for(let k=0;k<n;k++)r=await pressM();log('mirror '+i+' set',r);}
await p.waitForFunction('window.__vale.beacon().cine||window.__vale.beacon().beacon',{timeout:60000});log('dawn ending started',(await p.evaluate(()=>window.__vale.beacon())).cine);
await p.waitForFunction('window.__vale.beacon().ending',{timeout:400000});B=await p.evaluate(()=>window.__vale.beacon());
log('ending card',{beacon:B.beacon,dawn:B.dawn,xpGain:(await Q()).save.xp-xpB0,text:B.endingText.replace(/\n+/g,' | ').slice(0,260)});
await p.screenshot({path:'shots/qa-ending.png'});await p.click('#endok');await sleep(500);
await atMirror(1);const againM=await pressM();log('mirror after dawn (no farming)',{...againM,xpGain:(await Q()).save.xp-xpB0});
B=await p.evaluate(()=>window.__vale.beacon());await p.evaluate((x,z)=>window.__vale.warp(x,z),B.returnW.x,B.returnW.z);await sleep(800);log('near return',(await Q()).near);await p.keyboard.press('KeyE');
await p.waitForFunction('!window.__vale.beacon().onIsland&&!window.__vale.beacon().lift',{timeout:240000});await sleep(500);
B=await p.evaluate(()=>window.__vale.beacon());const pd=await p.evaluate(()=>{const v=window.__vale.debug.player.position;return {x:v.x,z:v.z};});log('rode down',{onIsland:B.onIsland,distFromUpdraft:+Math.hypot(pd.x-B.updraft.x,pd.z-B.updraft.z).toFixed(1)});
await p.reload({waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(1200);
B=await p.evaluate(()=>window.__vale.beacon());log('after reload (beacon persisted)',{beacon:B.beacon,dawn:B.dawn,mirrors:B.mirrors,xp:(await Q()).save.xp,qline:await p.$eval('#qline',e=>e.textContent)});
// Journal / Map: open, state, input paused, close
const ppos=()=>p.evaluate(()=>{const v=window.__vale.debug.player.position;return {x:v.x,z:v.z};});
await p.keyboard.press('KeyJ');await sleep(500);let sh=await p.evaluate(()=>window.__vale.sheets());
log('journal open (J)',{open:sh.journal,paused:sh.paused,seals:/Forge Heart — found/.test(sh.journalText),shrine:/Windward Blessing quickens/.test(sh.journalText),warden:/Crest claimed/.test(sh.journalText),beacon:/Dawn released/.test(sh.journalText),lore:/Sefa Lune/.test(sh.journalText)});
let p0=await ppos();await p.keyboard.down('KeyW');await sleep(1500);await p.keyboard.up('KeyW');let p1=await ppos();log('input paused (W held 1.5 s)',{moved:+Math.hypot(p1.x-p0.x,p1.z-p0.z).toFixed(2)});
await p.keyboard.press('Escape');await sleep(300);log('journal closed',!(await p.evaluate(()=>window.__vale.sheets())).journal);
await p.click('#menubtn');await sleep(300);await p.click('#mbtn');await sleep(800);sh=await p.evaluate(()=>window.__vale.sheets());
const ink=await p.evaluate(()=>{const c=document.getElementById('mapcv');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0,t=0;for(let i=0;i<d.length;i+=64){t++;if(d[i]<140)n++;}return {w:c.width,h:c.height,inkPct:+(100*n/t).toFixed(1)};});
p0=await ppos();await p.keyboard.down('KeyW');await sleep(1200);await p.keyboard.up('KeyW');p1=await ppos();
log('map open (menu)',{open:sh.map,paused:sh.paused,canvas:ink,movedWhileOpen:+Math.hypot(p1.x-p0.x,p1.z-p0.z).toFixed(2)});
await p.click('#mclose');await sleep(300);p0=await ppos();await p.keyboard.down('KeyW');await sleep(1500);await p.keyboard.up('KeyW');p1=await ppos();
log('map closed, input resumes',{closed:!(await p.evaluate(()=>window.__vale.sheets())).map,moved:+Math.hypot(p1.x-p0.x,p1.z-p0.z).toFixed(2)});
// New character: confirm panel appears when there is progress; Cancel keeps it
await p.click('#menubtn');await sleep(300);await p.click('#newchar');await sleep(300);log('new character confirm shown',await p.$eval('#ncconfirm',e=>!e.hidden));await p.click('#ncno');await sleep(200);log('cancel keeps progress',{hidden:await p.$eval('#ncconfirm',e=>e.hidden),xp:(await Q()).save.xp});await p.click('#menubtn');await sleep(200);
// Menu → Reset progress (tap twice) → reload with a fresh save
await p.click('#menubtn');await sleep(300);await p.click('#reset');await sleep(300);log('reset armed',await p.$eval('#reset',e=>e.textContent));
await Promise.all([p.waitForNavigation({timeout:120000}),p.click('#reset')]);
await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(1000);
log('after reset: beacon',await p.evaluate(()=>{const b=window.__vale.beacon();return {beacon:b.beacon,dawn:b.dawn,mirrors:b.mirrors};}));log('after reset',{wardenPhase:(await p.evaluate(()=>window.__vale.warden())).phase,save:(await Q()).save,wtext:await p.$eval('#wtext',e=>e.textContent),stored:await p.evaluate(()=>localStorage.getItem('vale3d-save')),profileKept:await p.evaluate(()=>!!localStorage.getItem('vale3d-hero'))});
// New character → Start fresh: earn progress, confirm, page reloads into the creator with a cleared save
q=await Q();await p.evaluate((x,z)=>window.__vale.warp(x,z+1.5),q.wayfinder.x,q.wayfinder.z);await sleep(1200);await p.keyboard.press('KeyE');await sleep(600);for(let i=0;i<4&&(await Q()).talking;i++){await p.keyboard.press('Space');await sleep(300);}
log('progress before new char',{started:(await Q()).save.started});
await p.click('#menubtn');await sleep(300);await p.click('#newchar');await sleep(300);
await Promise.all([p.waitForNavigation({timeout:120000}),p.click('#ncyes')]);await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(800);
log('after new character',{creatorOpen:await p.evaluate(()=>!document.getElementById('create').hidden),save:(await Q()).save});
log('errors',[...errs,...await p.evaluate(()=>window.__vale.errors)]);await b.close();})().catch(e=>{console.log('ERR',e.message);process.exit(1)});
