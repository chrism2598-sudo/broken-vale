// M20b-2 QA: side tales (Sefa, Dov, Ress), discovery → map, the Ashen Hollow fight + loot, the Old Barrow (gate, Ossric, vault), standables, save migration.
const pc=require(process.env.PUPPETEER_CORE||'puppeteer-core');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0;const ok=(n,c,d)=>{console.log((c?'PASS ':'FAIL ')+n+(d!==undefined?' '+JSON.stringify(d):''));if(!c)fails++;};
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:900000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});await p.setViewport({width:412,height:860,isMobile:true,hasTouch:true});
const E=(f,...a)=>p.evaluate(f,...a);const Q=()=>E(()=>window.__vale.quests());const W=()=>E(()=>window.__vale.world());
const sim=(n,sx=0,sy=0)=>E((n,sx,sy)=>{window.__vale.sim(Array(n).fill(1/30),sx,sy);},n,sx,sy);
const ready=()=>p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});
const closeDlg=()=>E(()=>{const V=window.__vale;for(let i=0;i<40&&V.quest().talking;i++)V.interact();return V.quest().talking;});
const act=async()=>{await E(()=>window.__vale.interact());await sim(2);return closeDlg();};
// an old (pre-M20b-2) save: started, coast reached, fog explored in the old 266×278 box, no side-tale fields
const fog=Array(48).fill(0);for(let j=18;j<30;j++)fog[j]=0x00ffff00;
const OLD={v:1,started:true,done:false,xp:120,seals:{dawn:true},runes:[0,0,0],wind:false,warden:false,mirrors:[0,0,0,0],beacon:false,echo:false,charted:[false,false,false,false,false,false,false],cave:4,coast:1,sea:0,lamp:0,weapons:['rusty','maul'],weapon:'maul',whet:4,fog,tod:0.45,day:0};
await p.goto('http://localhost:8090/?q=lite&qa=1&tod=0.45',{waitUntil:'load',timeout:120000});
await E((o)=>{localStorage.setItem('vale3d-hero',JSON.stringify({name:'Ilka',sex:'female'}));localStorage.setItem('vale3d-save',JSON.stringify(o));},OLD);
await p.reload({waitUntil:'load'});await ready();await sleep(1500);await sim(40);
let q=await Q();const bits=f=>f.reduce((n,v)=>{let x=v>>>0,c=0;while(x){c+=x&1;x>>>=1;}return n+c;},0);
let sv=await E(()=>JSON.parse(localStorage.getItem('vale3d-save')));
ok('old save loads · fog migrated to the widened map (v2), explored area kept',q.fogV===2&&sv.fogV===2&&bits(sv.fog)>=80&&bits(sv.fog)<bits(fog),{fogV:q.fogV,bits:[bits(fog),bits(sv.fog)]});
ok('old save: no side-tale progress, base hearts',Object.keys(q.sq).length===0&&q.hpUp===0,{sq:q.sq,hpMax:q.hpMax});
const HP0=q.hpMax;
// ---- Discovery ----
const xp0=q.xp;await E(()=>window.__vale.warp(165-8,-40+6));await sim(20);q=await Q();
ok('discovering Greyhold: added to found, +10 XP',q.found.includes('tower')&&q.xp-xp0>=10,{found:q.found,dxp:q.xp-xp0});
sv=await E(()=>JSON.parse(localStorage.getItem('vale3d-save')));ok('discovery persists and reveals the fog there',(sv.found||[]).includes('tower')&&bits(sv.fog)>bits(fog)/2+20,{bits:bits(sv.fog)});
// ---- Standables: tower spiral steps (needs hops), then the top ----
const climbTower=()=>E(()=>{const V=window.__vale,TX=165,TZ=-40,res=[];
 const tops=V.standsNear(TX,TZ,7).filter(s=>s.tag==='tower-step').sort((a,b)=>a.top-b.top);
 const go=(tx,tz,top,rr)=>{for(let i=0;i<240;i++){const st=V.camInfo().st,h=V.hop(),d=Math.hypot(tx-st.px,tz-st.pz);if(d<0.3&&!h.air)break;const f=Math.atan2(tx-st.px,tz-st.pz);V.view(f,f+Math.PI,0.2,6);
   if(!h.air&&h.foot<top-0.3&&d<rr+0.7)V.jump();V.sim([1/60],0,d<0.3?0:-Math.min(1,0.35+d*0.4));}V.sim(Array(15).fill(1/60),0,0);V.heal();return +(V.hop().foot-top).toFixed(2);};
 const s0=tops[0];const a0=Math.atan2(s0.x-TX,s0.z-TZ);V.warp(s0.x+Math.sin(a0)*2.2,s0.z+Math.cos(a0)*2.2);V.sim(Array(10).fill(1/60),0,0);
 for(const s of tops)res.push(go(s.x,s.z,s.top,0.85));const top=V.standsNear(TX,TZ,1).find(s=>s.r>3);const st=V.camInfo().st;const td=go(TX+(st.px-TX)*0.5,TZ+(st.pz-TZ)*0.5,top.top,3.6);
 return {n:tops.length,steps:res,topDiff:td,near:V.quests().near};});
