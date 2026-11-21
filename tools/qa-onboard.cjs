const __PORT=process.env.PORT||'8090';
// M58 QA: the opening coach + opening guide arrow + first fight group + hurt/parry feedback; returning players see none of it.
const pc=require(process.env.PUPPETEER_CORE);const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:900000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let fails=0;const ok=(n,c,v)=>{if(!c)fails++;console.log((c?'PASS ':'FAIL ')+n,JSON.stringify(v));};const errs=[];
const open=async(vp,fresh)=>{const p=await b.newPage();await p.setViewport(vp);p.on('pageerror',e=>errs.push(e.message));
  await p.goto(`http://localhost:${__PORT}/?q=lite&tod=0.42&qa=1`,{waitUntil:'load'});
  if(fresh){await p.evaluate(()=>{localStorage.clear();localStorage.setItem('vale3d-hero',JSON.stringify({name:'Ilka',sex:'female'}));});await p.reload({waitUntil:'load'});}
  await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(600);await p.evaluate(()=>window.__vale.sim(Array(8).fill(1/30),0,0));return p;};
const st=(p)=>p.evaluate(()=>{const v=window.__vale,ui=v.combat().ui,c=document.getElementById('coach');return {coach:c.classList.contains('on')?c.textContent:'',pulse:(document.querySelector('.cpulse')||{}).id||'',arrow:ui.arrow,ctext:ui.ctext,done:JSON.parse(localStorage.getItem('vale3d-coach')||'[]'),guid:localStorage.getItem('vale3d-guidance'),fx:document.getElementById('fx').className,seals:v.quest().save.seals,started:v.quest().save.started};});
const PHONE={width:412,height:860,isMobile:true,hasTouch:true},DESK={width:1280,height:800};
// 1 · fresh phone start: move tip in touch words, arrow to the Wayfinder
let p=await open(PHONE,true);let s=await st(p);
ok('fresh: move/look tip in touch words',/Drag the circle/.test(s.coach),s);
ok('fresh: arrow + distance to the Wayfinder',s.arrow&&/^Wayfinder · /.test(s.ctext),s);
ok('fresh: guidance setting untouched',s.guid!=='on',{guid:s.guid});
// first fight group exists by day on the walk to the Forge Heart
const g=await p.evaluate(()=>window.__vale.world().groups.find(g=>g.id==='d-dome'));
ok('first-fight group: 2 husks by day near (8,38)',g&&!g.night&&g.present&&g.mobs.length===2&&g.mobs.every(m=>m.look==='husk'),g);
// 2 · start the quest → first-seal tip names the compass target; coach hides in dialogue
const wf=await p.evaluate(()=>window.__vale.quest().wayfinder);await p.evaluate((x,z)=>{window.__vale.warp(x,z+2.2);window.__vale.sim(Array(6).fill(1/30),0,0);window.__vale.interact();},wf.x,wf.z);
const inDlg=await p.evaluate(()=>getComputedStyle(document.getElementById('coach')).display);ok('coach hidden during dialogue',inDlg==='none',{inDlg});
for(let i=0;i<10;i++)await p.evaluate(()=>window.__vale.advance());await p.evaluate(()=>window.__vale.sim(Array(6).fill(1/30),0,0));s=await st(p);
const tname=s.ctext.split(' · ')[0];
ok('after the start talk: first-seal tip names the compass target',s.started&&s.coach.includes(tname)&&/follow the arrow/.test(s.coach),s);
ok('after the start talk: arrow + metres to the seal',s.arrow&&/ m$/.test(s.ctext),s);
// 3 · wind-up prompt pulses Roll (first lesson)
const m0=await p.evaluate(()=>{const g=window.__vale.world().groups.find(g=>g.id==='d-dome');return g.mobs[0];});
await p.evaluate((x,z)=>{window.__vale.warp(x,z-1.2);},m0.x,m0.z);let sawRoll=null;
for(let i=0;i<60&&!sawRoll;i++){await p.evaluate(()=>window.__vale.sim(Array(2).fill(1/30),0,0));const q=await st(p);if(/Wind-up/.test(q.coach))sawRoll=q;}
ok('wind-up → "tap Roll" prompt pulsing the Roll button',sawRoll&&/tap Roll/.test(sawRoll.coach)&&sawRoll.pulse==='b-dge',sawRoll);
// 4 · hurt flash
await p.evaluate(()=>{window.__vale.heal();window.__vale.sim([1/30],0,0);window.__vale.hurt(1);window.__vale.sim([1/30],0,0);});s=await st(p);
ok('a hit taken flashes the hurt vignette',s.fx==='hurt',{fx:s.fx});
// 5 · reload mid-opening (started, 0 seals) keeps the arrow
await p.evaluate(()=>window.__vale.heal());await p.reload({waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(500);await p.evaluate(()=>window.__vale.sim(Array(6).fill(1/30),0,0));s=await st(p);
ok('reload with 0 seals: arrow still shown',s.started&&s.arrow&&/ m$/.test(s.ctext),s);
// 6 · claim the first seal → claim tip, arrow reverts to the setting (off)
const near=await p.evaluate(()=>{const q=window.__vale.quest(),c=window.__vale.camInfo().st;return q.seals.filter(s=>!s.claimed).sort((a,b)=>Math.hypot(a.x-c.px,a.z-c.pz)-Math.hypot(b.x-c.px,b.z-c.pz))[0];});
await p.evaluate((x,z)=>{window.__vale.warp(x+1.6,z+1.6);window.__vale.sim(Array(6).fill(1/30),0,0);window.__vale.interact();window.__vale.sim(Array(10).fill(1/30),0,0);},near.x,near.z);s=await st(p);
ok('first seal claimed → "Seal 1 of 4" tip',Object.keys(s.seals).length===1&&/Seal 1 of 4/.test(s.coach),s);
await p.evaluate(()=>window.__vale.sim(Array(6).fill(1/30),0,0));s=await st(p);
ok('after the first seal: arrow follows the setting (off) → Journal clues',!s.arrow&&/clues in Journal/.test(s.ctext)&&s.guid!=='on',s);
// 7 · returning player with a seal: no tips at all, every tip marked done
await p.reload({waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(500);
for(let i=0;i<6;i++)await p.evaluate(()=>window.__vale.sim(Array(10).fill(1/30),0.6,-0.6));s=await st(p);
ok('returning player with a seal: no tip, no forced arrow',s.coach===''&&!s.arrow&&s.done.length>=12,s);
// Guidance on still shows the arrow as before
await p.evaluate(()=>window.__vale.setGuidance(true));await p.evaluate(()=>window.__vale.sim(Array(6).fill(1/30),0,0));s=await st(p);ok('guidance on → arrow (unchanged behaviour)',s.arrow&&/ m$/.test(s.ctext),s);
await p.evaluate(()=>window.__vale.setGuidance(false));await p.close();
// 8 · desktop words
p=await open(DESK,true);s=await st(p);ok('desktop: keyboard wording',/WASD/.test(s.coach),s);await p.close();
ok('no page errors',errs.length===0,errs.slice(0,3));
console.log(fails?`QA-ONBOARD FAIL ${fails}`:'QA-ONBOARD ALL PASS');await b.close();process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(2);});
