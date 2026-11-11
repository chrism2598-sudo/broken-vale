// M21b-2 QA: Listening Pools expansion — stick-walk every chamber (old grottoes + flooded grotto +
// tide-crystal chamber), open the new chests, read the crystal tablet, walls hold, Tide-Wights
// notice and can be beaten, camera stays inside passages. Uses deterministic sim / seaWalk.
const pc=require(process.env.PUPPETEER_CORE);const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:900000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage();await p.setViewport({width:412,height:860,isMobile:true,hasTouch:true});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
const log=(k,v)=>console.log(k,JSON.stringify(v));let fails=0;const ok=(name,c,v)=>{if(!c)fails++;log((c?'PASS ':'FAIL ')+name,v);};
const ready=()=>p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});
const S=()=>p.evaluate(()=>window.__vale.sea());
const Q=()=>p.evaluate(()=>window.__vale.quest());
const sim=(n,sx=0,sy=0)=>p.evaluate((n,sx,sy)=>{window.__vale.sim(Array(n).fill(1/30),sx,sy);},n,sx,sy);
const at=(x,z)=>p.evaluate((x,z)=>window.__vale.warp(3000+x,3000+z),x,z);
const walk=(lx,lz,f=360)=>p.evaluate((lx,lz,f)=>window.__vale.seaWalk(lx,lz,f,1),lx,lz,f);
const act=async()=>{await p.evaluate(()=>window.__vale.interact());};
const pos=()=>p.evaluate(()=>{const s=window.__vale.camInfo();return {x:s.st.px-3000,z:s.st.pz-3000,y:s.player[1],chamber:window.__vale.sea().chamber,near:window.__vale.sea()&&null};}).then(async q=>{q.near=(await S()).chamber&&(await p.evaluate(()=>window.__vale.world().near));q.chamber=(await S()).chamber;q.y=(await S()).y;return q;});

await p.goto('http://localhost:8090/?q=lite&shot=seal-open',{waitUntil:'load',timeout:180000});
await ready();await sleep(2500);
let s=await S();ok('in the Listening Pools',s.inSea===true,{inSea:s.inSea,loot:(s.loot||[]).map(x=>x.id),mobs:(s.mobs||[]).map(m=>m.id)});
ok('two new chambers are registered',(s.loot||[]).some(x=>x.id==='sea-flood')&&(s.loot||[]).some(x=>x.id==='sea-crystal-chest')&&(s.loreFinds||[]).some(x=>x.id==='sea-crystal')&&(s.mobs||[]).length>=3, {loot:s.loot,lore:s.loreFinds,mobs:(s.mobs||[]).map(m=>m.id)});

// kill wights so they don't interrupt the stick-walk / chest route
await p.evaluate(()=>window.__vale.killSeaMobs());

// 1 · existing Wrack grotto still reachable
await at(-9.5,7);await p.evaluate(()=>window.__vale.view(0,Math.PI,0.2,5));
let r=await walk(-9.5,20.3,200);ok('stick-walk into the Wrack grotto',r&&r.chamber==='north'&&r.z>17,{r});
ok('wrack-heap offered',/wrack/i.test(r.near||''),{near:r.near});
let x0=(await Q()).save;await act();await sleep(250);let x1=(await Q()).save;
ok('wrack-heap still pays',x1.xp-x0.xp===25&&(x1.chests||[]).includes('sea-north'),{dxp:x1.xp-x0.xp,chests:x1.chests});

// 2 · existing Bell grotto
await at(-20,-6);await p.evaluate(()=>window.__vale.view(Math.PI,0,0.2,5));
r=await walk(-20,-19.8,200);ok('stick-walk into the Bell grotto',r&&r.chamber==='south'&&r.z<-16,{r});
ok('drowned bell offered',/bell/i.test(r.near||''),{near:r.near});
await act();await sleep(250);x1=(await Q()).save;ok('bell lore still saved',(x1.lore||[]).includes('sea-bell'),{lore:x1.lore});
for(let i=0;i<4;i++)await p.evaluate(()=>window.__vale.advance());

// 3 · Flooded grotto: walk from inside the chamber (mouth at z=6, x=-26.4) all the way in
await at(-26.4,5.2);await p.evaluate(()=>window.__vale.view(0,Math.PI,0.22,5));
r=await walk(-26.4,23.8,280);
ok('stick-walk the flood passage into the Flooded grotto',r&&r.chamber==='flood'&&r.z>17,{r});
// walls hold: walk past the far wall
await at(-26.4,29.5);await p.evaluate(()=>window.__vale.view(0,Math.PI,0.2,5));await sim(50,0,-1);
let q=await pos();ok('flooded grotto wall holds',q.z<23.8+6.6+0.2,{q});
// chest on the back ledge
r=await walk(-26.0,27.8,160);
s=await S();ok('drowned chest offered',/drowned chest/i.test(s.near||r.near||''),{near:s.near,r});
x0=(await Q()).save;await act();await sleep(250);x1=(await Q()).save;
ok('drowned chest: +30 XP once',x1.xp-x0.xp===30&&(x1.chests||[]).includes('sea-flood'),{dxp:x1.xp-x0.xp,chests:x1.chests});
await act();await sleep(200);let x2=(await Q()).save;ok('drowned chest pays once',x2.xp===x1.xp,{x1:x1.xp,x2:x2.xp});

