// M37 glitch probe: touch combat buttons calm/fight/after, night roamers spawned in geometry, jump state, save/reload at night
const pc=require(process.env.PUPPETEER_CORE||'puppeteer-core');const sleep=t=>new Promise(r=>setTimeout(r,t));
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:600000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage();await p.setViewport({width:412,height:915,hasTouch:true,isMobile:true});const errs=[];p.on('pageerror',e=>errs.push(String(e)));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
const go=async q=>{await p.goto('http://localhost:8090/?q=lite&qa=1&tod=0.42'+(q||''),{waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(800)};
const E=(f,...a)=>p.evaluate(f,...a);const log=(k,v)=>console.log(k,JSON.stringify(v));
await go();
const OLD={v:1,started:true,done:false,xp:40,seals:{dawn:true},runes:[0,0,0],wind:false,warden:false,mirrors:[0,0,0,0],beacon:false,echo:false,charted:[false,false,false,false,false,false,false],cave:0,coast:0,sea:0,lamp:0,weapons:['rusty','maul'],weapon:'maul',whet:4};
await E(o=>{localStorage.setItem('vale3d-hero',JSON.stringify({name:'Ilka',sex:'female'}));localStorage.setItem('vale3d-save',JSON.stringify(o));},OLD);await go();log('old save loads',await E(()=>({body:document.body.className,xp:__vale.quest().save.xp,st:__vale.camInfo().st})));
let u=(await E(()=>__vale.combat().ui));await E(()=>__vale.sim(Array(150).fill(1/30),0,0));u=(await E(()=>__vale.combat().ui));log('calm at spawn (combat btns hidden, jump shown)',{calm:u.calm,vis:u.buttons.filter(b=>b.vis).map(b=>b.id),body:await E(()=>document.body.className)});
// jump: hop and land
await E(()=>__vale.jump());await E(()=>__vale.sim(Array(Math.round(0.2*30)).fill(1/30),0,0));const h1=await E(()=>__vale.hop());await E(()=>__vale.sim(Array(Math.round(2*30)).fill(1/30),0,0));const h2=await E(()=>__vale.hop());log('jump air then landed',{mid:h1,after:h2});
// night: roamers in geometry
await E(()=>__vale.setTime(0.97));await E(()=>__vale.sim(Array(Math.round(10*30)).fill(1/30),0,0));
const bad=await E(()=>{const o=[];for(const g of __vale.world().groups)if(g.present)for(const m of g.mobs){const f=__vale.footProbe(m.x,m.z);if(f.blocked)o.push({g:g.id,m:m.id,x:m.x,z:m.z,name:f.name})}return o});
const groups=await E(()=>__vale.world().groups.filter(g=>g.present).map(g=>g.id));log('night groups present',groups);log('night mobs inside blocked geometry',bad);
// fight n-road then walk away at day: buttons must hide
const g=await E(()=>__vale.world().groups.find(x=>x.id==='n-road'));if(g){await E(()=>__vale.setTime(0.97));await E(()=>__vale.warp(-11,-24));await E(()=>__vale.sim(Array(600).fill(1/30),0,0));log('n-road',await E(()=>{const w=__vale.world(),g=w.groups.find(x=>x.id==='n-road');return {rk:w.rk,day:w.day,tod:w.tod,night:w.night,present:g.present,mobs:g.mobs.map(m=>[m.x,m.z,m.state,__vale.footProbe(m.x,m.z).blocked])}}));u=await E(()=>__vale.combat().ui);log('near night group: calm?',{calm:u.calm,vis:u.buttons.filter(b=>b.vis).map(b=>b.id),body:await E(()=>document.body.className)});
await E(()=>__vale.setTime(0.5));await E(()=>__vale.warp(0,6));await E(()=>__vale.sim(Array(Math.round(12*30)).fill(1/30),0,0));u=await E(()=>__vale.combat().ui);log('after leaving fight, day, at spawn: calm?',{calm:u.calm,vis:u.buttons.filter(b=>b.vis).map(b=>b.id),body:await E(()=>document.body.className),hp:(await E(()=>__vale.world().playerHp))});}
// save at night then reload: spawn and hour
await E(()=>__vale.setTime(0.95));await E(()=>__vale.warp(2.6,8));await E(()=>__vale.sim(Array(Math.round(3*30)).fill(1/30),0,0));const before=await E(()=>({tod:__vale.world().tod,st:__vale.camInfo().st}));
await sleep(2500);await go('&cycle=1');const after=await E(()=>({tod:__vale.world().tod,st:__vale.camInfo().st,hp:__vale.world().playerHp}));log('reload at night',{before,after});
const bad2=await E(()=>{const o=[];for(const g of __vale.world().groups)if(g.present)for(const m of g.mobs){const f=__vale.footProbe(m.x,m.z);if(f.blocked)o.push({g:g.id,m:m.id,name:f.name})}return o});log('after reload mobs in geometry',bad2);
log('errors',errs);await b.close()})().catch(e=>{console.log('CRASH',e.message);process.exit(1)});