const blocked=await E(()=>{const V=window.__vale,TX=165,TZ=-40;const s0=V.standsNear(TX,TZ,7).filter(s=>s.tag==='tower-step').sort((a,b)=>a.top-b.top)[0];const a0=Math.atan2(s0.x-TX,s0.z-TZ);
 V.warp(s0.x+Math.sin(a0)*2.2,s0.z+Math.cos(a0)*2.2);V.sim(Array(10).fill(1/60),0,0);const g0=V.hop().foot;let st=V.camInfo().st;const f=Math.atan2(s0.x-st.px,s0.z-st.pz);V.view(f,f+Math.PI,0.2,6);V.sim(Array(70).fill(1/60),0,-1);st=V.camInfo().st;
 return {d:+Math.hypot(st.px-s0.x,st.pz-s0.z).toFixed(2),foot:+(V.hop().foot-g0).toFixed(2),top:+(s0.top-g0).toFixed(2)};});
const climb={...(await climbTower()),blocked};
ok('tower step: walking into it without a hop is blocked',climb.blocked.d>0.7&&Math.abs(climb.blocked.foot)<0.3,climb.blocked);
ok('tower: hopping the 9 spiral steps lands on each (±5 cm)',climb.n===9&&climb.steps.every(d=>Math.abs(d)<0.05),climb.steps);
ok('tower: last hop onto the top, standing on it',Math.abs(climb.topDiff)<0.05,{topDiff:climb.topDiff,near:climb.near});
// ---- Sefa: The Blank Corners ----
await E(()=>window.__vale.talkTo('sefa'));await closeDlg();q=await Q();ok('Sefa gives The Blank Corners',q.sq.sefa===1,q.sq);
q=await Q();ok('Greyhold top offers the sketch',/Sketch the view from Greyhold/.test(q.near||''),q.near);
let x1=q.xp;await act();q=await Q();ok('sketched Greyhold (+15 XP)',q.views.includes('sk-tower')&&q.xp-x1>=15,{views:q.views});
// fall off the tower top: a drop, lands on the ground (ledge fall up to 8 m)
const fall=await E(()=>{const V=window.__vale;const st=V.camInfo().st;const f=Math.atan2(st.px-165,st.pz+40);V.view(f,f+Math.PI,0.2,6);let air=0;for(let i=0;i<120;i++){V.sim([1/60],0,-1);if(V.hop().air)air++;}const s=V.camInfo().st;const pr=V.footProbe(s.px,s.pz);return {air,foot:pr.foot,top:pr.top};});
ok('walking off the tower top falls and lands on the ground',fall.air>20&&Math.abs(fall.foot-fall.top)<0.4,fall);
for(const v of ['bluff','cairn']){const sp=(await E(()=>window.__vale.spots())).find(s=>s.id==='view-'+v);await E((x,z)=>window.__vale.warp(x+2.2,z+0.4),sp.x,sp.z);await sim(12);q=await Q();
 const disc=q.found.includes(v);ok(`${v}: viewpoint discovered (+15) and offers the sketch`,disc&&/Sketch the view/.test(q.near||''),{near:q.near,found:q.found});await act();}
