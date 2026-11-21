// M59 layout check (EMULATED, headless Chrome): coach tip vs action button / controls / hero. BASE=http://localhost:8095/ for a local build.
// MODE=pace : real-time frames (rAF) for a calm walk and the opening husk fight, Pixel-9-like 412x915 @ DPR 2.25, touch, mobile UA.
// MODE=layout W=.. H=.. : sim-driven opening; at each coach tip measure overlaps (coach vs hero / Attack / Roll / Block / joystick) + screenshots.
const pc=require(process.env.PUPPETEER_CORE);const fs=require('fs');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const URL=(process.env.BASE||'https://chrism2598-sudo.github.io/broken-vale/')+'?tod=0.42&adapt=1'+(process.env.MODE==='pace'?'&perf=1':'');
const W=+(process.env.W||412),H=+(process.env.H||915),OUT=process.env.OUT||'/workspace/vale3d/logs/m58-live',TAG=process.env.MODE+'-'+W+'x'+H;
const UA='Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:900000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--incognito']});
const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.setUserAgent(UA);await p.setViewport({width:W,height:H,deviceScaleFactor:2.25,isMobile:true,hasTouch:true});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(URL,{waitUntil:'load',timeout:120000});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:300000});await sleep(1500);
const R={label:'EMULATED (headless Chrome, SwiftShader CPU GL; not a real device, not representative of the Mali GPU)',url:URL,viewport:`${W}x${H}@2.25`,errs};
R.boot=await p.evaluate(()=>({bundle:[...document.scripts].map(s=>s.src).find(s=>/index-/.test(s))?.split('/').pop(),storage:Object.keys(localStorage),touch:document.body.classList.contains('touch'),create:!document.getElementById('create').hidden,quality:window.__vale.quality,pr:window.__vale.debug.renderer.getPixelRatio()}));
const shot=async(n)=>{const f=`${OUT}/${TAG}-${n}.png`;await p.screenshot({path:f});return f;};
if(R.boot.create){await p.tap('#begin');await sleep(800);}
const st=()=>p.evaluate(()=>{const v=window.__vale,cam=v.camInfo().st,w=v.world(),ui=v.combat().ui;const mobs=[];for(const g of w.groups)if(g.present)for(const m of g.mobs)if(m.alive&&m.vis)mobs.push({x:m.x,z:m.z,st:m.state,d:Math.hypot(m.x-cam.px,m.z-cam.pz)});mobs.sort((a,b)=>a.d-b.d);
  const c=document.getElementById('coach');return {px:cam.px,pz:cam.pz,yaw:cam.yaw,coach:c.classList.contains('on')?c.textContent:'',pulse:(document.querySelector('.cpulse')||{}).id||'',arrow:ui.arrow,ctext:ui.ctext,near:v.quest().near,talking:v.quest().talking,hp:w.playerHp,mob:mobs[0]||null,hostile:v.ctl().hostile,seals:v.quest().seals,rolling:v.combat().rolling,owned:v.combat().owned};});
// overlap measurement: coach rect vs controls and the hero's projected screen box
const rects=()=>p.evaluate(()=>{const v=window.__vale,THREE_=v.debug.camera.position.constructor,cam=v.debug.camera,pl=v.debug.player;const r=(id)=>{const e=document.getElementById(id);if(!e)return null;const b=e.getBoundingClientRect(),cs=getComputedStyle(e);const vis=b.width>0&&cs.visibility!=='hidden'&&cs.display!=='none'&&+cs.opacity>0.05;return vis?{x:b.x,y:b.y,w:b.width,h:b.height}:null;};
  const pts=[];for(const dx of [-0.35,0.35])for(const dz of [-0.35,0.35])for(const y of [0,1.75]){const q=new THREE_(pl.position.x+dx,pl.position.y+y,pl.position.z+dz).project(cam);pts.push([(q.x+1)/2*innerWidth,(1-q.y)/2*innerHeight]);}
  const xs=pts.map(a=>a[0]),ys=pts.map(a=>a[1]);const hero={x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
  const c=document.getElementById('coach'),cr=c.classList.contains('on')?r('coach'):null;
  const ov=(a,b)=>{if(!a||!b)return 0;const w=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)),h=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));return Math.round(w*h);};
  const o={coach:cr,hero:{...hero,x:Math.round(hero.x),y:Math.round(hero.y),w:Math.round(hero.w),h:Math.round(hero.h)}};
  for(const id of ['b-atk','b-dge','b-blk','b-hvy','b-jmp','b-wpn','joy','action','combat','toast','stam']){const b=r(id);o[id]=b?{area:ov(cr,b),y:Math.round(b.y)}:null;}
  o.heroOverlapPx=ov(cr,hero);o.heroOverlapPct=hero.w*hero.h>0?Math.round(100*ov(cr,hero)/(hero.w*hero.h)):0;
  // which part of the hero is covered (fraction of hero height from the top that sits under the banner)
  if(cr){const top=Math.max(cr.y,hero.y),bot=Math.min(cr.y+cr.h,hero.y+hero.h);o.heroCoveredBand=bot>top?[Math.round((top-hero.y)/hero.h*100),Math.round((bot-hero.y)/hero.h*100)]:null;}
  return o;});
