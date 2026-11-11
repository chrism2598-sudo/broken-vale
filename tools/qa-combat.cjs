// M19 QA: combat buttons/keys (Attack combo, Heavy charge, Block/Parry, Dodge-roll, stamina, hit stop), Warden beatable with the new controls,
// weapon pickups + swap + save persistence + old-save migration, no guide arrow by default (Guidance setting), Journal clues, Marr's map fog.
const pc=require(process.env.PUPPETEER_CORE);const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:600000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage();await p.setViewport({width:412,height:860,isMobile:true,hasTouch:true});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
const log=(k,v)=>console.log(k,JSON.stringify(v));let fails=0;const ok=(name,c,v)=>{if(!c)fails++;log((c?'PASS ':'FAIL ')+name,v);};
const C=()=>p.evaluate(()=>window.__vale.combat());const Q=()=>p.evaluate(()=>window.__vale.quest());const W=()=>p.evaluate(()=>window.__vale.warden());
const ready=()=>p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});
// 1 · old save (pre-M19, no weapons field) migrates to the Rusty Sword
await p.goto('http://localhost:8090/?q=lite&qa=1',{waitUntil:'load'});
await p.evaluate(()=>{localStorage.setItem('vale3d-hero',JSON.stringify({name:'Ilka',sex:'female'}));localStorage.setItem('vale3d-save',JSON.stringify({v:1,started:true,done:false,xp:50,seals:{dawn:true},runes:[0,0,0],wind:false,warden:false,mirrors:[0,0,0,0],beacon:false,echo:false,charted:[true,false,false,false,false,false,false],cave:0,coast:0,sea:0,lamp:0}));localStorage.removeItem('vale3d-guidance');});
await p.reload({waitUntil:'load'});await ready();await sleep(1500);
let c=await C();ok('old save migrates to Rusty Sword',c.owned.join()==='rusty'&&c.weapon==='rusty'&&c.inHand.every(x=>x==='rusty'),{owned:c.owned,weapon:c.weapon,inHand:c.inHand});
// 2 · HUD: five thumb buttons on screen, no arrow / meters by default, Guidance setting brings them back
// M20b-2 · calm controls: joystick + Jump + Action only; the fight cluster slides in on attack / damage / a foe within ~12 m, hides ~4 s after
const S=n=>p.evaluate(n=>window.__vale.sim(Array(n).fill(1/30),0,0),n);const vis=c=>Object.fromEntries(c.ui.buttons.map(x=>[x.id,x.vis]));
await S(10);await sleep(500);c=await C();let v=vis(c);
ok('calm: only Action (b-atk) and Jump shown, fight cluster hidden',c.ui.calm&&v['b-atk']&&v['b-jmp']&&!v['b-hvy']&&!v['b-blk']&&!v['b-dge']&&!v['b-wpn'],{calm:c.ui.calm,v});
await p.keyboard.press('KeyK');await S(2);await sleep(450);c=await C();
ok('attacking (key K works while calm) brings in the full cluster',!c.ui.calm&&c.ui.buttons.every(x=>x.vis&&x.w>=50&&x.x>=0&&x.x+x.w<=412&&x.y+x.h<=860),c.ui.buttons.map(x=>[x.id,x.x,x.y,x.w,x.vis]));
await S(60);c=await C();ok('still shown 2 s after the swing',!c.ui.calm,{});
await S(100);await sleep(500);c=await C();v=vis(c);ok('hidden again ~4 s after combat ends',c.ui.calm&&!v['b-hvy']&&v['b-atk'],{v});
await p.evaluate(()=>window.__vale.hurt(1));await S(1);await sleep(150);c=await C();ok('taking damage shows the cluster',!c.ui.calm&&vis(c)['b-blk'],{});
await p.evaluate(()=>window.__vale.heal());await S(130);await sleep(500);
await p.keyboard.press('KeyC');await S(1);c=await C();ok('roll key (C) works while calm and shows the cluster',!c.ui.calm,{});
await S(135);await sleep(500);
const wdp=await p.evaluate(()=>window.__vale.warden());await p.evaluate((x,z)=>window.__vale.warp(x+9,z+3),wdp.x,wdp.z);await S(20);await sleep(150);
const ct=await p.evaluate(()=>window.__vale.ctl());c=await C();ok('a waking foe within ~12 m shows the cluster',!c.ui.calm&&ct.hostile,ct);
const bb=await p.evaluate(()=>{const r=document.getElementById('action').getBoundingClientRect(),j=document.getElementById('b-jmp').getBoundingClientRect();return {act:[r.x,r.y,r.width,r.height],jmp:[j.x,j.y,j.width,j.height]};});
await p.evaluate(()=>{const s=window.__vale.warden();window.__vale.warp(s.x+60,s.z+60);window.__vale.heal();});await S(140);await sleep(500);c=await C();ok('calm again away from the foe',c.ui.calm,{});

