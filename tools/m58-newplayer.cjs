// M58 · INTERNAL scripted new-player run (not player validation). Fresh storage → character creation → Wayfinder →
// first seal, driven only by what the screen shows: it walks where the arrow points (or, with no arrow, records that the
// direction was never shown and uses the nearest seal as a best case), fights foes that engage it, and reacts to
// a wind-up only the way the on-screen coach tells it to (no coach → a novice who just attacks).
// Reports game-seconds and inputs to the first seal, plus fight numbers and the coach tips it saw.
// PORT=8095 OUT=logs/m58/np-after.json SHOTS=dir node tools/m58-newplayer.cjs
const pc=require(process.env.PUPPETEER_CORE);const fs=require('fs');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const PORT=process.env.PORT||'8095',SHOTS=process.env.SHOTS||'',READ=2.5; // seconds a player spends reading one dialogue line
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:900000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage();await p.setViewport({width:412,height:860,isMobile:true,hasTouch:true});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(`http://localhost:${PORT}/?q=lite&tod=0.42`,{waitUntil:'load'});await p.evaluate(()=>localStorage.clear());await p.reload({waitUntil:'load'});
await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(1200);
const R={policy:process.env.POLICY||'follow-screen',port:PORT,bundle:await p.evaluate(()=>[...document.scripts].map(s=>s.src).find(s=>/index-/.test(s))?.split('/').pop()),taps:0,dlgLines:0,game:0,dist:0,coach:[],phases:{},fight:{windups:0,hitsTaken:0,rolls:0,parries:0,blocks:0,kills:0,attacks:0},arrowShown:{},compass:{},errs};
let shotN=0;const shot=async(n)=>{if(!SHOTS)return;fs.mkdirSync(SHOTS,{recursive:true});await p.screenshot({path:`${SHOTS}/${String(++shotN).padStart(2,'0')}-${n}.png`});};
const look=()=>p.evaluate(()=>{const v=window.__vale,ui=v.combat().ui,c=document.getElementById('coach'),q=v.quest(),w=v.world(),cam=v.camInfo().st,cb=v.combat();
  const mobs=[];for(const g of w.groups)if(g.present)for(const m of g.mobs)if(m.alive&&m.vis)mobs.push({x:m.x,z:m.z,st:m.state,d:Math.hypot(m.x-cam.px,m.z-cam.pz)});mobs.sort((a,b)=>a.d-b.d);
  return {px:cam.px,pz:cam.pz,yaw:cam.yaw,arrow:ui.arrow,ctext:ui.ctext,coach:c&&c.classList.contains('on')?c.textContent:'',pulse:(document.querySelector('.cpulse')||{}).id||'',near:q.near,talking:q.talking,seals:q.seals,started:q.save.started,hp:w.playerHp,ctl:v.ctl(),mob:mobs[0]||null,counts:cb.counts,stam:cb.stamina,rolling:cb.rolling}});