const stick=(S,x,z)=>{const dx=x-S.px,dz=z-S.pz,L=Math.hypot(dx,dz)||1,ux=dx/L,uz=dz/L,sn=Math.sin(S.yaw),cs=Math.cos(S.yaw);return [ux*cs-uz*sn,ux*sn+uz*cs];};
const wf=await p.evaluate(()=>window.__vale.quest().wayfinder);
if(process.env.MODE==='pace'){
  // rAF recorder with phase tags + draw calls per frame
  await p.evaluate(()=>{window.__rec=[];window.__phase='boot';const R=window.__vale.debug.renderer;let last=performance.now();const f=(t)=>{window.__rec.push([window.__phase,t-last,R.info.render.calls]);last=t;requestAnimationFrame(f);};requestAnimationFrame(f);});
  // real-time steering by camera facing + W key (no sim): aim the camera at the target every 250 ms
  const aim=(x,z)=>p.evaluate((x,z)=>{const v=window.__vale,c=v.camInfo().st;const h=Math.atan2(x-c.px,z-c.pz);v.view(h,h-Math.PI,0.15,c.dist);},x,z);
  await p.evaluate(()=>{window.__phase='calm-idle';});await sleep(5000);
  await p.evaluate(()=>{window.__phase='calm-walk';window.__vale.key('KeyW',true);});
  for(let i=0;i<120;i++){const S=await st();if(/^Talk/.test(S.near||''))break;await aim(wf.x,wf.z);await sleep(250);}
  await p.evaluate(()=>{window.__vale.key('KeyW',false);window.__vale.interact();});await sleep(300);
  for(let i=0;i<10;i++){await p.evaluate(()=>window.__vale.advance());await sleep(200);}
  R.afterQuest=await st();
  const seal=R.afterQuest.seals.filter(s=>!s.claimed).sort((a,b)=>Math.hypot(a.x-R.afterQuest.px,a.z-R.afterQuest.pz)-Math.hypot(b.x-R.afterQuest.px,b.z-R.afterQuest.pz))[0];
  await p.evaluate(()=>{window.__phase='calm-walk';window.__vale.key('KeyW',true);});
  let fightStart=0,fightEnd=0,windSeen=0,lastWind=false,prompts=[];const t0=Date.now();
  for(let i=0;i<1200&&Date.now()-t0<240000;i++){const S=await st();if(S.coach&&!prompts.some(x=>x.text===S.coach))prompts.push({text:S.coach,pulse:S.pulse,t:((Date.now()-t0)/1000).toFixed(1)});
    if(/^Claim/.test(S.near||''))break;
    const m=S.mob,eng=m&&m.d<10&&S.hostile&&m.st!=='idle';
    if(eng){if(!fightStart){fightStart=Date.now();await p.evaluate(()=>{window.__phase='fight';});}
      const wind=m.st==='windup';if(wind&&!lastWind){windSeen++;if(windSeen===1)R.windShot=await shot('fight-windup');
        if(/Roll/.test(S.coach))await p.keyboard.press('KeyC');else if(/Block/.test(S.coach)){await p.keyboard.down('KeyQ');await sleep(250);await p.keyboard.up('KeyQ');}}
      lastWind=wind;
      if(m.d>1.8){await aim(m.x,m.z);await p.evaluate(()=>window.__vale.key('KeyW',true));}else{await p.evaluate(()=>window.__vale.key('KeyW',false));if(!wind&&!S.rolling)await p.keyboard.press('KeyK');}
      await sleep(80);continue;}
    if(fightStart&&!fightEnd){fightEnd=Date.now();await p.evaluate(()=>{window.__phase='calm-walk2';});}
    await p.evaluate(()=>window.__vale.key('KeyW',true));await aim(seal.x,seal.z);await sleep(200);}
  await p.evaluate(()=>{window.__vale.key('KeyW',false);window.__phase='end';});
  R.fightSecs=fightStart?(((fightEnd||Date.now())-fightStart)/1000).toFixed(1):0;R.windups=windSeen;R.prompts=prompts;
  const rec=await p.evaluate(()=>window.__rec);const by={};for(const [ph,dt,dc] of rec){if(ph==='boot'||ph==='end')continue;(by[ph]??=[]).push([dt,dc]);}
  R.pacing={};for(const [ph,a] of Object.entries(by)){const d=a.map(x=>x[0]).filter(x=>x<2000).sort((x,y)=>x-y),n=d.length,sum=d.reduce((s,x)=>s+x,0),q=k=>d[Math.min(n-1,Math.floor(k*n))];const dc=a.map(x=>x[1]).sort((x,y)=>x-y);
    R.pacing[ph]={frames:n,fps:+(1000*n/sum).toFixed(1),p50:+q(0.5).toFixed(1),p95:+q(0.95).toFixed(1),p99:+q(0.99).toFixed(1),over33:d.filter(x=>x>33.4).length,over50:d.filter(x=>x>50).length,over33pct:+(100*d.filter(x=>x>33.4).length/n).toFixed(1),drawsAvg:Math.round(dc.reduce((s,x)=>s+x,0)/dc.length),drawsMax:dc[dc.length-1]};}
  R.adapt=await p.evaluate(()=>{try{return window.__vale.adapt.stats()}catch(e){return String(e)}});
  R.perfHud=await p.evaluate(()=>{const e=document.querySelector('#perfhud,.perfhud,[id*=perf]');return e?e.textContent.slice(0,300):null;});
  R.endShot=await shot('end');
}else{
  // layout: sim-driven, measure at each new coach tip
  const seen=[];let S=await st();
  const measure=async(why)=>{S=await st();if(!S.coach||seen.some(x=>x.text===S.coach))return;await p.evaluate(()=>window.__vale.sim([1/30],0,0));await sleep(450);/* let the CSS fade settle */const o=await rects();const f=await shot(String(seen.length+1).padStart(2,'0')+'-'+why);seen.push({why,text:S.coach,pulse:S.pulse,arrow:S.arrow,ctext:S.ctext,...o,shot:f});};
  const step=async(sx,sy,n=3)=>{await p.evaluate((sx,sy,n)=>window.__vale.sim(Array(n).fill(1/30),sx,sy),sx,sy,n);S=await st();};
  await step(0,0,6);await measure('spawn');
  for(let i=0;i<300&&!/^Talk/.test(S.near||'');i++){const [a,c]=stick(S,wf.x,wf.z);await step(a,c);await measure('to-wayfinder');}
  await measure('near-wayfinder');await p.evaluate(()=>window.__vale.interact());await sleep(100);
  for(let i=0;i<10;i++){await p.evaluate(()=>window.__vale.advance());await step(0,0,2);}
  await step(0,0,6);await measure('quest');
  const seal=S.seals.filter(s=>!s.claimed).sort((a,b)=>Math.hypot(a.x-S.px,a.z-S.pz)-Math.hypot(b.x-S.px,b.z-S.pz))[0];let lastWind=false,plan=null,wT=0;
  for(let i=0;i<2000;i++){if(/^Claim/.test(S.near||''))break;const m=S.mob,eng=m&&m.d<9&&S.hostile&&m.st!=='idle';
    if(eng){const wind=m.st==='windup';if(wind&&!lastWind){wT=0;plan=/Roll/.test(S.coach)?'roll':/Block/.test(S.coach)?'parry':null;}if(wind)wT+=0.1;
      if(plan==='roll'&&wT>=0.35){await p.keyboard.press('KeyC');plan=null;}if(plan==='parry'&&wT>=0.78){await p.keyboard.down('KeyQ');plan='held';}if(!wind&&lastWind&&plan==='held'){await step(0,0,2);await p.keyboard.up('KeyQ');plan=null;}
      lastWind=wind;if(m.d>1.7&&!wind){const [a,c]=stick(S,m.x,m.z);await step(a,c);}else{if(!wind&&!S.rolling)await p.keyboard.press('KeyK');await step(0,0);}await measure('fight');continue;}
    const [a,c]=stick(S,seal.x,seal.z);await step(a,c);await measure('walk');}
  await p.evaluate(()=>window.__vale.interact());await step(0,0,6);await measure('seal');R.sealShot=await shot('seal-claimed');
  R.afterSeal={arrow:S.arrow,ctext:S.ctext};
  const pk=(await p.evaluate(()=>window.__vale.combat().picks)).filter(k=>!k.taken).map(k=>({...k,d:Math.hypot(k.x-S.px,k.z-S.pz)})).sort((a,b)=>a.d-b.d)[0];R.pick={id:pk&&pk.id,dist:pk&&+pk.d.toFixed(1)};
  for(let i=0;i<40;i++){await step(0,0,6);await measure('after-seal');}
  if(pk){for(let i=0;i<300&&!/^Take/.test(S.near||'');i++){const [a,c]=stick(S,pk.x,pk.z);await step(a,c);if(i===25)R.pickApproachShot=await shot('maul-approach');}
    R.pick.label=S.near;R.pick.nearShot=await shot('maul-near');await p.evaluate(()=>window.__vale.interact());await step(0,0,10);await sleep(500);R.pick.owned=(await st()).owned;R.pick.toast=await p.evaluate(()=>document.getElementById('toast').textContent);R.pick.shot=await shot('maul-taken');}
  R.tips=seen;
}
fs.writeFileSync(`${OUT}/${TAG}.json`,JSON.stringify(R,null,1));console.log(JSON.stringify(R,null,1).slice(0,6000));await b.close();})().catch(e=>{console.error(e);process.exit(2);});