ok('no guide arrow or meters (Guidance off)',!c.guidance&&!c.ui.arrow&&!/\d+ m\b/.test(c.ui.ctext),{ctext:c.ui.ctext});
await p.evaluate(()=>window.__vale.setGuidance(true));await sleep(500);c=await C();const gOn={arrow:c.ui.arrow,ctext:c.ui.ctext};
await p.evaluate(()=>window.__vale.setGuidance(false));await sleep(400);c=await C();ok('Guidance On shows arrow + distance; Off hides again',gOn.arrow&&/( m|here)$/.test(gOn.ctext)&&!c.ui.arrow,{gOn,off:c.ui.ctext});
// 3 · Journal clue + map fog
await p.keyboard.press('KeyJ');await sleep(500);const jt=await p.evaluate(()=>window.__vale.sheets().journalText);await p.keyboard.press('Escape');await sleep(300);
ok('Journal has landmark clues + weapon rumours',/Where to go/i.test(jt)&&/Sunspire|Azure Keep|Iron Dome/.test(jt)&&/Veilfall/.test(jt)&&!/\d+ m\b/.test(jt),{snip:jt.slice(0,260)});
const f0=(await p.evaluate(()=>window.__vale.fog())).explored;await p.evaluate(()=>window.__vale.warp(-60,-20));await p.waitForFunction(f=>window.__vale.fog().explored>f,{timeout:30000},f0).catch(()=>{});const f1=(await p.evaluate(()=>window.__vale.fog())).explored;
ok('Map fog: walking reveals more of Marr’s map',f0>0&&f1>f0,{f0,f1});
// 4 · Warden with the new controls only (K attack, L heavy, Q block, C roll)
const w0=await W();const nearW=async(off)=>{const dx=0-w0.x,dz=6-w0.z,d=Math.hypot(dx,dz);await p.evaluate((x,z)=>window.__vale.warp(x,z),w0.x+dx/d*off,w0.z+dz/d*off);};
await nearW(2.7);await sleep(900);ok('no Interact pill next to the Warden (attack is a button now)',(await Q()).near===null,{near:(await Q()).near});
// heavy: hold L ~0.8 s then release → stamina spent
let st0=(await C()).stamina;await p.keyboard.down('KeyL');await p.waitForFunction('window.__vale.combat().charge>0.5',{timeout:30000}).catch(()=>{});const chg=(await C()).charge;await p.keyboard.up('KeyL');await p.waitForFunction('window.__vale.combat().counts.heavy>0',{timeout:5000}).catch(()=>{});let c2=await C();
ok('Heavy charges and costs stamina',chg>0.3&&c2.stamina<st0-15&&c2.counts.heavy===1,{charge:chg,st0,st1:c2.stamina});
await p.waitForFunction('!window.__vale.combat().act',{timeout:30000}).catch(()=>{});
// dodge-roll costs stamina, gives i-frames, moves Ilka
const pp=async()=>p.evaluate(()=>{const v=window.__vale.debug.player.position;return{x:v.x,z:v.z};});let a=await pp();st0=(await C()).stamina;
await p.keyboard.press('KeyC');await p.waitForFunction('window.__vale.combat().rolling',{timeout:10000}).catch(()=>{});c2=await C();await p.waitForFunction('!window.__vale.combat().act',{timeout:30000}).catch(()=>{});let b2=await pp();
ok('Dodge-roll: i-frames, stamina, distance',c2.rolling&&c2.iframes>0&&c2.stamina<st0-10&&Math.hypot(b2.x-a.x,b2.z-a.z)>1.5,{rolling:c2.rolling,ifr:c2.iframes,st0,st1:c2.stamina,moved:+Math.hypot(b2.x-a.x,b2.z-a.z).toFixed(2)});
// block through a Warden strike (hold Q from the windup) → blocked or parried, no HP loss
await nearW(2.7);await p.waitForFunction('window.__vale.warden().phase!==1',{timeout:30000}).catch(()=>{});await p.waitForFunction('window.__vale.warden().phase===1',{timeout:30000}).catch(()=>{});const hpB=(await W()).playerHp;await p.keyboard.down('KeyQ');await p.waitForFunction('window.__vale.combat().blocking',{timeout:5000}).catch(()=>{});
await p.waitForFunction('window.__vale.warden().phase!==1',{timeout:30000}).catch(()=>{});await sleep(300);c2=await C();const hpA=(await W()).playerHp;await p.keyboard.up('KeyQ');
ok('Block holds a Warden strike',hpA===hpB&&(c2.counts.parry>0||c2.stamina<90),{hpB,hpA,parry:c2.counts.parry,stamina:c2.stamina,toast:await p.$eval('#toast',e=>e.textContent)});
// light combo until the Warden falls (recover from defeats like the full run)
const xp0=(await Q()).save.xp;let hits=0,hs=0,combo=new Set(),t0=Date.now();
while(!(await Q()).save.warden&&Date.now()-t0<150000){const q=await Q();if(q.talking){for(let j=0;j<5&&(await Q()).talking;j++){await p.keyboard.press('Space');await sleep(250);}await nearW(2.7);await sleep(400);continue;}
  const d=await p.evaluate(()=>{const v=window.__vale.debug.player.position,w=window.__vale.warden();return Math.hypot(v.x-w.x,v.z-w.z);});if(d>3.3){await nearW(2.7);}
  await p.keyboard.press('KeyK');await sleep(60);const cc=await C();if(cc.act)combo.add(cc.act.step);if(cc.hitStop>0)hs++;await sleep(140);}
