// M20b QA: day/night clock + lighting, night roaming groups (spawn, chase, strike, clear + respawn rule), campfire rest (morning, save, respawn),
// village safety, defeat → nearest fire, old-save load, Listening Pools grottoes (passages, loot), the bigger Keeper arena (bounds, camera).
const pc=require(process.env.PUPPETEER_CORE);const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:900000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage();await p.setViewport({width:412,height:860,isMobile:true,hasTouch:true});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
const log=(k,v)=>console.log(k,JSON.stringify(v));let fails=0;const ok=(name,c,v)=>{if(!c)fails++;log((c?'PASS ':'FAIL ')+name,v);};
const W=()=>p.evaluate(()=>window.__vale.world());const ready=()=>p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});
const sim=(n,sx=0,sy=0)=>p.evaluate((n,sx,sy)=>{window.__vale.sim(Array(n).fill(1/30),sx,sy);},n,sx,sy);
const G=(w,id)=>w.groups.find(g=>g.id===id);
const OLD={v:1,started:true,done:false,xp:40,seals:{dawn:true},runes:[0,0,0],wind:false,warden:false,mirrors:[0,0,0,0],beacon:false,echo:false,charted:[false,false,false,false,false,false,false],cave:0,coast:0,sea:0,lamp:0,weapons:['rusty','maul'],weapon:'maul',whet:4};
await p.goto('http://localhost:8090/?q=lite&qa=1&tod=0.42',{waitUntil:'load',timeout:180000});
await p.evaluate((o)=>{localStorage.setItem('vale3d-hero',JSON.stringify({name:'Ilka',sex:'female'}));localStorage.setItem('vale3d-save',JSON.stringify(o));},OLD);
await p.reload({waitUntil:'load',timeout:180000});await ready();await sleep(1200);
let w=await W();ok('old save (no time fields) loads at the set hour',w.tod===0.42&&w.day===0&&!w.locked,{tod:w.tod,day:w.day,locked:w.locked});
ok('day light',w.night===0&&w.sunI>2&&w.lantern===0,{night:w.night,sunI:w.sunI,lantern:w.lantern});
// 1 · clock runs
await p.evaluate(()=>window.__vale.setTime(0.42,true));await sim(900);w=await W();ok('30 s of play advances the clock 1/24 of a day',Math.abs(w.tod-0.42-30/720)<0.01,{tod:w.tod});
await p.evaluate(()=>window.__vale.setTime(0.97));await sim(2);w=await W();
ok('night is dark: low key light, lantern on, exposure up',w.night>0.99&&w.sunI<0.7&&w.lantern>4&&w.exposure>1,{night:w.night,sunI:w.sunI,lantern:w.lantern,exp:w.exposure});
// 2 · night group on the north road
await p.evaluate(()=>window.__vale.warp(-11,-24));await sim(20);w=await W();let g=G(w,'n-road');
ok('night group risen and near',g.present&&g.near&&g.mobs.every(m=>m.alive&&m.vis),{g});
ok('day groups exist too',w.groups.filter(x=>!x.night).length>=2,{});
const hp0=w.playerHp;let hit=false;for(let i=0;i<20&&!hit;i++){await sim(15);w=await W();if(w.playerHp<hp0)hit=true;}
g=G(w,'n-road');ok('shades notice, chase and strike',hit&&g.mobs.some(m=>m.state!=='idle'),{hp:w.playerHp,states:g.mobs.map(m=>m.state)});
// fight them (maul + whetstones)
let tries=0;for(;tries<90;tries++){w=await W();g=G(w,'n-road');const a=g.mobs.find(m=>m.alive);if(!a)break;
  await p.evaluate((x,z)=>{const s=window.__vale.camInfo().st;const f=Math.atan2(x-s.px,z-s.pz);window.__vale.view(f,f+Math.PI,0.2,6);},a.x,a.z);
  const d=Math.hypot(a.x-(await p.evaluate(()=>window.__vale.camInfo().st.px)),a.z-(await p.evaluate(()=>window.__vale.camInfo().st.pz)));
  if(d>2.4){await sim(6,0,-1);continue;}
  await p.evaluate(()=>window.__vale.heal());await p.keyboard.press('KeyK');await sim(14);} // heal: this checks the clear/record rule, not survival
