// M59 · combat-readability audit, every arena (INTERNAL, headless). For each foe type: put the player in reach,
// wait for a wind-up (detected independently of the HUD), then record what the HUD shows at +0.2 s: the foe pill,
// its label, the pill's wind-up alert, the on-control cue (Roll/Block ring), and after the blow lands the hurt flash
// and the hearts. Also: stamina-refusal shake, block flash, the pill after a hit in the sea cave, and the seal camera.
// PORT=8095 OUT=… SHOTS=dir node tools/m59-readability.cjs
const pc=require(process.env.PUPPETEER_CORE);const fs=require('fs');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const PORT=process.env.PORT||'8095',SHOTS=process.env.SHOTS||'';
const SAVE=(o={})=>JSON.stringify({v:1,started:true,done:false,xp:120,seals:{dawn:true},runes:[0,0,0],wind:false,warden:false,mirrors:[0,0,0,0],beacon:false,echo:false,weapons:['rusty'],...o});
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:900000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const R={port:PORT,arenas:{},extra:{}},errs=[];
const page=async(q,save)=>{const p=await b.newPage();await p.setViewport({width:412,height:915,isMobile:true,hasTouch:true});p.on('pageerror',e=>errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?q=lite&qa=1&${q}`,{waitUntil:'load'});await p.evaluate((s)=>{localStorage.clear();localStorage.setItem('vale3d-hero',JSON.stringify({name:'Ilka',sex:'female'}));if(s)localStorage.setItem('vale3d-save',s);},save);
  await p.reload({waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(800);return p;};
R.bundle=null;
const hud=(p)=>p.evaluate(()=>{const c=document.getElementById('combat'),bo=document.getElementById('bossbar'),cbt=document.getElementById('cbt'),vis=(e)=>e&&!e.hidden&&getComputedStyle(e).display!=='none';
  return {pill:vis(c),label:vis(c)?document.getElementById('foe')?.textContent||c.textContent.slice(0,60):'',alert:vis(c)&&c.classList.contains('alert'),boss:vis(bo),bossAlert:vis(bo)&&bo.classList.contains('alert'),cue:cbt.classList.contains('warn'),fx:document.getElementById('fx')?.className||'',hp:window.__vale.world().playerHp,pillText:vis(c)?c.textContent.replace(/\s+/g,' ').slice(0,80):''};});
// in-page wind-up detector per arena (independent of the HUD code under test)
const DET={
  vale:`(()=>{const v=window.__vale,c=v.camInfo().st;for(const g of v.world().groups)for(const m of g.mobs)if(m.alive&&m.state==='windup'&&Math.hypot(m.x-c.px,m.z-c.pz)<4.6)return true;return false})()`,
  castle:`(()=>{const v=window.__vale,c=v.camInfo().st,k=v.castle();return (k.mobs||[]).some(m=>m.alive&&m.state==='windup'&&Math.hypot(m.x-c.px,m.z-c.pz)<4.6)})()`,
  barrow:`(()=>{const v=window.__vale,c=v.camInfo().st;return (v.barrowMobs()||[]).some(m=>m.alive&&m.state==='windup'&&Math.hypot(m.x-c.px,m.z-c.pz)<5.6)})()`,
  sea:`(()=>{const v=window.__vale,c=v.camInfo().st;return (v.sea().mobs||[]).some(m=>m.alive&&m.state==='windup'&&Math.hypot(m.x-c.px,m.z-c.pz)<4.6)})()`,
  warden:`window.__vale.warden().phase===1`,
  keeper:`window.__vale.keeper().state==='windup'`};
const watch=async(p,name,det,label)=>{const r={name,label};let found=false;
  for(let i=0;i<900&&!found;i++){await p.evaluate(()=>window.__vale.sim([1/30],0,0));found=await p.evaluate(DET[det]);if(i%60===59)await p.evaluate(()=>window.__vale.heal());}
  r.windup=found;if(!found)return r;
  await p.evaluate(()=>window.__vale.sim(Array(6).fill(1/30),0,0));r.at=await hud(p);if(SHOTS){fs.mkdirSync(SHOTS,{recursive:true});await sleep(250);r.shot=`${SHOTS}/${name}.png`;await p.screenshot({path:r.shot});}
  const hp0=r.at.hp;let hit=null;for(let i=0;i<120&&!hit;i++){await p.evaluate(()=>window.__vale.sim([1/30],0,0));const h=await hud(p);if(h.hp<hp0)hit=h;}
  r.afterHit=hit;await p.evaluate(()=>window.__vale.sim(Array(6).fill(1/30),0,0));r.hurtPill=await hud(p);return r;};
const score=(r)=>{if(!r.windup)return null;const a=r.at;const boss=r.name==='keeper';
  return {pillOrBar:boss?a.boss:a.pill,labelOk:boss?true:(a.pill&&new RegExp(r.label,'i').test(a.pillText)),alert:boss?a.bossAlert:a.alert,controlCue:a.cue,hurtFlash:r.afterHit?r.afterHit.fx==='hurt':null,pillAfterHitOk:!r.afterHit?null:boss?r.afterHit.boss:(r.afterHit.pill&&new RegExp(r.label,'i').test(r.afterHit.pillText))};};
const run=async(name,q,save,det,label,setup)=>{let p;try{p=await page(q,save);if(!R.bundle)R.bundle=await p.evaluate(()=>[...document.scripts].map(s=>s.src).find(s=>/index-/.test(s))?.split('/').pop());
  await setup(p);const r=await watch(p,name,det,label);r.score=score(r);R.arenas[name]=r;console.log(name,JSON.stringify(r.score),r.windup?'':'(no wind-up)');}catch(e){R.arenas[name]={error:String(e).slice(0,200)};console.log(name,'ERR',String(e).slice(0,160));}finally{if(p)await p.close();}};
const near=(x,z)=>(p)=>p.evaluate((x,z)=>{window.__vale.warp(x,z);window.__vale.sim(Array(4).fill(1/30),0,0);},x,z);
// 1 · vale husks (first-fight group) — daytime roamers need a tod param under webdriver
await run('husk','tod=0.42',SAVE(),'vale','Husk',near(8,35.5));
// 2 · Ashen Hollow cultists/zealot
await run('cultist','tod=0.42',SAVE(),'vale','Cultist|Zealot',near(-122,141));
// 3 · night shades (Gloam)
await run('shade','tod=0.98',SAVE(),'vale','Shade|Brute',near(-12,-27));
// 4 · castle Sentinel
await run('sentinel','',SAVE(),'castle','Sentinel',async(p)=>{await p.evaluate(()=>window.__vale.enterCastle('pale'));await p.waitForFunction(`window.__vale.castle().id==='pale'&&!window.__vale.castle().fading`,{timeout:60000}).catch(()=>{});await sleep(400);
  await p.evaluate(()=>{const v=window.__vale,c=v.castle(),m=c.mobs.find(x=>x.id==='pale-hall');v.castleAt(m.x-c.O.x,m.z-c.O.z+1.5,0,Math.PI);});});
// 5 · barrow dead
await run('barrow','',SAVE({xp:200}),'barrow','Barrow',async(p)=>{await p.evaluate(()=>window.__vale.barrowGo('enter'));await sleep(1500);
  await p.evaluate(()=>{const v=window.__vale,ms=v.barrowMobs().filter(m=>m.hall&&m.alive);const m=ms[0];v.warp(m.x+1.4,m.z);v.sim(Array(4).fill(1/30),0,0);});});
// 6 · sea-cave Tide-Wight
await run('wight','shot=sea-cave-interior',null,'sea','Wight',async(p)=>{await sleep(2500);await p.evaluate(()=>{const v=window.__vale,ms=v.sea().mobs.filter(m=>m.alive);const c=v.camInfo().st;ms.sort((a,b)=>Math.hypot(a.x-c.px,a.z-c.pz)-Math.hypot(b.x-c.px,b.z-c.pz));const m=ms[0];v.warp(m.x+1.3,m.z);v.sim(Array(4).fill(1/30),0,0);});});
// 7 · Vale Warden (optional boss)
await run('warden','shot=warden-windup',null,'warden','Warden',async(p)=>{await sleep(1500);});
// 8 · Drowned Keeper (boss bar)
await run('keeper','shot=keeper-windup',null,'keeper','Keeper',async(p)=>{await sleep(2500);});
// extras: stamina refusal + block flash (husks)
{const p=await page('tod=0.42',SAVE());const S=(n)=>p.evaluate((n)=>window.__vale.sim(Array(n).fill(1/30),0,0),n);
 await near(8,35.5)(p);let got=null;
 for(let i=0;i<500&&!got;i++){await S(1);if(await p.evaluate(DET.vale)){await p.keyboard.down('KeyQ');for(let k=0;k<45&&!got;k++){await S(1);const f=await p.evaluate(()=>document.getElementById('fx').className);const t=await p.evaluate(()=>document.getElementById('toast').textContent);if(/Blocked|Guard|strikes|Parried/.test(t))got={fx:f,toast:t};}await p.keyboard.up('KeyQ');await p.evaluate(()=>window.__vale.heal());}}
 R.extra.blockFlash=got;
 let st=100,shake=false;for(let i=0;i<14&&!shake;i++){await p.keyboard.press('KeyC');await S(2);st=await p.evaluate(()=>window.__vale.combat().stamina);shake=await p.evaluate(()=>document.getElementById('stam').classList.contains('fail'));if(!shake)await S(6);}
 R.extra.staminaShake={stamina:st,shake};await p.close();}
// seal camera: stand 2.7 m from the Forge Heart with the camera on the seal's side (facing away from it)
{const p=await page('tod=0.42',SAVE({seals:{}}));const s=await p.evaluate(()=>window.__vale.quest().seals.find(x=>x.id==='forge'));const out=[];
 for(const a of [0,1.2,2.4,3.6,4.8]){const r=await p.evaluate((sx,sz,a)=>{const v=window.__vale,px=sx+Math.sin(a)*2.7,pz=sz+Math.cos(a)*2.7;v.warp(px,pz);const away=Math.atan2(px-sx,pz-sz);v.view(away,away+Math.PI*0+Math.atan2(sx-px,sz-pz)-away+0,0.15,7.4);
   v.view(away,Math.atan2(sx-px,sz-pz),0.15,7.4);v.sim(Array(30).fill(1/30),0,0);const c=v.camInfo();const cx=c.cam[0],cz=c.cam[2],tx=c.player[0],tz=c.player[2];
   // closest approach of the camera→player segment to the seal axis
   const dx=tx-cx,dz=tz-cz,L2=dx*dx+dz*dz;let u=((sx-cx)*dx+(sz-cz)*dz)/L2;u=Math.max(0,Math.min(1,u));const d=Math.hypot(cx+dx*u-sx,cz+dz*u-sz);const cy=c.cam[1],ty=c.player[1],lineY=cy+(ty+1.42-cy)*u,top=ty+2.9;return {a,camToSeal:+Math.hypot(cx-sx,cz-sz).toFixed(2),segClear:+d.toFixed(2),lineY:+lineY.toFixed(2),crystalTop:+top.toFixed(2),clips:d<1.15&&lineY<top,camPlayer:+Math.hypot(dx,dz).toFixed(2)};},s.x,s.z,a);out.push(r);}
 R.extra.sealCam=out;R.extra.sealCamClips=out.filter(r=>r.clips).length;if(SHOTS){await p.evaluate((sx,sz)=>{const v=window.__vale,px=sx+Math.sin(2.4)*2.7,pz=sz+Math.cos(2.4)*2.7;v.warp(px,pz);v.view(Math.atan2(px-sx,pz-sz),Math.atan2(sx-px,sz-pz),0.15,7.4);v.sim(Array(30).fill(1/30),0,0);},s.x,s.z);await sleep(300);await p.screenshot({path:`${SHOTS}/seal-cam.png`});}
 await p.close();}
const sc=Object.values(R.arenas).map(a=>a.score).filter(Boolean);const keys=['pillOrBar','labelOk','alert','controlCue','hurtFlash','pillAfterHitOk'];
R.totals={};for(const k of keys){const n=sc.filter(s=>s[k]!==null&&s[k]!==undefined);R.totals[k]=`${n.filter(s=>s[k]).length}/${n.length}`;}R.errs=errs;
console.log('TOTALS',JSON.stringify(R.totals),'extra',JSON.stringify({stamina:R.extra.staminaShake,block:R.extra.blockFlash&&R.extra.blockFlash.fx,sealClips:R.extra.sealCamClips,sealCam:R.extra.sealCam}),'errs',errs.length);
if(process.env.OUT)fs.writeFileSync(process.env.OUT,JSON.stringify(R,null,1));await b.close();process.exit(0);})().catch(e=>{console.error(e);process.exit(2);});