q=await Q();ok('all three corners sketched',['tower','bluff','cairn'].every(k=>q.views.includes('sk-'+k)),q.views);
x1=q.xp;await E(()=>window.__vale.talkTo('sefa'));await closeDlg();q=await Q();
ok('Sefa: tale complete · heartstone +1 max heart, +60 XP',q.sq.sefa===2&&q.hpUp===1&&q.hpMax===HP0+1&&q.hp===HP0+1&&q.xp-x1>=60,{sq:q.sq,hpMax:q.hpMax,dxp:q.xp-x1});
// ---- Dov: The Dome's Last Fire · the Ashen Hollow ----
await E(()=>window.__vale.talkTo('dov'));await closeDlg();q=await Q();ok('Dov gives The Dome’s Last Fire',q.sq.dov===1,q.sq);
const chestSp=(await E(()=>window.__vale.spots())).find(s=>s.id==='camp-chest');
await E(()=>window.__vale.warp(-122+2,148-12));await sim(30);let w=await W();let g=w.groups.find(x=>x.id==='ashen');
q=await Q();ok('Ashen Hollow discovered; the cult camp is manned (4 incl. a zealot)',q.found.includes('camp')&&g&&g.present&&g.mobs.length===4,{found:q.found,g:g&&{present:g.present,n:g.mobs.length}});
await E((x,z)=>window.__vale.warp(x-0.6,z),chestSp.x,chestSp.z);await sim(2);q=await Q();ok('strongbox is guarded while the cult stands',/guarded/.test(q.near||''),q.near);
await E(()=>window.__vale.warp(-122,148-5));let tries=0,lastHp=-1,same=0;for(;tries<160;tries++){w=await W();g=w.groups.find(x=>x.id==='ashen');const me=await E(()=>window.__vale.camInfo().st);const a=g.mobs.filter(m=>m.alive).sort((u,v)=>Math.hypot(u.x-me.px,u.z-me.pz)-Math.hypot(v.x-me.px,v.z-me.pz))[0];if(!a)break;
 const st=await E((x,z)=>{const s=window.__vale.camInfo().st;const f=Math.atan2(x-s.px,z-s.pz);window.__vale.view(f,f+Math.PI,0.2,6);return s;},a.x,a.z);
 await E(()=>window.__vale.heal());if(Math.hypot(a.x-st.px,a.z-st.pz)>2.4){await sim(6,0,-1);continue;} if(a.hp===lastHp&&++same>3){same=0;await sim(12,1,-0.4);continue;} if(a.hp!==lastHp){lastHp=a.hp;same=0;} await p.keyboard.press('KeyK');await sim(7);await E(()=>window.__vale.heal());await sim(7);}
q=await Q();w=await W();g=w.groups.find(x=>x.id==='ashen');
ok('camp fight: the cult falls (real swings) → camp recorded clear for 3 days',!g.present&&q.gone.ashen===q.day&&q.campClear,{tries,gone:q.gone});
await E((x,z)=>window.__vale.warp(x-0.6,z),chestSp.x,chestSp.z);await sim(2);q=await Q();ok('strongbox now opens',/Force/.test(q.near||''),q.near);
x1=q.xp;await act();q=await Q();ok('strongbox loot: Dov’s tongs (stage 2), XP',q.sq.dov===2&&q.sq.campLoot===1&&q.xp-x1>=30,{sq:q.sq});
await E(()=>window.__vale.talkTo('dov'));await closeDlg();q=await Q();ok('tongs returned → Dov sends you to the barrow (stage 3)',q.sq.dov===3,q.sq);
await E(()=>window.__vale.give({day:2}));await sim(2);q=await Q();ok('camp stays clear on day 2',q.campClear,{day:q.day});
await E(()=>window.__vale.give({day:3}));await sim(2);q=await Q();ok('camp returns on day 3',!q.campClear,{day:q.day});
await E(()=>window.__vale.give({day:0}));
// ---- The Old Barrow ----
const door=(await E(()=>window.__vale.spots())).find(s=>s.id==='barrow-door');await E((x,z)=>window.__vale.warp(x,z),door.x,door.z);await sim(30);q=await Q();
ok('barrow discovered; the stone door offers entry',q.found.includes('barrow')&&/Enter the Old Barrow/.test(q.near||''),{near:q.near});
await E(()=>window.__vale.interact());await sleep(1200);await sim(10);q=await Q();
ok('inside the barrow: entry chamber, gate shut, 3 dead in the hall, the king waits',q.inBarrow&&q.barrow&&!q.barrow.gate&&q.barrow.hall.filter(Boolean).length===3&&q.barrow.king.alive,q.barrow);
// walls: try to walk out through the dome wall
const wall=await E(()=>{const V=window.__vale;V.barrowWarp(0,0);V.view(Math.PI/2,Math.PI/2+Math.PI,0.2,5);V.sim(Array(120).fill(1/60),0,-1);return V.quests().barrow;});
ok('barrow walls hold (entry chamber r 5.5)',Math.hypot(wall.lx,wall.lz)<5.5,{lx:wall.lx,lz:wall.lz});
// fight the hall with real swings
await E(()=>window.__vale.barrowWarp(0,12));tries=0;
for(;tries<200;tries++){q=await Q();const hall=q.barrow.hall;if(!hall.some(Boolean))break;
 const m=await E(()=>{const V=window.__vale;return null;});
 const tgt=await E(()=>{const b=window.__vale.quests().barrow;return b;});
 // aim at the nearest live hall mob via foe-facing: walk toward the hall centre then swing
 const near=await E(()=>{const V=window.__vale;const c=V.camInfo().st;return {px:c.px,pz:c.pz};});
 await E(()=>window.__vale.heal());
 const ms=await E(()=>window.__vale.barrowMobs?window.__vale.barrowMobs():null);
 if(ms){const a=ms.find(o=>o.alive&&o.hall);const f=Math.atan2(a.x-near.px,a.z-near.pz);await E(f=>window.__vale.view(f,f+Math.PI,0.2,5),f);if(Math.hypot(a.x-near.px,a.z-near.pz)>2.3){await sim(5,0,-1);continue;}}
 await p.keyboard.press('KeyK');await sim(14);}