let S=await look();const seen=new Set();
const note=(s)=>{if(s.coach&&!seen.has(s.coach)){seen.add(s.coach);R.coach.push({t:+R.game.toFixed(1),text:s.coach,pulse:s.pulse});}};
const step=async(sx,sy,n=3)=>{await p.evaluate((sx,sy,n)=>window.__vale.sim(Array(n).fill(1/30),sx,sy),sx,sy,n);R.game+=n/30;const o=S;S=await look();R.dist+=Math.hypot(S.px-o.px,S.pz-o.pz);note(S);if(S.hp<o.hp)R.fight.hitsTaken+=o.hp-S.hp;};
const stickTo=(x,z)=>{const dx=x-S.px,dz=z-S.pz,L=Math.hypot(dx,dz)||1,ux=dx/L,uz=dz/L,sn=Math.sin(S.yaw),cs=Math.cos(S.yaw);return [ux*cs-uz*sn,ux*sn+uz*cs];};
const creating=await p.evaluate(()=>!document.getElementById('create').hidden);if(creating){await shot('create');await p.click('#begin');R.taps++;await sleep(800);}
S=await look();note(S);await step(0,0,6);await shot('spawn');R.compass.spawn=S.ctext;R.arrowShown.spawn=S.arrow;
for(let i=0;i<10;i++){await p.evaluate(()=>{const v=window.__vale,c=v.camInfo().st;v.view(c.yaw+0.09,c.yaw+0.09,0.15,c.dist);});await step(0,0,3);}
const wf=await p.evaluate(()=>window.__vale.quest().wayfinder);let t0=R.game;
for(let i=0;i<300&&!/^Talk/.test(S.near||'');i++){const [sx,sy]=stickTo(wf.x,wf.z);await step(sx,sy);}
await shot('wayfinder');R.phases.toWayfinder=+(R.game-t0).toFixed(1);
await p.evaluate(()=>window.__vale.interact());R.taps++;await sleep(50);S=await look();
for(let i=0;i<20&&S.talking;i++){R.dlgLines++;R.taps++;await p.evaluate(()=>window.__vale.advance());await step(0,0,2);}
await step(0,0,6);await shot('quest-start');R.compass.afterQuest=S.ctext;R.arrowShown.afterQuest=S.arrow;
const target=()=>{const open=S.seals.filter(s=>!s.claimed);open.sort((a,b)=>Math.hypot(a.x-S.px,a.z-S.pz)-Math.hypot(b.x-S.px,b.z-S.pz));return open[0];};
const tgt=target();R.firstSeal=tgt.id;R.firstSealDist=+Math.hypot(tgt.x-S.px,tgt.z-S.pz).toFixed(1);
t0=R.game;let fightT=0,windT=-1,plan=null,wasWind=false,shotWind=false,stuck=0,lastD=1e9;
for(let i=0;i<4000;i++){
  if(/^Claim/.test(S.near||''))break;
  const m=S.mob,eng=m&&m.d<9&&S.ctl.hostile&&m.st!=='idle';
  if(eng){fightT+=0.1;const wind=m.st==='windup';
    if(wind&&!wasWind){R.fight.windups++;windT=R.game;
      plan=process.env.POLICY==='novice'?null:/Roll|roll/.test(S.coach)?'roll':/Block|parry|Q right/.test(S.coach)?'parry':null;
      if(plan==='roll')R.fight.rolls++;if(plan==='parry')R.fight.blocks++;}
    if(wind&&!shotWind){shotWind=true;await step(0,0,4);await shot('windup');}
    if(wind&&plan==='roll'&&R.game-windT>=0.35){await p.keyboard.press('KeyC');plan='done';}
    if(wind&&plan==='parry'&&R.game-windT>=0.78){await p.keyboard.down('KeyQ');plan='held';}
    if(!wind&&wasWind&&plan==='held'){await step(0,0,2);await p.keyboard.up('KeyQ');plan=null;}
    wasWind=wind;
    if(m.d>1.7&&!wind){const [sx,sy]=stickTo(m.x,m.z);await step(sx,sy);continue;}
    if(!wind&&!S.rolling){await p.keyboard.press('KeyK');R.fight.attacks++;}
    await step(0,0);continue;}
  const [sx,sy]=stickTo(tgt.x,tgt.z);await step(sx,sy);
  const d=Math.hypot(tgt.x-S.px,tgt.z-S.pz);if(d>lastD-0.05)stuck++;else stuck=0;lastD=d;if(stuck>80){R.stuck=true;break;}}
R.phases.toSeal=+(R.game-t0).toFixed(1);R.gameToSeal=+R.game.toFixed(1);R.estWallToSeal=+(R.game+R.dlgLines*READ+(R.taps+1)*0.6).toFixed(1);R.phases.fight=+fightT.toFixed(1);
R.fight.parries=S.counts.parry;R.fight.kills=await p.evaluate(()=>window.__vale.world().groups.reduce((n,g)=>n+(g.present?g.mobs.filter(m=>!m.alive).length:0),0));
await p.evaluate(()=>window.__vale.interact());R.taps++;await step(0,0,12);await shot('seal');
R.claimed=await p.evaluate(()=>window.__vale.quest().save.seals);
for(let i=0;i<6;i++)await step(0,0,6);R.compass.afterSeal=S.ctext;R.arrowShown.afterSeal=S.arrow;
// 3 · the early discovery: walk to the nearest weapon pickup if it is within 40 m of the seal (best case for the baseline)
{const pk=await p.evaluate(()=>window.__vale.combat().picks.filter(k=>!k.taken));const cand=pk.map(k=>({...k,d:Math.hypot(k.x-S.px,k.z-S.pz)})).sort((a,b)=>a.d-b.d)[0];
 R.pick={id:cand&&cand.id,dist:cand&&+cand.d.toFixed(1),prompted:R.coach.some(c=>/glints/.test(c.text))};
 if(cand&&cand.d<40){const t1=R.game;for(let i=0;i<600&&!/^Take/.test(S.near||'');i++){const [sx,sy]=stickTo(cand.x,cand.z);await step(sx,sy);}
  await p.evaluate(()=>window.__vale.interact());R.taps++;await step(0,0,12);await shot('pick');R.pick.secs=+(R.game-t1).toFixed(1);R.pick.owned=await p.evaluate(()=>window.__vale.combat().owned);}}
R.hpEnd=S.hp;R.defeats=await p.evaluate(()=>window.__vale.world().down>0?1:0);R.gameEnd=+R.game.toFixed(1);
R.coachDone=await p.evaluate(()=>{try{return JSON.parse(localStorage.getItem('vale3d-coach')||'[]')}catch{return null}});
console.log(JSON.stringify(R,null,1));if(process.env.OUT)fs.writeFileSync(process.env.OUT,JSON.stringify(R,null,1));
await b.close();process.exit(errs.length?1:0);})().catch(e=>{console.error(e);process.exit(2);});
