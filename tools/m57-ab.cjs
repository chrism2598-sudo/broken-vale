// M57 · Phase 1: under-bridge draw-call A/B across diag builds on ONE origin (identical localStorage save, path, settings, viewport).
// Serve <root>/m55|m56|m57/ (each a full dist with diag/). Env: BUILDS=m55,m56,m57 SAVES=fresh,mid,end SECS=30 SCENE=underbridge SEQ=base EXTRA=''
const PORT=process.env.PORT||'8098';const fs=require('fs');const pc=require(process.env.PUPPETEER_CORE);const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const B=(process.env.BUILDS||'m55,m56,m57').split(','),SV=(process.env.SAVES||'fresh,mid,end').split(','),SECS=process.env.SECS||'30',SC=process.env.SCENE||'underbridge',SEQ=process.env.SEQ||'base',EX=process.env.EXTRA||'';
const fog=s=>Array.from({length:48},(_,i)=>((i*2654435761+s)>>>0)&0x00ffff00);
const SAVES={fresh:{v:1,started:true,done:false,xp:0,seals:{},runes:[0,0,0],wind:false,warden:false,mirrors:[0,0,0,0],beacon:false,echo:false,charted:[false,false,false,false,false,false,false],cave:0,coast:0,sea:0,lamp:0,weapons:['rusty'],weapon:'rusty'},
 mid:{v:1,started:true,done:false,xp:200,seals:{dawn:true},runes:[1,2,0],wind:true,warden:false,mirrors:[1,0,3,2],beacon:false,echo:false,charted:[true,true,false,true,false,false,false],cave:1,coast:0,sea:0,lamp:0,weapons:['rusty','spear','knight'],weapon:'knight',fog:fog(5),fogV:2,secrets:['pale'],chests:['pale-library'],whet:1,day:2,sq:{ress:2},hpUp:1},
 end:{v:1,started:true,done:true,xp:510,seals:{dawn:true,sun:true,tide:true,forge:true},runes:[1,0,2],wind:true,warden:true,mirrors:[1,2,3,0],beacon:true,echo:true,charted:[true,true,true,true,true,true,true],cave:4,coast:3,sea:5,lamp:2,weapons:['rusty','spear','maul','tide','knight'],weapon:'tide',fog:fog(9),fogV:2,day:12}};
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:1800000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const rows=[];
 for(const sv of SV)for(const bd of B){const p=await b.newPage();await p.setViewport({width:448,height:827,deviceScaleFactor:2.25,isMobile:true,hasTouch:true});const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/${bd}/?q=lite&qa=1`,{waitUntil:'domcontentloaded'});
  await p.evaluate(s=>{localStorage.clear();localStorage.setItem('vale3d-hero',JSON.stringify({name:'Ilka',sex:'female'}));localStorage.setItem('vale3d-save',s);localStorage.setItem('vale3d-motion','fast');},JSON.stringify(SAVES[sv]));
  const url=`http://localhost:${PORT}/${bd}/diag/?q=lite&tod=0.42&motion=fast&diag=${SC}&seq=${SEQ}&secs=${SECS}&warm=5&cool=1${bd==='m57'?'&draws=1':''}${EX}`;
  await p.goto(url,{waitUntil:'load'});let r=null;const t0=Date.now();
  let simInfo=null;if(+process.env.SIMSECS>0){while(Date.now()-t0<600000){const st=await p.evaluate(()=>window.__diag&&window.__diag.status).catch(()=>'');if(/warm-up/.test(st||''))break;await sleep(500);}
   simInfo=await p.evaluate(n=>{const v=window.__vale;const q0=v.quest();const t=performance.now();v.sim(Array(Math.round(n*60)).fill(1/60),0,0);const q=v.quest();return {simMs:Math.round(performance.now()-t),hp:v.combat?v.combat().hp:null};},+process.env.SIMSECS).catch(e=>({err:e.message}));}
  while(!r&&Date.now()-t0<1500000){await sleep(3000);r=await p.evaluate(()=>window.__diag&&window.__diag.result).catch(()=>null);}
  if(!r){console.log('TIMEOUT',sv,bd);await p.close();continue;}
  for(const x of r.runs){const row={save:sv,build:bd,cfg:x.cfg,frames:x.frames,calls:x.drawCalls,tris:x.triangles,gameSecs:x.gameSecs,camStart:x.camStart,callsPer10s:x.callsPer10s,pr:x.pixelRatio,buf:x.drawingBuffer,errs:errs.length,simSecs:+process.env.SIMSECS||0,simInfo};
   rows.push({...row,draws:x.draws,world:r.world});console.log(JSON.stringify(row));
   if(x.draws){console.log('  byCategory',JSON.stringify(x.draws.byCategory));console.log('  byGroup',JSON.stringify(Object.fromEntries(Object.entries(x.draws.byGroup).slice(0,10))));console.log('  vis',JSON.stringify(x.draws.visibility),'tallied',x.draws.talliedPerFrame,'info',x.draws.infoCallsPerFrame);console.log('  top',x.draws.topObjects.slice(0,8).join('\n      '));}}
  await p.close();}
 fs.writeFileSync(process.env.OUT||'/tmp/m57-ab.json',JSON.stringify(rows,null,1));await b.close();})().catch(e=>{console.log('ERR',e.message);process.exit(2)});