q=await Q();ok('hall cleared with real swings → the grate rises (stage 1)',!q.barrow.hall.some(Boolean)&&q.barrow.gate&&q.sq.barrow===1,{tries,hall:q.barrow.hall,sq:q.sq});
// Ossric: half HP summons the risen; defeat wakes you at the entry, progress kept
await E(()=>window.__vale.barrowWarp(0,33));await sim(30);q=await Q();ok('Ossric notices and comes for you',q.barrow.king.state!=='idle',q.barrow.king);
await E(()=>window.__vale.barrowHit('king',14));await sim(2);q=await Q();ok('Ossric at half HP raises 2 dead',q.barrow.risen.every(Boolean),{risen:q.barrow.risen,hp:q.barrow.king.hp});
let hit=false;const hp1=q.hp;for(let i=0;i<40&&!hit;i++){await sim(10);q=await Q();if(q.hp<hp1||q.barrow.lz<2)hit=true;}
ok('the king and his dead strike back',hit,{hp:q.hp});
for(let i=0;i<60;i++){q=await Q();if(q.barrow.lz<3&&q.barrow.lz>-4&&Math.abs(q.barrow.lx)<3&&q.hp===q.hpMax)break;await sim(10);}
q=await Q();ok('defeat: wake at the entry, hall stays cleared (stage 1), Ossric whole again, risen gone',q.sq.barrow===1&&q.barrow.lz<0&&q.barrow.king.hp===26&&!q.barrow.risen.some(Boolean),{king:q.barrow.king,lz:q.barrow.lz,hp:q.hp});
await E(()=>{const V=window.__vale;V.barrowWarp(0,33);V.heal();});x1=(await Q()).xp;
await E(()=>window.__vale.barrowHit('king',99));await sim(4);q=await Q();
ok('Ossric falls · +90 XP, his dead crumble, stage 2',!q.barrow.king.alive&&q.barrow.risen.every(r=>!r)&&q.sq.barrow===2&&q.xp-x1>=90,{sq:q.sq,dxp:q.xp-x1});
await E(()=>window.__vale.barrowWarp(0,42.4));await sim(2);q=await Q();ok('vault-chest offers itself',/vault-chest/.test(q.near||''),q.near);
await act();q=await Q();ok('vault-chest: star-iron (Dov → stage 4)',q.sq.barrow===3&&q.sq.dov===4&&q.sq.star===1,q.sq);
await E(()=>window.__vale.barrowWarp(0,-3.6));await sim(2);q=await Q();ok('exit offered at the entry',/Climb out/.test(q.near||''),q.near);
await E(()=>window.__vale.interact());await sleep(1200);await sim(6);q=await Q();ok('back outside at the barrow door',!q.inBarrow&&Math.hypot(q.px-door.x,q.pz-door.z)<3,{px:q.px,pz:q.pz});
x1=q.xp;await E(()=>window.__vale.talkTo('dov'));await closeDlg();q=await Q();
ok('Dov forges Emberbrand · +80 XP, in hand',q.sq.dov===5&&q.weapons.includes('ember')&&q.weapon==='ember'&&q.xp-x1>=80,{sq:q.sq,weapon:q.weapon});
// re-entering after the king: quiet, chest stays open
await E((x,z)=>window.__vale.warp(x,z),door.x,door.z);await sim(2);await E(()=>window.__vale.interact());await sleep(1200);await sim(4);q=await Q();
ok('barrow stays conquered on return',q.inBarrow&&!q.barrow.king.alive&&q.barrow.gate&&!q.barrow.hall.some(Boolean),q.barrow);
await E(()=>window.__vale.barrowGo('exit'));await sleep(1200);
// ---- Ress: The Lights Teo Left ----
await E(()=>window.__vale.talkTo('ress'));await closeDlg();q=await Q();ok('Ress gives The Lights Teo Left',q.sq.ress===1,q.sq);
const sat=(await E(()=>window.__vale.spots())).find(s=>s.id==='tower-satchel');
// the satchel is on the tower top: probe it from the ground (must not be reachable) — then stand on the top via the steps test position
await E((x,z)=>window.__vale.warp(x,z),sat.x+4.5,sat.z);await sim(4);q=await Q();ok('satchel not reachable from the ground',!/satchel/.test(q.near||''),q.near);
await E(()=>window.__vale.setSq({}));const top=await E(()=>{const V=window.__vale;return V.standsNear(165,-40,1).find(s=>s.r>3);});
await climbTower();
await E((x,z)=>{const V=window.__vale;const st=V.camInfo().st;const f=Math.atan2(x-st.px,z-st.pz);V.view(f,f+Math.PI,0.2,6);for(let i=0;i<90;i++){const s=V.camInfo().st;if(Math.hypot(x-s.px,z-s.pz)<0.9)break;V.sim([1/60],0,-0.6);}},sat.x,sat.z);await sim(4);
q=await Q();ok('on Greyhold top the satchel opens (ress=1)',q.sq.ress===1&&/satchel/.test(q.near||''),{near:q.near,foot:q.foot,top:top.top});
await act();q=await Q();ok('Teo’s note → stage 2',q.sq.ress===2,q.sq);
const bl=(await E(()=>window.__vale.spots())).find(s=>s.id==='view-bluff');await E((x,z)=>window.__vale.warp(x+2.2,z+0.4),bl.x,bl.z);await sim(4);q=await Q();
ok('Sunfall cairn: look under the stones',/under the cairn/.test(q.near||''),q.near);await act();q=await Q();ok('Teo’s bundle → stage 3',q.sq.ress===3,q.sq);
x1=q.xp;await E(()=>window.__vale.talkTo('ress'));await closeDlg();q=await Q();
ok('Ress: tale complete · Teo’s Harpoon + 70 XP',q.sq.ress===4&&q.weapons.includes('harpoon')&&q.xp-x1>=70,{sq:q.sq,weapons:q.weapons});
// ---- Journal + map ----
const jr=await E(()=>{const V=window.__vale;V.openSheet('journal');const t=V.sheets().journalText;V.openSheet('map');V.openSheet(null);return t;});
ok('Journal lists the side tales',/Side tales/i.test(jr)&&/Blank Corners — complete/i.test(jr)&&/Last Fire — complete/i.test(jr)&&/Lights Teo Left — complete/i.test(jr),jr.slice(0,160));
sv=await E(()=>JSON.parse(localStorage.getItem('vale3d-save')));
ok('save carries tales, finds, heart, new weapons',sv.sq&&sv.sq.sefa===2&&sv.sq.dov===5&&sv.sq.ress===4&&sv.hpUp===1&&sv.weapons.includes('ember')&&sv.weapons.includes('harpoon')&&['tower','camp','barrow','bluff','cairn'].every(k=>sv.found.includes(k)),{found:sv.found});
// ---- reload: everything persists ----
await p.reload({waitUntil:'load'});await ready();await sleep(1200);q=await Q();
ok('reload: progress, hearts, weapons persist',q.sq.dov===5&&q.hpMax===HP0+1&&q.weapons.includes('harpoon'),{sq:q.sq,hpMax:q.hpMax});
ok('no page errors',errs.length===0,errs.slice(0,5));
console.log(fails?`QA-QUESTS: ${fails} FAIL`:'QA-QUESTS: ALL PASS');await b.close();process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(2);});
