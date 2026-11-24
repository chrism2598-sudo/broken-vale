// M64F · targeted test: level perks (1 of 2 at Lv 3/6/9/12, offered calmly, old saves catch up in order), perk effects, relic slot
// (found → worn, one at a time, effects), repeat-clear roaming XP halved, migrations (M54–M63 saves, junk values). EMULATED headless Chrome.
const pc=require(process.env.PUPPETEER_CORE);const sleep=ms=>new Promise(r=>setTimeout(r,ms));const PORT=process.env.PORT||'8102';
let fails=0,n=0;const ok=(name,c,d)=>{n++;console.log((c?'PASS ':'FAIL ')+name+(d!==undefined?' '+JSON.stringify(d).slice(0,420):''));if(!c)fails++;};
const SAVE=(o={})=>JSON.stringify({v:1,started:true,done:false,xp:0,seals:{forge:true},runes:[0,0,0],wind:false,warden:false,mirrors:[0,0,0,0],beacon:false,echo:false,charted:[false,false,false,false,false,false,false],cave:0,coast:0,sea:0,lamp:0,weapons:['rusty','maul'],weapon:'rusty',...o});
const ALLC=['move','talk','seal','attack','dodge','rolled','parry','parried','stamina','hurt','claim','pick'];
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:900000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const errs=[];
const page=async(save,q='&tod=0.42&perks=1',vp={width:412,height:915})=>{const p=await b.newPage();await p.setViewport({...vp,isMobile:true,hasTouch:true});p.on('pageerror',e=>errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?q=lite&qa=1${q}`,{waitUntil:'load'});
  await p.evaluate((s,c)=>{localStorage.clear();localStorage.setItem('vale3d-hero',JSON.stringify({name:'Ilka',sex:'female'}));localStorage.setItem('vale3d-coach',JSON.stringify(c));if(s)localStorage.setItem('vale3d-save',s);},save,ALLC);
  await p.reload({waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(400);return p;};
const sim=(p,k)=>p.evaluate(k=>window.__vale.sim(Array(k).fill(1/30),0,0),k);const P=p=>p.evaluate(()=>window.__vale.progress64());const K=p=>p.evaluate(()=>window.__vale.kindle());
const key=(p,code,down)=>p.evaluate((c,d)=>dispatchEvent(new KeyboardEvent(d?'keydown':'keyup',{code:c})),code,down);
const W=p=>p.evaluate(()=>window.__vale.world());const G=async(p,id)=>(await W(p)).groups.find(g=>g.id===id);
const watchWind=async(p,id)=>{for(let i=0;i<240;i++){await sim(p,1);const s=await p.evaluate(id=>{for(const g of window.__vale.world().groups)for(const m of g.mobs)if(m.id===id)return m.state;},id);if(s==='windup')return true;}return false;};
const rollOnce=async(p,id)=>{if(!await watchWind(p,id))return;await sim(p,19);await key(p,'KeyC',true);await sim(p,1);await key(p,'KeyC',false);await sim(p,14);await p.evaluate(()=>window.__vale.heal());};
const parryOnce=async(p,id)=>{if(!await watchWind(p,id))return;await sim(p,22);await key(p,'KeyQ',true);await sim(p,8);await key(p,'KeyQ',false);await sim(p,10);};
const atHusks=async(p,bulk=1000)=>{await p.evaluate(()=>window.__vale.warp(8,35));await sim(p,30);const g=await G(p,'d-dome');const t=g.mobs.find(m=>m.alive);if(bulk)await p.evaluate(b=>window.__vale.foeBulk(b),bulk);await p.evaluate((x,z)=>window.__vale.warp(x,z-1.2),t.x,t.z);await sim(p,2);return t;};
const card=p=>p.evaluate(()=>{const e=document.getElementById('perk');if(e.hidden)return null;return {h:e.querySelector('small').textContent,btns:[...e.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect();return {p:b.dataset.p,t:b.textContent,x:r.left,y:r.top,w:r.width,h:r.height};}),cbt:getComputedStyle(document.getElementById('cbt')).display,vw:innerWidth,vh:innerHeight};});
const tap=(p,id)=>p.evaluate(id=>document.querySelector(`#perk button[data-p="${id}"]`).click(),id);
// 1 · Lv 5 (M63-style save, no perks): calm → Lv 3 card (Hearth-Kept | Light Stride); fights blocked while open; pick by tapping; no further card
{const p=await page(SAVE({xp:200}));await sim(p,10);let c=await card(p);const early=c;await sim(p,90);c=await card(p);const pr=await P(p);
 ok('a Lv 5 save with no perks is offered the Lv 3 choice once calm (Hearth-Kept | Light Stride)',!early&&c&&/Level 3/.test(c.h)&&pr.opts.join()==='hearth,stride',{early:!!early,c:c&&c.h,opts:pr.opts});
 ok('while the choice is open, the fight controls are hidden',c&&c.cbt==='none',{cbt:c&&c.cbt});
 await tap(p,'stride');await sim(p,90);const pr2=await P(p);const c2=await card(p);
 ok('tap Light Stride → kept; rolls cost 30% less; no card for Lv 6 yet',pr2.perks.join()==='stride'&&pr2.mods.dodgeMul===0.7&&!c2,{perks:pr2.perks,mods:pr2.mods,c2:!!c2});
 await p.reload({waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sim(p,90);const pr3=await P(p);
 ok('perk survives a reload; no repeat offer',pr3.perks.join()==='stride'&&pr3.mods.dodgeMul===0.7&&!(await card(p)),pr3.perks);await p.close();}
// 2 · Lv 13 save (no perks): the four choices come in order 3 → 6 → 9 → 12; effects apply
{const p=await page(SAVE({xp:640}));const base=await P(p);const order=[];for(const pick of ['hearth','riposte','heart','might']){await sim(p,80);const c=await card(p);order.push(c?c.h:null);if(c)await tap(p,pick);}
 await sim(p,80);const pr=await P(p);
 ok('Lv 13 catch-up: offered Lv 3, 6, 9, 12 in order, one at a time',order.join('|')==='Level 3 · choose one|Level 6 · choose one|Level 9 · choose one|Level 12 · choose one'&&!(await card(p)),order);
 ok('effects: +1 spark cap, 1.5 s / ×1.75 riposte, +1 heart, heavy blows −30% stamina',pr.kMax===4&&pr.mods.ripWin===1.5&&pr.mods.ripMul===1.75&&pr.hpMax===base.hpMax+1&&pr.mods.heavyMul===0.7,{pr,baseHp:base.hpMax});await p.close();}
{const p=await page(SAVE({xp:640,perks:['stride','mend','guard','blaze']}));await sim(p,60);const pr=await P(p);
 ok('other branch: Field Mending regen (2.5 s / 1.6 s), Steady Guard parry 0.34 s; no card',pr.regen.join()==='2.5,1.6'&&pr.mods.parryWin===0.34&&!(await card(p)),pr);await p.close();}
// 3 · layout at 360×740 and 915×412: both choices ≥ 44 px tall, on screen
for(const vp of [{width:360,height:740},{width:915,height:412}]){const p=await page(SAVE({xp:200}),'&tod=0.42&perks=1',vp);await sim(p,90);const c=await card(p);
 ok(`perk card ${vp.width}×${vp.height}: two choices ≥ 44 px tall, inside the screen`,c&&c.btns.length===2&&c.btns.every(b=>b.h>=44&&b.x>=0&&b.y>=0&&b.x+b.w<=c.vw&&b.y+b.h<=c.vh),c&&c.btns.map(b=>({h:b.h,y:Math.round(b.y)})));
 if(vp.width===360)await p.screenshot({path:'/workspace/vale3d-m64/shots/m64/m64f-perk-card.png'});await p.close();}
// 4 · relics: found → worn; the weapon menu lists them; one worn at a time; effects
{const p=await page(SAVE({xp:60,seals:{forge:true}}));await sim(p,20);await p.evaluate(()=>window.__vale.giveRelic('emberstone'));let pr=await P(p);
 ok('first relic found is worn automatically',pr.relics.join()==='emberstone'&&pr.relic==='emberstone',pr);
 const t=await atHusks(p);const v0=(await K(p)).v;for(let i=0;i<4&&(await K(p)).v===v0;i++)await rollOnce(p,t.id);const v1=(await K(p)).v;
 ok('Emberstone: rolling through a blow gathers a whole spark',v1===v0+1,{v0,v1});
 await p.evaluate(()=>{window.__vale.giveRelic('tidepearl');window.__vale.giveRelic('oathring');});
 const menu=await p.evaluate(()=>{document.getElementById('b-wpn').click();return [...document.querySelectorAll('#wpick button[data-r]')].map(b=>({r:b.dataset.r,on:b.classList.contains('on'),dis:b.disabled,h:b.getBoundingClientRect().height}));});
 const mul0=(await P(p)).mul;await p.evaluate(()=>document.querySelector('#wpick button[data-r="oathring"]').click());pr=await P(p);
 ok('weapon menu lists the three relics; tapping Oath-Ring wears it (only one worn); blows +10%',menu.length===3&&menu.every(m=>!m.dis&&m.h>=44)&&pr.relic==='oathring'&&Math.abs(pr.mul-mul0-0.1)<0.001,{menu,relic:pr.relic,mul0,mul:pr.mul});
 await p.evaluate(()=>window.__vale.wearRelic('tidepearl'));await p.evaluate(()=>window.__vale.wound(2));const hp0=(await W(p)).playerHp;let hp1=hp0;
 for(let i=0;i<4&&hp1===hp0;i++){await parryOnce(p,t.id);hp1=(await W(p)).playerHp;}
 ok('Tide-Pearl: a parry mends a heart',hp1>=hp0+1,{hp0,hp1});await p.close();}
// 5 · repeat-clear XP: a group cleared on an earlier day pays half per foe
const gains=[];for(const again of [false,true]){const p=await page(SAVE({xp:60,day:4,rk:again?{'d-dome':2}:{}}),'&tod=0.42');await sim(p,20);const t=await atHusks(p,0);await p.evaluate(()=>window.__vale.foeHp(0.3));
 const m=(await G(p,'d-dome')).mobs.find(m=>m.id===t.id);const xp0=(await p.evaluate(()=>window.__vale.quest().save)).xp;
 for(let r=0;r<6;r++){const mm=(await G(p,'d-dome')).mobs.find(x=>x.id===t.id);if(!mm.alive)break;await p.evaluate((x,z)=>window.__vale.warp(x,z-1.2),mm.x,mm.z);await key(p,'KeyK',true);await key(p,'KeyK',false);await sim(p,16);await p.evaluate(()=>window.__vale.heal());}
 const xp1=(await p.evaluate(()=>window.__vale.quest().save)).xp;gains.push(xp1-xp0);await p.close();}
ok('a first clear pays full XP (Husk 5); a group cleared on an earlier day pays half, rounded up (3)',gains[0]===5&&gains[1]===3,{gains});
// 6 · migrations: M54-era save (no lists); junk perks/relics; worn relic not owned
{const m54={v:1,started:true,done:false,xp:330,seals:{dawn:true},runes:[0,0,0],wind:false,warden:false,mirrors:[0,0,0,0],beacon:false,echo:false,charted:[false,false,false,false,false,false,false],cave:0,coast:0,sea:0,lamp:0};
 let p=await page(JSON.stringify(m54),'&tod=0.42');await sim(p,10);let pr=await P(p);ok('M54-era save: level kept (Lv 7), no perks/relics, M63 defaults in force',pr.level===7&&pr.perks.length===0&&pr.relic===null&&pr.mods.parryWin===0.24&&pr.mods.dodgeMul===1,pr);await p.close();
 p=await page(SAVE({xp:640,perks:['x',7,'stride','hearth','guard','guard'],relics:['oathring','fake',3],relic:'emberstone'}),'&tod=0.42');await sim(p,10);pr=await P(p);
 ok('junk lists repaired: one perk per tier (known ids), relics filtered, unowned worn relic dropped',pr.perks.join()==='hearth,guard'&&pr.relics.join()==='oathring'&&pr.relic===null,pr);
 const raw=JSON.parse(await p.evaluate(()=>localStorage.getItem('vale3d-save')));ok('repaired lists are what gets written back',JSON.stringify(raw.perks)==='["hearth","guard"]'&&JSON.stringify(raw.relics)==='["oathring"]',{perks:raw.perks,relics:raw.relics,relic:raw.relic});await p.close();}
ok('no page errors',errs.length===0,errs.slice(0,3));
console.log(`\nM64F progress: ${n-fails}/${n} PASS`);await b.close();process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(2);});
