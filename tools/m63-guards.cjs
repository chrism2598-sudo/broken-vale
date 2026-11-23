// M63 · targeted test: seal guards (seals 2–4), foe-tier scaling values, coach-tip spacing, old-save load + carry-over,
// draw-call cost of a guard group. EMULATED headless Chrome (not player data). PORT=8100 OUT=… node tools/m63-guards.cjs
const pc=require(process.env.PUPPETEER_CORE);const fs=require('fs');const sleep=ms=>new Promise(r=>setTimeout(r,ms));const PORT=process.env.PORT||'8100';
let fails=0,n=0;const R={checks:[]};const ok=(name,c,d)=>{n++;R.checks.push({name,pass:!!c,d});console.log((c?'PASS ':'FAIL ')+name+(d!==undefined?' '+JSON.stringify(d).slice(0,400):''));if(!c)fails++;};
const ALL4={dawn:true,sun:true,tide:true,forge:true};
const SAVE=(o={})=>JSON.stringify({v:1,started:true,done:false,xp:0,seals:{},runes:[0,0,0],wind:false,warden:false,mirrors:[0,0,0,0],beacon:false,echo:false,charted:[false,false,false,false,false,false,false],cave:0,coast:0,sea:0,lamp:0,weapons:['rusty'],weapon:'rusty',...o});
const BASE={husk:{hp:3,windup:0.95,speed:1.8,notice:8},shade:{hp:5,windup:0.7,speed:3.1,notice:14},brute:{hp:9,windup:1.15,speed:2.2,notice:12},cultist:{hp:5,windup:0.8,speed:2.7,notice:13},zealot:{hp:12,windup:1.05,speed:2.3,notice:14},sentinel:{hp:4,windup:0.85,speed:2.0,notice:9}};
const scale=t=>({hp:1+0.1*t,windup:1-0.03*t,speed:1+0.04*t,notice:1+0.05*t});
const FIRES=[[6.5,3.5],[-62,-98],[44,-98],[-60,60],[20,64]];
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:900000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const errs=[];
const page=async(save,coach,q='')=>{const p=await b.newPage();await p.setViewport({width:412,height:915,isMobile:true,hasTouch:true});p.on('pageerror',e=>errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?q=lite&qa=1&tod=0.42${q}`,{waitUntil:'load'});
  await p.evaluate((s,c)=>{localStorage.clear();localStorage.setItem('vale3d-hero',JSON.stringify({name:'Ilka',sex:'female'}));if(c)localStorage.setItem('vale3d-coach',JSON.stringify(c));if(s)localStorage.setItem('vale3d-save',s);},save,coach);
  await p.reload({waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(500);return p;};
const ALLC=['move','talk','seal','attack','dodge','rolled','parry','parried','stamina','hurt','claim','pick'];
const sim=(p,k,sx=0,sy=0)=>p.evaluate((k,sx,sy)=>window.__vale.sim(Array(k).fill(1/30),sx,sy),k,sx,sy);
const FT=p=>p.evaluate(()=>window.__vale.foeTier());const near=p=>p.evaluate(()=>window.__vale.world().near);
const tierOk=(ft,t,label)=>{const sc=scale(t);let bad=[];for(const g of ft.sample)for(const m of g.mobs){const B=BASE[m.look];if(!B)continue;const e={maxHp:Math.max(1,Math.round(B.hp*sc.hp)),windup:+(B.windup*sc.windup).toFixed(3),speed:+(B.speed*sc.speed).toFixed(3),notice:+(B.notice*sc.notice).toFixed(3)};
  for(const k of Object.keys(e))if(Math.abs(e[k]-m[k])>0.002)bad.push({g:g.id,look:m.look,k,want:e[k],got:m[k]});}
  ok(`${label}: tier ${t} roaming stats = base × (hp ${sc.hp.toFixed(2)}, wind-up ${sc.windup.toFixed(2)}, speed ${sc.speed.toFixed(2)}, notice ${sc.notice.toFixed(2)})`,ft.tier===t&&!bad.length,{tier:ft.tier,bad:bad.slice(0,4)});};
// A · fresh new game: tier 0 = shipped tuning, no guards
{const p=await page(null,null);if(await p.evaluate(()=>!document.getElementById('create').hidden))await p.click('#begin');await sim(p,30);const ft=await FT(p);
 tierOk(ft,0,'fresh game');ok('fresh game: no guard group present',ft.guards.every(g=>!g.present),ft.guards.map(g=>g.present));
 ok('guard spots: one per seal, outside every fire ring (+4 m) and the village',ft.guards.length===4&&ft.guards.every(g=>FIRES.every(([x,z])=>Math.hypot(g.x-x,g.z-z)>17)&&Math.hypot(g.x-3,g.z-1)>31),ft.guards.map(g=>[g.seal,g.x,g.z]));
 R.spots=ft.guards.map(g=>({seal:g.seal,x:g.x,z:g.z}));await p.close();}
// B · one seal (forge): guards at the other three, 2 foes each; claim gated; QA clear → claim → seal 2; remaining guards grow to 3
{const p=await page(SAVE({seals:{forge:true},xp:50}),ALLC);await sim(p,30);let ft=await FT(p);tierOk(ft,1,'1 seal');
 const pres=Object.fromEntries(ft.guards.map(g=>[g.seal,g]));
 ok('1 seal: forge (claimed) unguarded; dawn/sun/tide guarded by Sentinel + Husk',!pres.forge.present&&['dawn','sun','tide'].every(s=>pres[s].present&&JSON.stringify(pres[s].alive)==='["sentinel","husk"]'),ft.guards.map(g=>[g.seal,g.present,g.alive]));
 ok('1 seal: guard HP at tier 1 (Sentinel 4, Husk 3)',JSON.stringify(pres.sun.hp)==='[4,3]',pres.sun.hp);
 const q=await p.evaluate(()=>window.__vale.quest());const sun=q.seals.find(s=>s.id==='sun');
 await p.evaluate((x,z)=>window.__vale.warp(x+1.5,z+1.2),sun.x,sun.z);await sim(p,20);let nl=await near(p);
 ok('guarded seal shows "Guarded · Sun Shard" (no Claim)',nl==='Guarded · Sun Shard',nl);
 await p.evaluate(()=>window.__vale.interact());await sim(p,6);let st=await p.evaluate(()=>({seals:window.__vale.quest().save.seals,toast:document.getElementById('toast').textContent}));
 ok('interacting while guarded does not claim, says why',!st.seals.sun&&/guards still stand/.test(st.toast),st);
 // a real fight: step out of the fire ring toward the guards and check they engage with the amber ring (wind-up) visible
 const gs=pres.sun;await p.evaluate((x,z)=>window.__vale.warp(x,z),gs.x+(sun.x-gs.x)*0.25,gs.z+(sun.z-gs.z)*0.25);let wind=false,ringSeen=false;
 for(let i=0;i<60&&!wind;i++){await sim(p,3);const w=await p.evaluate(()=>{const v=window.__vale.world();const g=v.groups.find(g=>g.id==='g-sun');return g.mobs.filter(m=>m.alive).map(m=>m.state)});if(w.includes('windup')){wind=true;ringSeen=true;}}
 ok('guards engage a player on the approach and wind up (amber-ring state)',wind,{ringSeen});
 await p.evaluate(()=>window.__vale.heal());const ids=await p.evaluate(()=>window.__vale.guardsClear('sun'));await p.evaluate((x,z)=>window.__vale.warp(x+1.5,z+1.2),sun.x,sun.z);await sim(p,20);nl=await near(p);
 ok('after the guards fall: "Claim Sun Shard"',nl==='Claim Sun Shard',{nl,ids});
 await p.evaluate(()=>window.__vale.interact());await sim(p,30);st=await p.evaluate(()=>({seals:window.__vale.quest().save.seals,xp:window.__vale.quest().save.xp}));
 ok('seal 2 claimed, +50 XP',st.seals.sun&&st.xp===100,st);
 await sim(p,30);ft=await FT(p);const pr2=Object.fromEntries(ft.guards.map(g=>[g.seal,g]));
 ok('2 seals: tier 2; dawn/tide guards return as Sentinel + Husk + Sentinel',ft.tier===2&&['dawn','tide'].every(s=>pr2[s].present&&JSON.stringify(pr2[s].alive)==='["sentinel","husk","sentinel"]')&&!pr2.sun.present,ft.guards.map(g=>[g.seal,g.present,g.alive,g.hp]));
 ok('2 seals: guard HP at tier 2 (Sentinel 5, Husk 4)',JSON.stringify(pr2.dawn.hp)==='[5,4,5]',pr2.dawn.hp);
 // draw-call cost of a present guard group (view at the Dawn approach): guards up vs felled
 const dg=pr2.dawn;await p.evaluate((x,z)=>window.__vale.warp(x+6,z+6),dg.x,dg.z);await sim(p,10);await p.evaluate((x,z)=>{const v=window.__vale,c=v.camInfo().st;const yaw=Math.atan2(x-c.px,z-c.pz);v.view(yaw,yaw,0.15,c.dist);},dg.x,dg.z);await sim(p,6);
 const frame=()=>p.evaluate(()=>{const V=window.__vale;const a=V.bench(2),c=V.bench(4);return {calls:Math.round((c.calls-a.calls)/2),tris:Math.round((c.tris-a.tris)/2)};}); // same method as m39-audit};
 const up=await frame();await p.evaluate(()=>window.__vale.guardsClear('dawn'));await sim(p,6);const down=await frame();
 R.drawCost={guardsUp:{calls:up.calls,tris:up.tris},guardsDown:{calls:down.calls,tris:down.tris}};
 ok('a 3-foe guard group in view costs ≤ 40 draw calls (same budget as a night shade group)',up.calls-down.calls<=40,R.drawCost);
 await p.close();}
// C · three seals: the last seal gets Sentinel + Husk + Sentinel + Gloam Brute; tier 3
{const p=await page(SAVE({seals:{forge:true,sun:true,dawn:true},xp:150}),ALLC);await sim(p,30);const ft=await FT(p);tierOk(ft,3,'3 seals');const g=ft.guards.find(g=>g.seal==='tide');
 ok('3 seals: tide guarded by Sentinel + Husk + Sentinel + Gloam Brute (HP 5/4/5/12)',g.present&&JSON.stringify(g.alive)==='["sentinel","husk","sentinel","brute"]'&&JSON.stringify(g.hp)==='[5,4,5,12]',g);
 ok('3 seals: claimed seals unguarded',ft.guards.filter(x=>x.seal!=='tide').every(x=>!x.present));await p.close();}
// D · Chapter II (4 seals + Beacon lit): tier 5, no guards
{const p=await page(SAVE({seals:ALL4,done:true,beacon:true,wind:true,xp:400,cave:1}),ALLC);await sim(p,30);const ft=await FT(p);tierOk(ft,5,'Chapter II');ok('Chapter II: no guards',ft.guards.every(g=>!g.present));await p.close();}
{const p=await page(SAVE({seals:ALL4,done:true,xp:280}),ALLC);await sim(p,30);const ft=await FT(p);tierOk(ft,4,'4 seals, Beacon dark');await p.close();}
// E · old M62.1 saves load and carry over (fields, unknown future fields, an old rk record; written back unchanged except new rk ids)
{const old={v:1,started:true,done:false,xp:333,seals:{dawn:true,forge:true},runes:[1,2,0],wind:true,warden:true,mirrors:[1,0,3,2],beacon:false,echo:true,charted:[true,true,false,true,false,false,false],cave:0,coast:0,sea:0,lamp:0,weapons:['rusty','maul','knight'],weapon:'knight',whet:2,hpUp:1,day:3,rk:{'n-road':3},sq:{sefa:2,dov:1},found:['veil'],future:{x:1}};
 const p=await page(JSON.stringify(old),ALLC);await sim(p,30);await p.evaluate(()=>window.__vale.saveStatus&&0);const s=await p.evaluate(()=>window.__vale.quest().save);const raw=JSON.parse(await p.evaluate(()=>localStorage.getItem('vale3d-save')));
 ok('old M62.1 save: xp, seals, weapons, whetstones, heart, side tales, day carry over',s.xp===333&&s.seals.dawn&&s.seals.forge&&!s.seals.sun&&JSON.stringify(s.weapons)===JSON.stringify(old.weapons)&&s.whet===2&&s.hpUp===1&&s.day===3&&s.sq.sefa===2,{xp:s.xp,seals:s.seals,whet:s.whet});
 ok('old M62.1 save: written back with the same progress (xp, seals, weapons)',raw&&raw.xp===333&&raw.seals.dawn&&raw.seals.forge&&JSON.stringify(raw.weapons)===JSON.stringify(old.weapons),raw&&{xp:raw.xp,seals:raw.seals});
 const ft=await FT(p);ok('old save with 2 seals: tier 2, sun + tide guarded (3 foes)',ft.tier===2&&ft.guards.filter(g=>g.present).map(g=>g.seal).sort().join()==='sun,tide'&&ft.guards.filter(g=>g.present).every(g=>g.alive.length===3),ft.guards.map(g=>[g.seal,g.present,g.alive.length]));
 await p.close();}
// F · coach spacing: the opening fight teaches Attack + Roll only; Block/parry and stamina wait for the first fight after seal 1
{const p=await page(null,null);if(await p.evaluate(()=>!document.getElementById('create').hidden))await p.click('#begin');await sim(p,20);
 const q0=await p.evaluate(()=>window.__vale.quest());await p.evaluate((x,z)=>window.__vale.warp(x,z+1.5),q0.wayfinder.x,q0.wayfinder.z);await sim(p,10);await p.evaluate(()=>window.__vale.interact());for(let i=0;i<15&&(await p.evaluate(()=>window.__vale.quest().talking));i++){await p.evaluate(()=>window.__vale.advance());await sim(p,2);}
 const seen=[];const watch=async(k)=>{for(let i=0;i<k;i++){await sim(p,3);const c=await p.evaluate(()=>{const e=document.getElementById('coach');return e.classList.contains('on')?e.textContent:''});if(c&&seen[seen.length-1]!==c)seen.push(c);const hp=await p.evaluate(()=>window.__vale.world().playerHp);if(hp<=1)await p.evaluate(()=>window.__vale.heal());}};
 await p.evaluate(()=>window.__vale.warp(8,34));await watch(110);const opening=[...seen];
 ok('opening fight: Attack + Roll taught',opening.some(t=>/Attack/.test(t))&&opening.some(t=>/Roll|roll/.test(t)),opening);
 ok('opening fight: no Block/parry or stamina tip before the first seal',!opening.some(t=>/Block|parry|Parried|Stamina/.test(t)),opening);
 // first seal, then the first guard fight
 await p.evaluate(()=>{for(const g of window.__vale.world().groups);});const fo=q0.seals.find(s=>s.id==='forge');await p.evaluate((x,z)=>window.__vale.warp(x+1.5,z+1.2),fo.x,fo.z);await sim(p,15);await p.evaluate(()=>window.__vale.interact());await sim(p,200);
 const ft=await FT(p);const sg=ft.guards.find(g=>g.seal==='sun');seen.length=0;const sun=q0.seals.find(s=>s.id==='sun');await p.evaluate((x,z)=>window.__vale.warp(x,z),sg.x+(sun.x-sg.x)*0.25,sg.z+(sun.z-sg.z)*0.25);await watch(160);
 ok('first guard fight (after seal 1): Block/parry tip shown',seen.some(t=>/Block/.test(t)),seen);
 R.coach={opening,afterSeal1:[...seen]};await p.close();}
ok('no page errors',errs.length===0,errs.slice(0,3));
R.fails=fails;R.total=n;console.log(fails?`M63-GUARDS FAIL ${fails}/${n}`:`M63-GUARDS PASS ${n}/${n}`);if(process.env.OUT)fs.writeFileSync(process.env.OUT,JSON.stringify(R,null,1));await b.close();process.exit(fails?1:0);})().catch(e=>{console.error('ERR',e.message);process.exit(2);});
