// M64D · targeted test: bosses — Vale Warden (2 phases: follow-up slam at ≤ half HP), Ossric (grave-sweep after the dead rise),
// title / phase / victory cards, every dangerous attack telegraphed ≥ 0.85 s and avoided by a scripted step-out (no damage),
// a kindled seal breaks the Warden's slam. EMULATED headless Chrome (not player data).
const pc=require(process.env.PUPPETEER_CORE);const fs=require('fs');const sleep=ms=>new Promise(r=>setTimeout(r,ms));const PORT=process.env.PORT||'8102';
let fails=0,n=0;const R={checks:[]};const ok=(name,c,d)=>{n++;R.checks.push({name,pass:!!c,d});console.log((c?'PASS ':'FAIL ')+name+(d!==undefined?' '+JSON.stringify(d).slice(0,500):''));if(!c)fails++;};
const SAVE=(o={})=>JSON.stringify({v:1,started:true,done:false,xp:100,seals:{forge:true,sun:true},runes:[0,0,0],wind:false,warden:false,mirrors:[0,0,0,0],beacon:false,echo:false,charted:[false,false,false,false,false,false,false],cave:0,coast:0,sea:0,lamp:0,weapons:['rusty'],weapon:'rusty',...o});
const ALLC=['move','talk','seal','attack','dodge','rolled','parry','parried','stamina','hurt','claim','pick'];
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:900000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const errs=[];
const page=async(save,q='&tod=0.42')=>{const p=await b.newPage();await p.setViewport({width:412,height:915,isMobile:true,hasTouch:true});p.on('pageerror',e=>errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?q=lite&qa=1${q}`,{waitUntil:'load'});
  await p.evaluate((s,c)=>{localStorage.clear();localStorage.setItem('vale3d-hero',JSON.stringify({name:'Ilka',sex:'female'}));localStorage.setItem('vale3d-coach',JSON.stringify(c));if(s)localStorage.setItem('vale3d-save',s);},save,ALLC);
  await p.reload({waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(400);return p;};
const sim=(p,k)=>p.evaluate(k=>window.__vale.sim(Array(k).fill(1/30),0,0),k);const WD=p=>p.evaluate(()=>window.__vale.warden());
// ---------- Vale Warden ----------
{const p=await page(SAVE());await sim(p,20);let w=await WD(p);const dx=w.recovery.x-w.x,dz=w.recovery.z-w.z,d=Math.hypot(dx,dz);
 const at=(off,side=0)=>p.evaluate((x,z)=>window.__vale.warp(x,z),w.x+dx/d*off+(-dz/d)*side,w.z+dz/d*off+(dx/d)*side);
 await at(9);let card=null;for(let i=0;i<20&&!card;i++){await sim(p,3);const s=await p.evaluate(()=>window.__vale.bossShown());if(!s.hidden&&s.cls.includes('intro'))card=s;}
 ok('Warden: title card on waking ("The Vale Warden")',card&&card.name==='The Vale Warden',card);
 // phase 1: tell ≥ 1.2 s; avoid by stepping out of the ring once it appears
 const tells=[];let hp0=(await WD(p)).playerHp,cycles=0,secondSeen=false,side=3.2;
 const runCycles=async(k)=>{for(let c=0;c<k;c++){let seenZone=false,startT=0,maxTele=0,frames=0;for(let i=0;i<150;i++){await p.evaluate(()=>window.__vale.heal&&0);await sim(p,1);const s=await WD(p);
     if(s.phase===1&&s.teleT>0){if(!seenZone||s.second!==tells.at(-1)?.second&&false){}
       const key=s.second?'second':'first';const last=tells.at(-1);if(!last||last.key!==key||last.done){tells.push({key,first:s.teleT,frames:0,done:false});await p.evaluate((x,z)=>window.__vale.warp(x,z),s.sx+3.6,s.sz+0.4);}
       tells.at(-1).frames++;tells.at(-1).max=Math.max(tells.at(-1).max||0,s.teleT);}
     else if(tells.length&&!tells.at(-1).done){tells.at(-1).done=true;if(tells.at(-1).key==='second')secondSeen=true;}
     if(s.phase===2&&tells.length&&tells.at(-1).done){break;}}
   for(let i=0;i<60;i++){await sim(p,1);const s=await WD(p);if(s.phase===1)break;}cycles++;}};
 await runCycles(2);const p1=tells.slice();const hpA=(await WD(p)).playerHp;
 ok('Warden phase 1: one slam per cycle, tell ≥ 1.1 s (design 1.25 s; first sampled frame), stepping out of the ring avoids it (no damage)',p1.length>=2&&p1.every(t=>t.key==='first'&&t.max>=1.1)&&hpA===hp0,{tells:p1.map(t=>({k:t.key,tell:+(t.max).toFixed(2)})),hp0,hpA});
 // phase 2
 await p.evaluate(()=>window.__vale.wardenHit(3.2));let ph=null;for(let i=0;i<6&&!ph;i++){await sim(p,2);const s=await p.evaluate(()=>window.__vale.bossShown());if(!s.hidden&&s.cls.includes('phase'))ph=s;}
 ok('Warden phase 2 card at ≤ half HP ("Its copper heart flares")',ph&&/copper heart/.test(ph.name),{ph,hp:(await WD(p)).hp});
 tells.length=0;const hpB=(await WD(p)).playerHp;await runCycles(2);const p2=tells.slice();const hpC=(await WD(p)).playerHp;
 ok('Warden phase 2: each slam is followed by a second one (tell ≥ 0.8 s sampled; design 0.9 s); both avoided by stepping out',p2.some(t=>t.key==='second')&&p2.filter(t=>t.key==='second').every(t=>t.max>=0.8)&&p2.filter(t=>t.key==='first').slice(1).every(t=>t.max>=1.1)&&hpC===hpB,{tells:p2.map(t=>({k:t.key,tell:+(t.max).toFixed(2)})),hpB,hpC});
 R.warden={phase1:p1.map(t=>+t.max.toFixed(2)),phase2:p2.map(t=>({k:t.key,tell:+t.max.toFixed(2)}))};
 // a kindled seal breaks the slam
 await p.evaluate(()=>window.__vale.setKindle(1));let broke=null;for(let i=0;i<150&&!broke;i++){await sim(p,1);const s=await WD(p);if(s.phase===1&&s.teleT>0.3){await p.evaluate(()=>window.__vale.kindleNow());await sim(p,1);const s2=await WD(p);broke={before:1,after:s2.phase};}}
 ok('a kindled seal (Glare/Daybreak/Undertow) breaks the Warden\'s slam',broke&&broke.after===2,broke);
 await p.evaluate(()=>window.__vale.wardenHit(99));await sim(p,4);const win=await p.evaluate(()=>window.__vale.bossShown());const sv=await p.evaluate(()=>window.__vale.quest().save);
 ok('Warden victory card + Crest saved',win.cls.includes('win')&&/Warden Sleeps/.test(win.name)&&sv.warden===true,{win,warden:sv.warden});
 await p.screenshot({path:'/workspace/vale3d-m64/shots/m64/m64d-warden-victory.png'});await p.close();}
// ---------- Ossric, the Barrow-King ----------
{const p=await page(SAVE());await sim(p,20);await p.evaluate(()=>window.__vale.barrowGo('enter'));await p.evaluate(()=>window.__vale.setSq({barrow:1}));await p.evaluate(()=>window.__vale.barrowGo('exit'));await sim(p,10);await p.evaluate(()=>window.__vale.barrowGo('enter'));await sim(p,20);
 await p.evaluate(()=>window.__vale.barrowWarp(0,33));const K=async()=>(await p.evaluate(()=>window.__vale.barrowMobs())).find(m=>m.king);let intro=null;
 for(let i=0;i<60&&!intro;i++){await sim(p,2);const s=await p.evaluate(()=>window.__vale.bossShown());if(!s.hidden&&s.cls.includes('intro'))intro=s;await p.evaluate(()=>window.__vale.heal());}
 ok('Ossric: title card when he engages',intro&&/Ossric/.test(intro.name),intro);
 const k0=await K();await p.evaluate(h=>window.__vale.barrowHit('king',h),Math.ceil(k0.hp/2)+1);await sim(p,3);const phc=(await p.evaluate(()=>window.__vale.bossLog())).find(l=>l.kind==='phase');
 ok('Ossric: the dead rise below half HP (phase card)',!!phc&&/dead rise/.test(phc.name),phc);
 // watch his blows: sweeps every third, tell measured; step out of the big ring when a sweep starts; normal blows → heal
 let sweeps=[],normal=[],cur=null,hpLoss=0;for(let i=0;i<900&&sweeps.length<2;i++){await p.evaluate(()=>window.__vale.heal());await sim(p,1);const k=await K();const hp=(await p.evaluate(()=>window.__vale.world())).playerHp;
   if(k.state==='windup'){if(!cur){cur={sw:k.sw,f:0};if(k.sw){const h0=hp;cur.h0=h0;await p.evaluate((x,z)=>{},k.x,k.z);await p.evaluate(()=>{const v=window.__vale;});}}cur.f++;if(cur.sw&&cur.f===8){await p.evaluate(()=>window.__vale.barrowWarp(0,22));}}
   else if(cur){(cur.sw?sweeps:normal).push(+(cur.f/30).toFixed(2));if(cur.sw){const after=(await p.evaluate(()=>window.__vale.world())).playerHp;if(after<cur.h0)hpLoss++;await p.evaluate(()=>window.__vale.barrowWarp(0,33));}cur=null;await p.evaluate(()=>window.__vale.heal());}}
 R.ossric={sweepTells:sweeps,normalTells:normal.slice(0,6)};
 ok('Ossric grave-sweep: appears after the dead rise, tell ≥ 1.2 s, avoidable by moving out (no damage)',sweeps.length>=1&&sweeps.every(t=>t>=1.2)&&hpLoss===0,{...R.ossric,hpLoss});
 await p.evaluate(()=>window.__vale.barrowHit('king',99));await sim(p,4);const win=await p.evaluate(()=>window.__vale.bossShown());
 ok('Ossric victory card',win.cls.includes('win')&&/Ossric Rests/.test(win.name),win);await p.screenshot({path:'/workspace/vale3d-m64/shots/m64/m64d-ossric-victory.png'});await p.close();}
ok('no page errors',errs.length===0,errs.slice(0,3));
R.fails=fails;R.total=n;console.log(fails?`M64D-BOSSES FAIL ${fails}/${n}`:`M64D-BOSSES PASS ${n}/${n}`);if(process.env.OUT)fs.writeFileSync(process.env.OUT,JSON.stringify(R,null,1));await b.close();process.exit(fails?1:0);})().catch(e=>{console.error('ERR',e.message,e.stack&&e.stack.split('\n')[1]);process.exit(2);});