// 4 · Tide-crystal chamber: mouth at x=-5.5, z=-8.3
await at(-5.5,-6.0);await p.evaluate(()=>window.__vale.view(Math.PI,0,0.22,5));
r=await walk(-5.5,-23.6,280);
ok('stick-walk into the Tide-crystal chamber',r&&r.chamber==='crystal'&&r.z<-16,{r});
await at(-5.5,-29.5);await p.evaluate(()=>window.__vale.view(Math.PI,0,0.2,5));await sim(50,0,-1);
q=await pos();ok('crystal chamber wall holds',q.z>-23.6-6.5-0.2,{q});
// tablet
r=await walk(-5.35,-24.2,160);
s=await S();ok('tide-crystal tablet offered',/tablet/i.test(s.near||r.near||''),{near:s.near,r});
x0=(await Q()).save;await act();await sleep(300);x1=(await Q()).save;
ok('crystal tablet: lore page +20 XP',(x1.lore||[]).includes('sea-crystal')&&x1.xp-x0.xp===20,{dxp:x1.xp-x0.xp,lore:x1.lore});
for(let i=0;i<6;i++)await p.evaluate(()=>window.__vale.advance());
// shelf chest
r=await walk(-3.4,-23.8,160);
s=await S();ok('crystal-shelf chest offered',/crystal-shelf chest/i.test(s.near||r.near||''),{near:s.near,r});
x0=(await Q()).save;await act();await sleep(250);x1=(await Q()).save;
ok('crystal chest: +20 XP',x1.xp-x0.xp===20&&(x1.chests||[]).includes('sea-crystal-chest'),{dxp:x1.xp-x0.xp,chests:x1.chests});

// 5 · camera stays inside a tight passage (flood, the longer one)
await at(-26.4,8);await p.evaluate(()=>window.__vale.view(0,Math.PI,0.22,5));
const rows=await p.evaluate(()=>{const out=[];for(let i=0;i<80;i++){window.__vale.sim([1/30],0,-1);const ci=window.__vale.camInfo();out.push({cam:ci.cam,st:ci.st,player:ci.player,tight:window.__vale.sea().tight,chamber:window.__vale.sea().chamber});}return out;});
let jump=0,outOf=0;for(let i=1;i<rows.length;i++){const a=rows[i].cam,b=rows[i-1].cam;const d=Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);jump=Math.max(jump,d);
  const lx=a[0]-3000,lz=a[2]-3000; // camera should stay near the passage x=-26.4 while z is in the tunnel, and y above the floor
  if(rows[i].chamber==='flood'||rows[i].tight){if(Math.abs(lx-(-26.4))>4.5&&(lz<16))outOf++;if(a[1]< -1.2)outOf++;}}
ok('camera walks the flood passage without pops',jump<0.9,{jump:+jump.toFixed(3),outOf,end:rows[rows.length-1]});
ok('camera stays in the passage volume',outOf===0,{outOf,sample:rows.filter(r=>r.tight).slice(0,2)});

// 6 · Tide-Wights: reload so foes are alive, fight one in the flood chamber
await p.goto('http://localhost:8090/?q=lite&shot=seal-open',{waitUntil:'load',timeout:180000});await ready();await sleep(2500);
s=await S();ok('three Tide-Wights on entry',(s.mobs||[]).filter(m=>m.alive).length===3,{mobs:s.mobs});
// warp next to the crystal wight (further from the other two)
const mw=(s.mobs||[]).find(m=>m.id==='sea-crystal-a');ok('crystal wight present',!!mw,{mw});
if(mw){await p.evaluate((x,z)=>{window.__vale.warp(x,z+1.6);window.__vale.view(Math.PI,0,0.2,5);},mw.x,mw.z);await sim(8);
  s=await S();const hostile=await p.evaluate(()=>window.__vale.ctl().hostile);
  ok('crystal wight is a hostile in its chamber',hostile===true||(s.mobs||[]).some(m=>m.id==='sea-crystal-a'&&m.state!=='idle'),{hostile,mobs:s.mobs,ctl:await p.evaluate(()=>window.__vale.ctl())});
  await p.evaluate(()=>window.__vale.heal());
  let tries=0;for(;tries<50;tries++){s=await S();const m=(s.mobs||[]).find(x=>x.id==='sea-crystal-a');if(!m||!m.alive)break;
    await p.evaluate((x,z)=>{window.__vale.warp(x,z+1.5);window.__vale.view(Math.PI,Math.PI,0.2,5);},m.x,m.z);
    await p.evaluate(()=>window.__vale.heal());await p.keyboard.press('KeyK');await sim(14);}
  s=await S();const save=(await Q()).save;
  ok('crystal Tide-Wight beaten',!(s.mobs||[]).find(m=>m.id==='sea-crystal-a').alive&&(save.foes||[]).includes('sea-crystal-a'),{tries,mobs:s.mobs,foes:save.foes});
}

ok('no page errors',errs.length===0,errs.slice(0,5));
console.log(fails?`QA-CAVE FAIL ${fails}`:'QA-CAVE PASS');await b.close();process.exit(fails?1:0);})().catch(e=>{console.log('QA-CAVE ERROR',e.message);process.exit(2);});