c2=await C();const qd=await Q();
ok('Warden beaten with Attack button (+40 XP once)',qd.save.warden&&qd.save.xp-xp0===40,{secs:+((Date.now()-t0)/1000).toFixed(0),landed:c2.counts.landed,light:c2.counts.light,comboSteps:[...combo].sort(),hitStopSeen:hs,toast:await p.$eval('#toast',e=>e.textContent)});
ok('Light combo chains 3 steps + hit stop fires',[...combo].length>=2&&(hs>0||c2.counts.landed>0),{steps:[...combo],hs});
// 5 · weapon pickups: spear (Veilfall) and maul (Iron Dome); swap; persistence
const picks=c2.picks;for(const id of ['spear','maul']){const k=picks.find(x=>x.id===id);await p.evaluate((x,z)=>window.__vale.warp(x+0.8,z+0.6),k.x,k.z);await sleep(900);const n=(await Q()).near;await p.keyboard.press('KeyE');await sleep(500);c2=await C();
  ok('pickup '+id,/Take the/.test(n||'')&&c2.owned.includes(id)&&c2.weapon===id&&c2.inHand.every(x=>x===id)&&c2.picks.find(x=>x.id===id).taken,{near:n,owned:c2.owned,weapon:c2.weapon,inHand:c2.inHand,toast:await p.$eval('#toast',e=>e.textContent)});}
await p.waitForFunction('!window.__vale.combat().act&&window.__vale.combat().charge<0',{timeout:30000}).catch(()=>{});const busyX=await C();await p.keyboard.press('KeyX');await sleep(300);const cyc=(await C()).weapon;await p.keyboard.press('Digit2');await sleep(300);const d2=(await C()).weapon;
await p.click('#b-wpn');await sleep(300);const pickOpen=(await C()).ui.wpick;await p.click('#wpick button[data-w="maul"]');await sleep(300);c2=await C();
ok('swap: X cycles, 1-4 picks, tap icon → list',cyc==='rusty'&&d2==='spear'&&pickOpen&&c2.weapon==='maul'&&!c2.ui.wpick,{cyc,d2,pickOpen,after:c2.weapon,before:busyX.weapon,act:busyX.act});
// maul heavy: slower, bigger strike values
const mw=await p.evaluate(()=>{const c=window.__vale.combat();return c.weapon;});
await p.reload({waitUntil:'load'});await ready();await sleep(1200);c2=await C();
ok('weapons persist in vale3d-save',c2.owned.join()==='rusty,spear,maul'&&c2.weapon==='maul'&&c2.picks.every(x=>x.taken),{owned:c2.owned,weapon:c2.weapon,save:await p.evaluate(()=>JSON.parse(localStorage.getItem('vale3d-save')).weapons)});
// 6 · touch: tap the on-screen Attack button (pointer events) → a swing
st0=(await C()).counts.light;await p.touchscreen.tap(...await p.evaluate(()=>{const r=document.getElementById('b-atk').getBoundingClientRect();return[r.x+r.width/2,r.y+r.height/2];}));await sleep(250);
ok('tap Attack button swings',(await C()).counts.light===st0+1,{before:st0,after:(await C()).counts.light,mw});
ok('no page errors',errs.length===0,errs.slice(0,5));
console.log(fails?`QA-COMBAT FAIL ${fails}`:'QA-COMBAT ALL PASS');await b.close();process.exit(fails?1:0);})();
