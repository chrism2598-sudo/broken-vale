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
// Echo Grove silent before any seal; charting starts (Wind Shrine is within reach of the Updraft)
const E0=await p.evaluate(()=>window.__vale.echo());log('charted after visiting the Updraft',E0.marks.filter((m,i)=>E0.charted[i]).map(m=>m.name));
await p.evaluate((x,z)=>window.__vale.warp(x,z+4),E0.x,E0.z);await sleep(1200);log('echo before seals',{near:(await Q()).near});await p.keyboard.press('KeyE');await sleep(500);log('echo silent',{toast:await p.$eval('#toast',e=>e.textContent),done:(await p.evaluate(()=>window.__vale.echo())).done,xp:(await Q()).save.xp});
// Chapter II stair is sealed before the dawn ending
{const C0=await p.evaluate(()=>window.__vale.cave());await p.evaluate((x,z)=>window.__vale.warp(x,z),C0.mouth.x,C0.mouth.z);await sleep(1200);const n0=(await Q()).near;await p.keyboard.press('KeyE');await sleep(700);log('stair before dawn',{near:n0,toast:await p.$eval('#toast',e=>e.textContent),inCave:(await p.evaluate(()=>window.__vale.cave())).inCave,stage:(await p.evaluate(()=>window.__vale.cave())).stage});}
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
const atk=[];for(let i=0;i<12&&!(await Q()).save.warden;i++){await p.waitForFunction('window.__vale.warden().atkCd<=0',{timeout:120000}).catch(()=>{});await p.keyboard.press('KeyE');await sleep(150);const w=await p.evaluate(()=>window.__vale.warden());atk.push({hp:w.hp,cd:+w.atkCd.toFixed(2),toast:await toastTxt()});await sleep(550);if((await Q()).talking){for(let j=0;j<4&&(await Q()).talking;j++){await p.keyboard.press('Space');await sleep(300);}await nearW(2.6);await sleep(500);}}
qd=await Q();log('attacks',atk.slice(0,6));log('warden defeated',{warden:qd.save.warden,xpGain:qd.save.xp-xpW0,toast:await toastTxt()});
await p.keyboard.press('KeyE');await sleep(400);await p.keyboard.press('KeyE');await sleep(400);log('no farming',{xpGain:(await Q()).save.xp-xpW0,near:(await Q()).near,phase:(await p.evaluate(()=>window.__vale.warden())).phase});
await p.reload({waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(800);
qd=await Q();log('after reload (warden persisted)',{warden:qd.save.warden,xp:qd.save.xp,phase:(await p.evaluate(()=>window.__vale.warden())).phase,wdtext:await p.$eval('#wdtext',e=>e.textContent)});
// Echo Grove: listen (+20 once) → recall (no reward)
const E=await p.evaluate(()=>window.__vale.echo());const xpE0=(await Q()).save.xp;
await p.evaluate((x,z)=>window.__vale.warp(x,z+4),E.x,E.z);await sleep(1000);log('echo near',(await Q()).near);await p.keyboard.press('KeyE');
await p.waitForFunction('window.__vale.quest().talking',{timeout:120000});let qe=await Q();log('echo memory',{dlg:qe.dlg,xpGain:qe.save.xp-xpE0,echo:qe.save.echo,toast:await toastTxt()});
for(let i=0;i<6&&(await Q()).talking;i++){await p.keyboard.press('Space');await sleep(300);}
await p.keyboard.press('KeyE');await sleep(500);qe=await Q();const recallTxt=await p.evaluate(()=>document.getElementById('dtxt').textContent);for(let i=0;i<6&&(await Q()).talking;i++){await p.keyboard.press('Space');await sleep(250);}
log('echo recall (no farming)',{talking:qe.talking,first:recallTxt,xpGain:(await Q()).save.xp-xpE0});
// Marr's Unfinished Map: visit every mark
for(let i=0;i<E.marks.length;i++){const m=E.marks[i];await p.evaluate((x,z)=>window.__vale.warp(x,z),m.x+20,m.z+20);await p.waitForFunction(i=>window.__vale.echo().charted[i],{timeout:60000},i).catch(()=>log('chart timeout',m.name));await sleep(300);}
const EC=await p.evaluate(()=>window.__vale.echo());log('charting',{charted:EC.charted.filter(Boolean).length+'/'+EC.charted.length,toast:await toastTxt()});
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
B=await p.evaluate(()=>window.__vale.beacon());log('after reload (beacon persisted)',{echo:(await p.evaluate(()=>window.__vale.echo())).done,charted:(await p.evaluate(()=>window.__vale.echo())).charted.filter(Boolean).length,beacon:B.beacon,dawn:B.dawn,mirrors:B.mirrors,xp:(await Q()).save.xp,qline:await p.$eval('#qline',e=>e.textContent)});
// Chapter II opener: Wayfinder's lead (only after dawn) → collapsed stair → cave → puzzle wrong/right → Enna's carving (+40 once) → exit → persist
const C=()=>p.evaluate(()=>window.__vale.cave());const xpC0=(await Q()).save.xp;
{let c=await C();await p.evaluate((x,z)=>window.__vale.warp(x,z),c.mouth.x,c.mouth.z);await sleep(1000);await p.keyboard.press('KeyE');await sleep(700);log('stair before the lead',{toast:await toastTxt(),inCave:(await C()).inCave,stage:(await C()).stage});
q=await Q();await p.evaluate((x,z)=>window.__vale.warp(x,z+1.5),q.wayfinder.x,q.wayfinder.z);await sleep(1200);const nW=(await Q()).near;await p.keyboard.press('KeyE');await sleep(700);const dl=[(await Q()).dlg];for(let i=0;i<5&&(await Q()).talking;i++){await p.keyboard.press('Space');await sleep(350);dl.push((await Q()).dlg);}
log('wayfinder lead',{near:nW,mentionsStair:dl.some(t=>/collapsed stair/.test(t)),stage:(await C()).stage,qline:await p.$eval('#qline',e=>e.textContent)});
c=await C();await p.evaluate((x,z)=>window.__vale.warp(x,z),c.mouth.x,c.mouth.z);await sleep(1000);const nS=(await Q()).near;await p.keyboard.press('KeyE');await sleep(200);const fadeOn=await p.$eval('#fade',e=>e.classList.contains('on'));
await p.waitForFunction('window.__vale.cave().inCave&&window.__vale.ready',{timeout:120000});await sleep(900);c=await C();
log('entered cave',{near:nS,fadeOn,inCave:c.inCave,stage:c.stage,fadeOff:!(await p.$eval('#fade',e=>e.classList.contains('on'))),qline:await p.$eval('#qline',e=>e.textContent),near2:(await Q()).near});
await p.evaluate((x,z)=>window.__vale.warp(x,z+1.2),c.doorAt.x,c.doorAt.z);await sleep(700);log('near door',(await Q()).near);await p.keyboard.press('KeyE');await sleep(500);const hint=(await Q()).dlg;await closeDlg();log('door hint',hint);
const atB=async(i)=>{await p.evaluate((x,z)=>window.__vale.warp(x,z+1.2),c.braziers[i].x,c.braziers[i].z);await sleep(600);const n=(await Q()).near;await p.keyboard.press('KeyE');await sleep(400);return {near:n,toast:await toastTxt(),lit:(await C()).lit};};
const w=await atB(0);await sleep(2000);log('puzzle wrong (Ford first)',{...w,litAfter:(await C()).lit,stage:(await C()).stage,xpUnchanged:(await Q()).save.xp===xpC0});
for(const i of c.order){log('light '+c.names[i],await atB(i));}
await p.waitForFunction('window.__vale.cave().door',{timeout:120000});c=await C();log('door open',{stage:c.stage,door:c.door,xpUnchanged:(await Q()).save.xp===xpC0});
// Coast gate: the west passage stays choked until Enna's carving is read
{const K0=await p.evaluate(()=>window.__vale.coast());await p.evaluate((x,z)=>window.__vale.warp(x+0.6,z),K0.passage.x,K0.passage.z);await sleep(700);const nP=(await Q()).near;await p.keyboard.press('KeyE');await sleep(1500);const K1=await p.evaluate(()=>window.__vale.coast());log('west passage before discovery (locked)',{near:nP,toast:await toastTxt(),inCoast:K1.inCoast,stage:K1.stage});}
await p.evaluate((x,z)=>window.__vale.warp(x,z+0.6),c.carving.x,c.carving.z);await sleep(700);const nC=(await Q()).near;await p.keyboard.press('KeyE');await sleep(600);const d1=(await Q()).dlg;const cl=[d1];for(let i=0;i<6&&(await Q()).talking;i++){await p.keyboard.press('Space');await sleep(300);if((await Q()).talking)cl.push((await Q()).dlg);}
log('Enna carving',{near:nC,first:d1,seaLine:cl.some(t=>/sea/.test(t)),xpGain:(await Q()).save.xp-xpC0,stage:(await C()).stage,toast:await toastTxt()});
await p.keyboard.press('KeyE');await sleep(500);await closeDlg();log('carving again (no farming)',{xpGain:(await Q()).save.xp-xpC0});
// Chapter II continues: west passage → Tidewrack Coast → Tide-Glass at high tide (no) / low tide (path) → sea cave (+30 once) → back
{const K=()=>p.evaluate(()=>window.__vale.coast());let k=await K();const xpK0=(await Q()).save.xp;
await p.evaluate((x,z)=>window.__vale.warp(x+0.6,z),k.passage.x,k.passage.z);await sleep(700);const nP=(await Q()).near;await p.keyboard.press('KeyE');
await p.waitForFunction('window.__vale.coast().inCoast&&window.__vale.ready',{timeout:120000});await sleep(900);k=await K();
log('entered coast',{near:nP,inCoast:k.inCoast,inCave:(await C()).inCave,stage:k.stage,qline:await p.$eval('#qline',e=>e.textContent),toast:await toastTxt()});
await p.evaluate((x,z)=>window.__vale.warp(x,z),k.caveMouth.x,k.caveMouth.z);await sleep(800);let pp=await p.evaluate(()=>{const v=window.__vale.debug.player.position;return {x:v.x,z:v.z};});
log('causeway hidden: sea cave unreachable',{near:(await Q()).near});
await p.evaluate((x,z)=>window.__vale.warp(x+1.2,z),k.shrine.x,k.shrine.z);await p.waitForFunction('!window.__vale.coast().low',{timeout:180000});await sleep(500);
const nS=(await Q()).near;await p.keyboard.press('KeyE');await sleep(500);k=await K();log('Tide-Glass at high tide (no)',{near:nS,phase:k.phase,toast:await toastTxt(),stage:k.stage,revealed:k.revealed,xpUnchanged:(await Q()).save.xp===xpK0});
await p.waitForFunction('window.__vale.coast().low',{timeout:180000});await p.keyboard.press('KeyE');await sleep(600);const dR=(await Q()).dlg;await closeDlg();k=await K();
log('Tide-Glass at low tide (path)',{phase:k.phase,tide:+k.tide.toFixed(2),dialog:dR,stage:k.stage,revealed:k.revealed,xpUnchanged:(await Q()).save.xp===xpK0});
await p.waitForFunction('window.__vale.coast().rise>0.95',{timeout:120000});await sleep(3000);k=await K();log('tide held low, causeway up',{phase:k.phase,tide:+k.tide.toFixed(2),rise:+k.rise.toFixed(2)});
await p.evaluate((x,z)=>window.__vale.warp(x,z),k.pathStart.x,k.pathStart.z);await sleep(500);
await p.evaluate((x,z)=>window.__vale.warp(x,z),k.caveMouth.x,k.caveMouth.z);await sleep(900);pp=await p.evaluate(()=>{const v=window.__vale.debug.player.position;return {x:v.x,y:v.y,z:v.z};});
const nM=(await Q()).near;await p.keyboard.press('KeyE');await sleep(600);const dM=(await Q()).dlg;await closeDlg();await sleep(400);
await p.waitForFunction('window.__vale.sea().inSea&&window.__vale.ready',{timeout:120000});await sleep(900);
log('sea cave mouth → Listening Pools',{near:nM,onShelf:Math.hypot(pp.x-k.caveMouth.x,pp.z-k.caveMouth.z)<1,standY:+pp.y.toFixed(2),dialog:dM,xpGain:(await Q()).save.xp-xpK0,stage:(await K()).stage,inSea:(await p.evaluate(()=>window.__vale.sea())).inSea,inCoast:(await K()).inCoast,chapterCard:await p.$eval('#chapter',e=>!e.hidden),qline:await p.$eval('#qline',e=>e.textContent),toast:await toastTxt()});
// M12 · the Listening Pools: wake three lamp-shells with the Tide-Glass in one ebb → round seal stirs → Enna's page (+45 once) → back out
{const S=()=>p.evaluate(()=>window.__vale.sea());let s=await S();const xpS0=(await Q()).save.xp;const at=async(pt,dx=2.2)=>{await p.evaluate((x,z)=>window.__vale.warp(x,z),pt.x+dx,pt.z);await sleep(450);};
log('sea stage on entry',{stage:s.stage,tide:+s.level.toFixed(2),phase:s.phase});
await p.waitForFunction('!window.__vale.sea().low',{timeout:60000});await at(s.shells[0]);const nH=(await Q()).near;await p.keyboard.press('KeyE');await sleep(400);s=await S();
log('lamp-shell at high water (covered)',{near:nH,toast:await toastTxt(),lit:s.lit,phase:s.phase});
await p.waitForFunction('window.__vale.sea().low',{timeout:60000});await sleep(300);await p.keyboard.press('KeyE');await sleep(400);s=await S();log('one shell woken at low water',{toast:await toastTxt(),lit:s.lit});
await p.waitForFunction('!window.__vale.sea().low',{timeout:60000});await sleep(400);s=await S();log('tide returns → partial set resets',{lit:s.lit,toast:await toastTxt(),stage:s.stage});
await p.waitForFunction('window.__vale.sea().low',{timeout:60000});const tL=Date.now();
for(let i=0;i<3;i++){await at(s.shells[i]);await p.keyboard.press('KeyE');await sleep(350);if(i<2)log('shell '+(i+1),{toast:await toastTxt(),lit:(await S()).lit});}
const dS=(await Q()).dlg;await closeDlg();await sleep(600);s=await S();log('all three in one ebb → seal wakes',{secs:+((Date.now()-tL)/1000).toFixed(1),dialog:dS,stage:s.stage,solved:s.solved,lowStill:s.low,xpUnchanged:(await Q()).save.xp===xpS0,hud:await p.$eval('#qline',e=>e.textContent)});
await at(s.door,0.2);await p.keyboard.press('KeyE');await sleep(400);const dD=(await Q()).dlg;await closeDlg();log('round seal (still shut, wants a second key)',{dialog:dD});
await at(s.page,0);const nPg=(await Q()).near;await p.keyboard.press('KeyE');await sleep(500);const pg=[(await Q()).dlg];for(let i=0;i<6&&(await Q()).talking;i++){await p.keyboard.press('Space');await sleep(300);if((await Q()).talking)pg.push((await Q()).dlg);}await sleep(400);
log('Enna’s page',{near:nPg,lines:pg.length,keeper:pg.some(t=>/keeper/.test(t)),alone:pg.some(t=>/alone/.test(t)),xpGain:(await Q()).save.xp-xpS0,stage:(await S()).stage,chapter:await p.$eval('#chapter',e=>e.hidden?null:e.innerText.replace(/\n+/g,' | '))});
await p.screenshot({path:'shots/qa-sea-chapter.png'});await p.click('#chok').catch(()=>{});await sleep(400);
await p.keyboard.press('KeyE');await sleep(500);await closeDlg();log('page again (no farming)',{xpGain:(await Q()).save.xp-xpS0});
s=await S();await at(s.exit,-0.4);const nX=(await Q()).near;await p.keyboard.press('KeyE');await p.waitForFunction('!window.__vale.sea().inSea&&window.__vale.coast().inCoast&&window.__vale.ready',{timeout:60000});await sleep(700);
log('out to the causeway',{near:nX,inSea:(await S()).inSea,inCoast:(await K()).inCoast,mouthLabel:(await Q()).near,xpTotal:(await Q()).save.xp});}
k=await K();await p.evaluate((x,z)=>window.__vale.warp(x,z),k.tunnel.x,k.tunnel.z);await sleep(700);const nT=(await Q()).near;await p.keyboard.press('KeyE');
await p.waitForFunction('window.__vale.cave().inCave&&!window.__vale.coast().inCoast&&window.__vale.ready',{timeout:120000});await sleep(700);
log('back through the water-road',{near:nT,inCave:(await C()).inCave,inCoast:(await K()).inCoast});}
c=await C();await p.evaluate((x,z)=>window.__vale.warp(x,z),c.exit.x,c.exit.z);await sleep(700);const nE=(await Q()).near;await p.keyboard.press('KeyE');
await p.waitForFunction('!window.__vale.cave().inCave&&window.__vale.ready',{timeout:120000});await sleep(800);const pe=await p.evaluate(()=>{const v=window.__vale.debug.player.position;return {x:v.x,z:v.z};});c=await C();
log('exited cave',{near:nE,inCave:c.inCave,distFromStair:+Math.hypot(pe.x-c.mouth.x,pe.z-c.mouth.z).toFixed(1),qline:await p.$eval('#qline',e=>e.textContent)});
await p.reload({waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(1200);
log('after reload (cave + coast + sea persisted)',{stage:(await C()).stage,coast:(await p.evaluate(()=>window.__vale.coast())).stage,sea:(await p.evaluate(()=>window.__vale.sea())).stage,xp:(await Q()).save.xp,inCave:(await C()).inCave,inCoast:(await p.evaluate(()=>window.__vale.coast())).inCoast});}
// Journal / Map: open, state, input paused, close
const ppos=()=>p.evaluate(()=>{const v=window.__vale.debug.player.position;return {x:v.x,z:v.z};});
await p.keyboard.press('KeyJ');await sleep(500);let sh=await p.evaluate(()=>window.__vale.sheets());
log('journal open (J)',{open:sh.journal,paused:sh.paused,seals:/Forge Heart — found/.test(sh.journalText),shrine:/Windward Blessing quickens/.test(sh.journalText),warden:/Crest claimed/.test(sh.journalText),beacon:/Dawn released/.test(sh.journalText),lore:/Sefa Lune/.test(sh.journalText),echo:/Memory of the Break heard/.test(sh.journalText),charting:/7\/7 charted/i.test(sh.journalText),trail:/Enna’s carved message found/.test(sh.journalText),coast:/Second Seam/i.test(sh.journalText),sea:/Drowned Keeper/.test(sh.journalText)&&/lamp-shells/.test(sh.journalText)});
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
