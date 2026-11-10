// M18 QA: title screen (Continue / New Game confirm / Settings), sound toggle + volume, music regions + crossfade, footsteps.
const puppeteer=require(process.env.PUPPETEER_CORE);const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:600000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
const p=await b.newPage();await p.setViewport({width:412,height:860});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
const log=(k,v)=>console.log(k,JSON.stringify(v));const V=(f,...a)=>p.evaluate(f,...a);const ready=()=>p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});
const A=()=>V(()=>window.__vale.audio());const T=()=>V(()=>window.__vale.title());const Q=()=>V(()=>window.__vale.quest());
await p.goto('http://localhost:8090/?q=lite',{waitUntil:'load'});await ready();await sleep(800);
log('first visit: creator, no title',{creator:await p.$eval('#create',e=>!e.hidden),title:(await T()).open});
await p.click('#begin');await sleep(1500);log('after Begin: audio',await A());
await p.reload({waitUntil:'load'});await ready();await sleep(1000);let t=await T();log('reload → title',t);
await p.click('#tset');await sleep(300);log('settings from title',{open:(await T()).settings,labels:await p.$$eval('#settings button',bs=>bs.map(x=>x.textContent))});
await p.click('#ssound');await sleep(700);const off=await A();await p.click('#ssound');await sleep(700);const on=await A();
await p.$eval('#svol',e=>{e.value='35';e.dispatchEvent(new Event('input'))});await sleep(200);
log('sound toggle + volume',{off:off.enabled,offCtx:off.ctx,on:on.enabled,onCtx:on.ctx,vol:(await A()).musicVol,stored:await V(()=>[localStorage.getItem('vale3d-sound'),localStorage.getItem('vale3d-music')])});
await p.click('#sclose');await sleep(300);await p.click('#tcont');await sleep(800);t=await T();log('Continue',{open:t.open,paused:t.paused,toast:await p.$eval('#toast',e=>e.textContent)});
const pp=()=>V(()=>{const v=window.__vale.debug.player.position;return{x:v.x,z:v.z}});const s0=(await A()).steps;let p0=await pp();
await p.keyboard.down('KeyW');await sleep(4000);await p.keyboard.up('KeyW');let p1=await pp();const a1=await A();
log('walk → footsteps',{moved:+Math.hypot(p1.x-p0.x,p1.z-p0.z).toFixed(1),steps:a1.steps-s0,surf:a1.surf,region:a1.region,gains:a1.gains});
const W=await V(()=>window.__vale.warden());await V((x,z)=>window.__vale.warp(x,z),W.x-14,W.z-8);await p.waitForFunction("window.__vale.warden().awake&&window.__vale.audio().gains.keeper>0.9",{timeout:60000}).catch(()=>log('WAIT FAIL keeper music',{}));const a2=await A();log('near the Warden → combat music crossfade',{region:a2.region,gains:a2.gains,awake:(await V(()=>window.__vale.warden())).awake});
const q=await Q();await V((x,z)=>window.__vale.warp(x,z+1.5),q.wayfinder.x,q.wayfinder.z);await p.waitForFunction("window.__vale.quest().near==='Talk · begin quest'",{timeout:60000}).catch(()=>log('WAIT FAIL wayfinder',{}));await p.keyboard.press('KeyE');await p.waitForFunction('window.__vale.quest().talking',{timeout:30000}).catch(()=>{});await sleep(500);for(let i=0;i<5&&(await Q()).talking;i++){await p.keyboard.press('Space');await sleep(300);}
await p.waitForFunction("window.__vale.audio().gains.meadow>0.9",{timeout:60000}).catch(()=>{});const a3=await A();log('back in the meadow',{region:a3.region,gains:a3.gains,started:(await Q()).save.started});
await p.reload({waitUntil:'load'});await ready();await sleep(1000);log('title with progress',await T());
await p.click('#tnew');await sleep(300);log('New Game → confirm',{confirm:(await T()).confirm,msg:await p.$eval('#tcmsg',e=>e.textContent)});
await p.click('#tno');await sleep(200);log('Keep my save',{confirm:(await T()).confirm,started:(await Q()).save.started});
await p.click('#tnew');await sleep(300);await Promise.all([p.waitForNavigation({timeout:120000}),p.click('#tyes')]);await ready();await sleep(800);
log('Erase → creator, save cleared',{creator:await p.$eval('#create',e=>!e.hidden),title:(await T()).open,save:(await Q()).save.started,stored:await V(()=>localStorage.getItem('vale3d-save'))});
for(const [shot,want] of [['coast-ress','coast'],['final-card','ending'],['lamp-after','coast']]){await p.goto(`http://localhost:8090/?q=lite&shot=${shot}`,{waitUntil:'load'});await ready();await sleep(1500);await p.mouse.click(200,300);await p.waitForFunction(w=>window.__vale.audio().region===w,{timeout:30000},want).catch(()=>{});const a=await A();log('region '+shot,{region:a.region,want,ok:a.region===want,ctx:a.ctx});}
log('errors',errs);await b.close();})().catch(e=>{console.log('ERR',e.message);process.exit(1)});