w=await W();g=G(w,'n-road');ok('night group cleared → recorded for today',!g.present&&w.rk['n-road']===w.day,{tries,rk:w.rk,present:g.present});
await sim(30);w=await W();ok('cleared group stays down tonight',!G(w,'n-road').present,{});
// 3 · dawn: other night groups thin out; next night (new day) the road group returns
await p.evaluate(()=>window.__vale.setTime(0.5));await sim(5);w=await W();ok('day: night groups gone',w.groups.filter(x=>x.night).every(x=>!x.present),{p:w.groups.filter(x=>x.present).map(x=>x.id)});
await p.evaluate(()=>window.__vale.setTime(0.2,true));await p.evaluate(()=>window.__vale.sim(Array(60*45).fill(1/60),0,0));w=await W();
ok('dawn passes → day counter +1',w.day===1,{day:w.day,tod:w.tod});
await p.evaluate(()=>window.__vale.setTime(0.97));await sim(10);w=await W();ok('next night the road group is back',G(w,'n-road').present,{rk:w.rk});
// 4 · village is safe at night
await p.evaluate(()=>window.__vale.warp(-3,-18));await sim(150);w=await W();
const intr=G(w,'n-road').mobs.filter(m=>m.alive&&Math.hypot(m.x-3,m.z-1)<27);ok('shades never enter the village ring',intr.length===0,{intr});
// 5 · rest at the camp fire
await p.evaluate(()=>window.__vale.warp(8.4,4.6));await sim(4);w=await W();ok('camp fire offers rest',/Rest at the Wayfinder/.test(w.near||''),{near:w.near});
const d0=w.day;await p.evaluate(()=>window.__vale.interact());await p.waitForFunction('!window.__vale.world().fading',{timeout:20000,polling:100});await sleep(200);w=await W();
const st=await p.evaluate(()=>JSON.parse(localStorage.getItem('vale3d-save')));
ok('rest → morning, new day, saved, records cleared',Math.abs(w.tod-0.27)<0.002&&w.day===d0+1&&Object.keys(w.rk).length===0&&Math.abs(st.tod-0.27)<0.002&&st.day===w.day,{tod:w.tod,day:w.day,saved:{tod:st.tod,day:st.day}});
// 6 · defeat in the open → nearest fire
await p.evaluate(()=>window.__vale.setTime(0.97));await p.evaluate(()=>window.__vale.warp(-68,-86));let moved=false; /* M25: the n-pale shades moved out past the Wing Gate (-67,-83) */
for(let i=0;i<60&&!moved;i++){await sim(20);const s=await p.evaluate(()=>window.__vale.camInfo().st);if(Math.hypot(s.px-(-62+1.6),s.pz-(-98+1.6))<0.5)moved=true;}
w=await W();ok('beaten at night → wake by the nearest fire, HP full',moved&&w.playerHp>=3,{hp:w.playerHp});
// 7 · reload keeps the clock
await p.evaluate(()=>window.__vale.setTime(0.6));await p.evaluate(()=>window.__vale.interact&&0);await p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('vale3d-save'));s.tod=0.61;localStorage.setItem('vale3d-save',JSON.stringify(s));});
await p.goto('http://localhost:8090/?q=lite&qa=1&cycle=1',{waitUntil:'load',timeout:180000});await ready();await sleep(800);w=await W();ok('reload restores the saved hour (cycle on)',Math.abs(w.tod-0.61)<0.02&&!w.frozen,{tod:w.tod,frozen:w.frozen});
// 8 · Listening Pools grottoes
await p.goto('http://localhost:8090/?q=lite&shot=seal-open',{waitUntil:'load',timeout:180000});await ready();await sleep(2500);
const SO=3000;const at=(x,z)=>p.evaluate((x,z)=>window.__vale.warp(x,z),SO+x,SO+z);const pos=()=>p.evaluate(()=>{const s=window.__vale.camInfo();return {x:s.st.px-3000,z:s.st.pz-3000,y:s.player[1]};});
await at(-9.5,7);await p.evaluate(()=>window.__vale.view(0,Math.PI,0.2,5));await sim(90,0,-1);let q=await pos();
ok('north passage leads into the Wrack grotto',q.z>17&&Math.abs(q.y-0.18)<0.15,q);
await at(-9.5,20.3);await sim(3);let nr=await p.evaluate(()=>window.__vale.world().near);ok('wrack-heap offered',/wrack/i.test(nr||''),{nr});
let x0=(await p.evaluate(()=>window.__vale.quest().save));await p.evaluate(()=>window.__vale.interact());await sleep(300);let x1=await p.evaluate(()=>window.__vale.quest().save);
ok('wrack-heap: +25 XP, sea-whetstone',x1.xp-x0.xp===25&&(x1.whet||0)===(x0.whet||0)+1&&x1.chests.includes('sea-north'),{dxp:x1.xp-x0.xp,whet:x1.whet});
await at(-9.5,26);await sim(60,0,-1);q=await pos();ok('grotto wall holds',q.z<21.5+6.2,q);
await at(-20,-6);await p.evaluate(()=>window.__vale.view(Math.PI,0,0.2,5));await sim(90,0,-1);q=await pos();ok('south passage leads into the Bell grotto',q.z<-16,q);
await at(-20,-19.8);await sim(3);nr=await p.evaluate(()=>window.__vale.world().near);ok('drowned bell offered',/bell/i.test(nr||''),{nr});
await p.evaluate(()=>window.__vale.interact());await sleep(300);x1=await p.evaluate(()=>window.__vale.quest().save);ok('bell: lore page',x1.lore&&x1.lore.includes('sea-bell'),{lore:x1.lore});
for(let i=0;i<4;i++)await p.evaluate(()=>window.__vale.advance());
// 9 · the bigger arena
await p.goto('http://localhost:8090/?q=lite&shot=keeper',{waitUntil:'load',timeout:180000});await ready();await sleep(2500);
let K=await p.evaluate(()=>window.__vale.keeper());ok('seven custodian stones',K.stones.length===7,{n:K.stones.length});
const ring=K.stones.map(s=>Math.hypot(s.x-K.center.x,s.z-K.center.z));ok('stones spread across the floor',Math.max(...ring)>15&&Math.min(...ring)>8,{ring});
await p.evaluate((c)=>{window.__vale.warp(c.x-6,c.z);window.__vale.view(-Math.PI/2,Math.PI/2,0.2,7);},K.center);await sim(120,0,-1);
let s1=await p.evaluate(()=>window.__vale.camInfo().st);const rr=Math.hypot(s1.px-K.center.x,s1.pz-K.center.z);ok('arena radius ≈ 20 m (was 14)',rr>19.5&&rr<20.8,{rr});
// circle and roll: camera never inside the coil, no camera pops
await p.evaluate((c)=>{window.__vale.warp(c.x+7,c.z);window.__vale.view(0,Math.PI*0.5,0.22,7.5);},K.center);await sim(5);
const rows=await p.evaluate((c)=>{const out=[];for(let i=0;i<360;i++){const s=window.__vale.camInfo().st;const a=Math.atan2(s.px-c.x,s.pz-c.z);window.__vale.sim([1/30],Math.cos(i/40)>0?1:-1,i%90<20?-1:0);const ci=window.__vale.camInfo();out.push([ci.cam[0]-c.x,ci.cam[1],ci.cam[2]-c.z]);}return out;},K.center);
let jump=0,inBody=0;for(let i=1;i<rows.length;i++){const d=Math.hypot(rows[i][0]-rows[i-1][0],rows[i][1]-rows[i-1][1],rows[i][2]-rows[i-1][2]);jump=Math.max(jump,d);if(Math.hypot(rows[i][0],rows[i][2])<4.5&&rows[i][1]<7)inBody++;}
ok('camera never inside the Keeper',inBody===0,{inBody});ok('no camera pops while circling (max step per 1/30 s)',jump<0.75,{jump:+jump.toFixed(3)});
ok('no page errors',errs.length===0,errs.slice(0,5));
console.log(fails?`QA-WORLD FAIL ${fails}`:'QA-WORLD PASS');await b.close();process.exit(fails?1:0);})().catch(e=>{console.log('ERR',e.message);process.exit(2);});
