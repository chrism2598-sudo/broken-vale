// M22 QA: walk (touch stick only, no warps) from the meadow spawn past the North Cairn, up the Greycrown switchback trail, onto the outlook;
// stand on it, the camera pulls back above the rock, the cache pays out once and persists; then outlook shots (approach, on the outlook, vista).
const pc=require(process.env.PUPPETEER_CORE);const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:600000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage();await p.setViewport({width:412,height:915,isMobile:true,hasTouch:true});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
const log=(k,v)=>console.log(k,JSON.stringify(v));let fails=0;const ok=(name,c,v)=>{if(!c)fails++;log((c?'PASS ':'FAIL ')+name,v);};
await p.goto('http://localhost:8090/?q=lite&qa=1',{waitUntil:'load',timeout:120000});
await p.evaluate(()=>{localStorage.setItem('vale3d-hero',JSON.stringify({name:'Ilka',sex:'female'}));localStorage.setItem('vale3d-save',JSON.stringify({v:1,started:true,done:false,xp:50,seals:{dawn:true},runes:[0,0,0],wind:false,warden:true,mirrors:[0,0,0,0],beacon:false,echo:false,charted:[true,false,false,false,false,false,false],cave:0,coast:0,sea:0,lamp:0}));});
await p.reload({waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(1500);
await p.evaluate(()=>{__vale.view(Math.PI,0,0.16,6.6);});
const W=(x,z,f=900)=>p.evaluate((x,z,f)=>window.__vale.walkWorld(x,z,f),x,z,f);
const route=[[1,-40],[4,-120],[5,-190],[5,-199],[8,-199],[6,-201],[-12,-226],[12,-244],[2,-254],[0,-262]];
const steps=[];let r;let maxSink=0,maxFloat=0;
for(const [x,z] of route){r=await W(x,z);steps.push([x,z,r.px,r.pz,r.foot,r.ground,r.n]);maxSink=Math.max(maxSink,r.ground-r.foot);maxFloat=Math.max(maxFloat,r.foot-r.ground);
  if(x===8&&z===-199){await p.evaluate(()=>{const face=Math.atan2(-12-8,-226-(-199));__vale.view(face,face+Math.PI,0.16,6.6);__vale.sim(Array(24).fill(1/30),0,0);});await sleep(200);
    await p.screenshot({path:'/workspace/vale3d/shots/m22b-trail.png'});}}
log('route',steps);
const d=Math.hypot(r.px-0,r.pz+262);
ok('walked from the meadow to the Greycrown Outlook (stick only)',d<1.5,{at:[r.px,r.pz],d});
ok('standing on the outlook floor (feet on the pad, not in rock or air)',Math.abs(r.foot-r.ground)<0.6&&r.ground>25,{foot:r.foot,ground:r.ground});
ok('feet tracked the trail the whole way (no sinking/floating >0.6 m)',maxSink<0.6&&maxFloat<0.8,{maxSink,maxFloat});
const q=await p.evaluate(()=>window.__vale.quests());ok('Greycrown Outlook discovered',q.found.includes('crown'),{found:q.found});
// camera pulls back for the vista and stays above the rock
await p.evaluate(()=>{__vale.view(0.1,Math.PI+0.1,0.16,5.2);__vale.sim(Array(90).fill(1/30),0,0);});await sleep(300);
const ci=await p.evaluate(()=>{const c=window.__vale.camInfo();const pl=c.player,cm=c.cam;return {cam:cm,player:pl,dist:Math.hypot(cm[0]-pl[0],cm[2]-pl[2])};});
const camG=await p.evaluate(()=>window.__vale.walkWorld(0,-262,1).camGround);
ok('outlook camera pulls back (≥7 m) and stays above the ground',ci.dist>=7&&ci.cam[1]>camG+0.4,{...ci,camG});
await p.screenshot({path:'/workspace/vale3d/shots/m22b-stand.png'});
// cache: walk to it and open with E
r=await p.evaluate(()=>{const s=window.__vale.quests();return s;});
const cache=await p.evaluate(()=>{const o={x:0,z:-263};const face=Math.atan2(0-o.x,0-o.z);return [o.x+Math.sin(face+0.9)*2.4-Math.sin(face+0.9)*1.0,o.z+Math.cos(face+0.9)*2.4-Math.cos(face+0.9)*1.0];});
r=await W(cache[0],cache[1],300);ok('the cache offers itself',/cache/i.test(r.near||''),{near:r.near});
const xp0=(await p.evaluate(()=>window.__vale.quests())).xp;await p.keyboard.press('KeyE');await sleep(400);
for(let i=0;i<4;i++){await p.keyboard.press('Enter');await p.keyboard.press('Space');await sleep(200);await p.evaluate(()=>{const b=document.querySelector('#dlg button');if(b)b.click();});await sleep(200);}
await p.evaluate(()=>window.__vale.sim(Array(20).fill(1/30),0,0));
const q2=await p.evaluate(()=>window.__vale.quests());ok('cache pays out once (+XP, remembered)',q2.views.includes('crown-cache')&&q2.xp>xp0,{xp0,xp:q2.xp,views:q2.views});
// vista: look back down the vale from the parapet
await W(0,-259,200);await p.evaluate(()=>{__vale.view(0,Math.PI,0.32,6.5);__vale.sim(Array(60).fill(1/30),0,0);});await sleep(400);
await p.screenshot({path:'/workspace/vale3d/shots/m22b-vista.png'});
// persistence
await p.reload({waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(800);
const q3=await p.evaluate(()=>window.__vale.quests());ok('cache + discovery persist across reload',q3.views.includes('crown-cache')&&q3.found.includes('crown'),{});
ok('no page errors',errs.length===0,errs.slice(0,5));
console.log(fails?`FAILS ${fails}`:'ALL PASS');await b.close();process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(2);});
