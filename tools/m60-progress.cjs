// M60 · progression acceptance (INTERNAL, headless): level → blow multiplier, level-up banner, seal reward + pointer,
// weapon picker info, real hit damage at two levels, old-save load. Works against the old build too (reports what is missing).
// PORT=8095 OUT=… SHOTS=dir node tools/m60-progress.cjs
const pc=require(process.env.PUPPETEER_CORE);const fs=require('fs');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const PORT=process.env.PORT||'8095',SHOTS=process.env.SHOTS||'',OUT=process.env.OUT||'';
const SAVE=(o={})=>JSON.stringify({v:1,started:true,done:false,xp:0,seals:{},runes:[0,0,0],wind:false,warden:false,mirrors:[0,0,0,0],beacon:false,echo:false,charted:[false,false,false,false,false,false,false],cave:0,coast:0,sea:0,lamp:0,weapons:['rusty'],weapon:'rusty',...o});
let pass=0,fail=0;const R={port:PORT,checks:[]};const ok=(n,c,d)=>{c?pass++:fail++;R.checks.push({n,ok:!!c,d});console.log((c?'PASS ':'FAIL ')+n,JSON.stringify(d||{}));};
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:900000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const errs=[];
const page=async(q,save)=>{const p=await b.newPage();await p.setViewport({width:412,height:915,isMobile:true,hasTouch:true});p.on('pageerror',e=>errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?q=lite&qa=1&${q}`,{waitUntil:'load'});await p.evaluate((s)=>{localStorage.clear();localStorage.setItem('vale3d-hero',JSON.stringify({name:'Ilka',sex:'female'}));localStorage.setItem('vale3d-coach',JSON.stringify({done:['move','talk','seal','attack','dodge','rolled','parry','parried','stamina','hurt','claim','pick']}));if(s)localStorage.setItem('vale3d-save',s);},save);
  await p.reload({waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(600);return p;};
const Q=(p)=>p.evaluate(()=>{const v=window.__vale,q=v.quests();return {level:q.level,power:q.power,lvBanner:q.lvBanner,lvCount:q.lvCount,xp:q.xp,stats:document.getElementById('qstats')?.textContent||'',toast:document.getElementById('toast')?.textContent||'',wpick:document.getElementById('wpick')?.textContent.slice(0,400)||''};});
const sim=(p,n)=>p.evaluate((n)=>window.__vale.sim(Array(n).fill(1/30),0,0),n);
// A · multipliers + HUD line, no banner on load
for(const [xp,whet,exp] of [[0,0,1],[230,0,1.12],[700,2,1.66]]){const p=await page('',SAVE({xp,whet,seals:{dawn:true}}));await sim(p,30);const q=await Q(p);
  ok(`power at ${xp} XP, ${whet} whetstones = ${exp}`,Math.abs((q.power??-1)-exp)<0.005,{power:q.power,level:q.level});
  ok(`no level-up banner on load (${xp} XP)`,!q.lvCount,{lvCount:q.lvCount});
  if(xp===230){ok('HUD shows progress to next level (230/250)',/230\/250/.test(q.stats),{stats:q.stats});ok('weapon picker states the blow bonus and speed/stagger',/Your blows \+12%/.test(q.wpick)&&/fast|medium|slow/.test(q.wpick),{wpick:q.wpick.slice(0,200)});
    await p.keyboard.press('KeyJ');await sleep(400);const j=await p.evaluate(()=>document.body.innerText.match(/Level \d+ · \d+ XP[^\n]*/)?.[0]||'');ok('Journal header shows level bonus + next level',/blows \+12%.*next level at 250 XP/.test(j),{j});}
  await p.close();}
// B · seal claim crossing a level: +50 XP, n/4 + seals left pointer, one banner
{const p=await page('',SAVE({xp:30}));const s=await p.evaluate(()=>window.__vale.quest().seals.find(x=>x.id==='forge'));
 await p.evaluate((x,z)=>{window.__vale.warp(x+1.6,z+1.6);},s.x,s.z);await sim(p,20);await p.evaluate(()=>window.__vale.interact());await sim(p,12);const q=await Q(p);
 ok('seal pays +50 XP',q.xp===80,{xp:q.xp});ok('seal 1 toast: +50 XP · 1/4 (pointer left to the opening coach tip)',/claimed · \+50 XP · 1\/4$/.test(q.toast.trim()),{toast:q.toast});
 ok('level-up banner: Level 2 · blows +3% · next at 100 XP',/Level 2/.test(q.lvBanner||'')&&/blows \+3%/.test(q.lvBanner||'')&&/next at 100 XP/.test(q.lvBanner||''),{lvBanner:q.lvBanner});
 ok('banner fired exactly once',q.lvCount===1,{lvCount:q.lvCount});
 if(SHOTS){fs.mkdirSync(SHOTS,{recursive:true});await p.screenshot({path:`${SHOTS}/seal-levelup.png`});}
 for(const [w,h] of [[412,915],[360,740]]){await p.setViewport({width:w,height:h,isMobile:true,hasTouch:true});await p.evaluate(()=>document.getElementById('lvup').classList.add('on'));await sleep(400); /* layout check: hold the shown state (firing/clearing are checked separately; a slow screenshot could outlast the 3.2 s timer) */
  const ov=await p.evaluate(()=>{const r=(id)=>{const e=document.getElementById(id);if(!e||e.hidden)return null;const s=getComputedStyle(e);if(s.display==='none'||+s.opacity<0.05)return null;const b=e.getBoundingClientRect();return b.width&&b.height?b:null;};
   {const e=document.getElementById('lvup');e.style.transition='none';e.classList.add('on');void e.offsetWidth;} /* M62.1 harness fix: re-show synchronously; the game's own 3.2 s timer could clear 'on' during the 400 ms wait (flaked 19/21 on the live M61 build too) */ const L=r('lvup');if(!L)return {lv:null};const o={};for(const id of ['toast','coach','b-atk','b-hvy','b-blk','b-dge','b-jmp','b-wpn','joy','action','combat','hud']){const B=r(id);if(!B)continue;const x=Math.max(0,Math.min(L.right,B.right)-Math.max(L.left,B.left)),y=Math.max(0,Math.min(L.bottom,B.bottom)-Math.max(L.top,B.top));if(x*y>0)o[id]=Math.round(x*y);}return {lv:[Math.round(L.top),Math.round(L.bottom)],o};});
  ok(`banner overlaps nothing at ${w}x${h}`,ov.lv&&!Object.keys(ov.o).length,ov);}
 await p.evaluate(()=>document.getElementById('lvup').classList.remove('on')); await p.setViewport({width:412,height:915,isMobile:true,hasTouch:true});
 await sim(p,150);const q2=await Q(p);ok('banner clears after ~3 s, no repeat',!q2.lvBanner&&q2.lvCount===1,{q2:q2.lvBanner,c:q2.lvCount});await p.close();}
// B2 · second seal: pointer to the remaining seals
{const p=await page('',SAVE({xp:80,seals:{forge:true}}));const s=await p.evaluate(()=>window.__vale.quest().seals.find(x=>x.id==='sun'));
 await p.evaluate((x,z)=>{window.__vale.warp(x+1.6,z+1.6);},s.x,s.z);await sim(p,20);await p.evaluate(()=>window.__vale.interact());await sim(p,12);const q=await Q(p);
 ok('seal 2 toast: 2/4 · 2 seals left — clues in your Journal',/2\/4 · 2 seals left — clues in your Journal/.test(q.toast),{toast:q.toast,xp:q.xp});
 if(SHOTS)await p.screenshot({path:`${SHOTS}/seal2-levelup.png`});await p.close();}
// C · a real hit on a Wayside Husk (Rusty Sword, light, first cut) at Level 1 vs Level 5
const hit=async(xp)=>{const p=await page('tod=0.42',SAVE({xp,seals:{dawn:true}}));await p.evaluate(()=>window.__vale.warp(8,35.5));let m=null;
  for(let i=0;i<40&&!m;i++){await sim(p,5);m=await p.evaluate(()=>{const c=window.__vale.camInfo().st;for(const g of window.__vale.world().groups)for(const m of g.mobs)if(m.alive&&m.look==='husk'&&Math.hypot(m.x-c.px,m.z-c.pz)<6)return m;return null;});}
  if(!m){await p.close();return null;}let d=null;
  for(let t=0;t<12&&d===null;t++){await p.evaluate((id)=>{const v=window.__vale,c=v.camInfo().st;let mm=null;for(const g of v.world().groups)for(const x of g.mobs)if(x.id===id)mm=x;const a=Math.atan2(mm.x-c.px,mm.z-c.pz);const r=Math.hypot(mm.x-c.px,mm.z-c.pz);if(r>1.3)v.warp(mm.x-Math.sin(a)*1.1,mm.z-Math.cos(a)*1.1);v.view(a,a,0.3,6);},m.id);
    const hp0=await p.evaluate((id)=>{for(const g of window.__vale.world().groups)for(const x of g.mobs)if(x.id===id)return x.hp;},m.id);
    await p.keyboard.down('KeyK');await sim(p,1);await p.keyboard.up('KeyK');
    for(let k=0;k<20&&d===null;k++){await sim(p,1);const hp1=await p.evaluate((id)=>{for(const g of window.__vale.world().groups)for(const x of g.mobs)if(x.id===id)return x.hp;},m.id);if(hp1<hp0)d=+(hp0-hp1).toFixed(3);}
    await p.evaluate(()=>window.__vale.heal());await sim(p,20);}
  await p.close();return d;};
const d1=await hit(0),d5=await hit(230);R.hitL1=d1;R.hitL5=d5;
ok('real hit: Level 1 = 1.00, Level 5 = 1.12 (Rusty light cut)',d1!==null&&d5!==null&&Math.abs(d1-1)<0.01&&Math.abs(d5-1.12)<0.01,{d1,d5});
// D · old save (no M60 knowledge, high XP, whetstones) loads; nothing new is written
{const p=await page('',SAVE({xp:1900,whet:4,seals:{dawn:true,sun:true,tide:true,forge:true},done:true,sq:{sefa:2},hpUp:1}));await sim(p,30);const raw=await p.evaluate(()=>JSON.parse(localStorage.getItem('vale3d-save')));const q=await Q(p);
 const known=['v','started','done','xp','seals','runes','wind','warden','mirrors','beacon','echo','charted','cave','coast','sea','lamp','weapons','weapon','fog','chests','lore','foes','secrets','views','stashes','whet','tod','day','rk','sq','found','hpUp','fogV','gone','ressStair','kit'];
 ok('old high-XP save loads: Level 39, power capped 1+0.6+0.36',q.level===39&&Math.abs(q.power-1.96)<0.005,{level:q.level,power:q.power});ok('no new save fields written',Object.keys(raw).every(k=>known.includes(k)),{keys:Object.keys(raw)});await p.close();}
R.errs=errs;ok('no page errors',!errs.length,{errs:errs.slice(0,3)});
console.log(`M60-PROGRESS ${fail?'FAIL':'PASS'} ${pass}/${pass+fail}`);if(OUT)fs.writeFileSync(OUT,JSON.stringify(R,null,1));await b.close();process.exit(fail?1:0);})();
