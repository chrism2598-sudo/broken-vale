// M64 · targeted test: Wind Shrine wording (no player-facing "optional"), stun-lock poise, attack token, mixed groups,
// out-of-combat recovery, wind-up timings, draw-call cost, M63-save load. EMULATED headless Chrome (not player data).
// PORT=8102 DIST=dist OUT=… node tools/m64-combat.cjs        BEFORE=1 → measure only (for the M63 probe build; no asserts)
const pc=require(process.env.PUPPETEER_CORE);const fs=require('fs');const path=require('path');const sleep=ms=>new Promise(r=>setTimeout(r,ms));const PORT=process.env.PORT||'8100';const BEFORE=!!process.env.BEFORE;
let fails=0,n=0;const R={port:PORT,before:BEFORE,checks:[]};const ok=(name,c,d)=>{if(BEFORE){console.log('MEASURE '+name+' '+JSON.stringify(d).slice(0,400));return;}n++;R.checks.push({name,pass:!!c,d});console.log((c?'PASS ':'FAIL ')+name+(d!==undefined?' '+JSON.stringify(d).slice(0,400):''));if(!c)fails++;};
const SAVE=(o={})=>JSON.stringify({v:1,started:true,done:false,xp:0,seals:{},runes:[0,0,0],wind:false,warden:false,mirrors:[0,0,0,0],beacon:false,echo:false,charted:[false,false,false,false,false,false,false],cave:0,coast:0,sea:0,lamp:0,weapons:['rusty'],weapon:'rusty',...o});
const ALLC=['move','talk','seal','attack','dodge','rolled','parry','parried','stamina','hurt','claim','pick'];
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:900000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const errs=[];
const page=async(save,coach,q='&tod=0.42')=>{const p=await b.newPage();await p.setViewport({width:412,height:915,isMobile:true,hasTouch:true});p.on('pageerror',e=>errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?q=lite&qa=1${q}`,{waitUntil:'load'});
  await p.evaluate((s,c)=>{localStorage.clear();localStorage.setItem('vale3d-hero',JSON.stringify({name:'Ilka',sex:'female'}));if(c)localStorage.setItem('vale3d-coach',JSON.stringify(c));if(s)localStorage.setItem('vale3d-save',s);},save,coach);
  await p.reload({waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(500);return p;};
const sim=(p,k)=>p.evaluate(k=>window.__vale.sim(Array(k).fill(1/30),0,0),k);
// ---------- A · Wind Shrine wording ----------
if(!BEFORE&&process.env.DIST){const dir=path.join(process.env.DIST,'assets');const js=fs.readdirSync(dir).filter(f=>/^index-.*\.js$/.test(f)).map(f=>fs.readFileSync(path.join(dir,f),'utf8')).join('\n');
  // every "optional" left in the game bundle must be one of the known non-shrine uses (Warden, Echo Grove, the keeps)
  const OKS=[/Vale Warden \(optional\)$/,/Echo Grove \(optional\)$/,/The keeps \(optional\)$/,/It is optional,$/];const all=[],hits=[];let re=/\boptional\b/g,m;
  while((m=re.exec(js))){const pre=js.slice(Math.max(0,m.index-40),m.index+m[0].length+1).replace(/\s+/g,' ');all.push(pre);if(!OKS.some(r=>r.test(pre)))hits.push(pre);}
  R.optionalInBundle=all;ok('bundle: every remaining "optional" is a non-shrine place (Warden, Echo Grove, keeps); none about the Wind Shrine',hits.length===0&&!/holds an optional trial/.test(js),{hits,all});
  ok('bundle: Wayfinder says the shrine holds "the trial the Beacon will ask of you"',js.includes('The Wind Shrine up the path holds the trial the Beacon will ask of you.'),{});
  ok('bundle: HUD label reads "needed for the Beacon"',/blessing opens the Updraft.{0,6}needed for the Beacon/.test(js),{});}
if(!BEFORE){const p=await page(null,null,'');if(await p.evaluate(()=>!document.getElementById('create').hidden))await p.click('#begin');await sim(p,20);
  const q0=await p.evaluate(()=>window.__vale.quest());await p.evaluate((x,z)=>window.__vale.warp(x,z+1.5),q0.wayfinder.x,q0.wayfinder.z);await sim(p,10);await p.evaluate(()=>window.__vale.interact());
  const lines=[];for(let i=0;i<15&&(await p.evaluate(()=>window.__vale.quest().talking));i++){lines.push(await p.evaluate(()=>document.getElementById('dtxt').textContent));await p.evaluate(()=>window.__vale.advance());await sim(p,2);}
  R.wayfinder=lines;const shrineLine=lines.find(l=>/Wind Shrine/.test(l))||'';
  ok('Wayfinder (in game): shrine line says the Beacon needs it, no "optional"',/Beacon/.test(shrineLine)&&!lines.some(l=>/optional/i.test(l)),lines);
  await p.evaluate(()=>window.__vale.warp(-20,-20));await sim(p,30);const wt=await p.evaluate(()=>({txt:document.getElementById('wtext').textContent}));R.hudWind=wt;
  ok('HUD (in game): Wind Shrine label reads "needed for the Beacon", no "optional"',/Wind Shrine \(needed for the Beacon\)/.test(wt.txt)&&!/optional/i.test(wt.txt),wt);
  await p.keyboard.press('KeyJ');await sleep(500);const jt=((await p.evaluate(()=>window.__vale.sheets())).journalText||'').toLowerCase();await p.keyboard.press('KeyJ');await sleep(200);
  const jl=jt.split('\n').filter(l=>/shrine/.test(l));ok('Journal (in game): Wind Shrine lines carry no "optional"',jl.length>0&&!jl.some(l=>/optional/.test(l)),jl.slice(0,4));
  const all=await p.evaluate(()=>document.body.innerText);ok('whole page text: nothing says the Wind Shrine is optional',!/wind shrine[^\n]{0,40}optional/i.test(all),{});
  await p.close();}
// ---------- B1 · stun-lock: mash light attacks into one sturdy foe for 10 s ----------
const fight=async(weapon)=>{const p=await page(SAVE({weapons:['rusty',weapon],weapon}),ALLC);await sim(p,20);
  await p.evaluate(()=>window.__vale.warp(8,35));await sim(p,30);
  const w0=await p.evaluate(()=>window.__vale.world());const g=w0.groups.find(g=>g.id==='d-dome');const tgt=g.mobs.find(m=>m.alive);
  await p.evaluate(()=>window.__vale.foeBulk(1000));await p.evaluate((x,z)=>window.__vale.warp(x,z-1.1),tgt.x,tgt.z);await sim(p,2);
  const s0=(await p.evaluate(()=>window.__vale.world())).swings;let streak=0,maxStreak=0,winds=0,prev='',frames=300;const tl=[];
  for(let i=0;i<frames;i++){await p.evaluate(()=>{dispatchEvent(new KeyboardEvent('keydown',{code:'KeyK'}));dispatchEvent(new KeyboardEvent('keyup',{code:'KeyK'}));window.__vale.heal();});await sim(p,1);
    const st=await p.evaluate(id=>{const v=window.__vale.world();for(const g of v.groups)for(const m of g.mobs)if(m.id===id)return {s:m.state,hp:m.hp};return null;},tgt.id);if(!st)break;
    tl.push(st.s[0]);if(st.s==='stagger'){streak++;maxStreak=Math.max(maxStreak,streak);}else streak=0;if(st.s==='windup'&&prev!=='windup')winds++;prev=st.s;}
  const w1=await p.evaluate(()=>window.__vale.world());const cs=await p.evaluate(()=>window.__vale.combat().counts);
  const r={weapon,secs:frames/30,lightSwings:cs.light,foeWindups:winds,foeBlows:w1.swings-s0,longestStaggerS:+(maxStreak/30).toFixed(2),timeline:tl.join('')};R['stun_'+weapon]=r;await p.close();return r;};
for(const wpn of ['maul','tide','halberd','rusty']){const r=await fight(wpn);
  ok(`stun-lock (${wpn}, light mash 10 s): longest unbroken stagger ≤ 2.0 s and the foe winds up ≥ 3 times`,r.longestStaggerS<=2.0&&r.foeWindups>=3&&r.lightSwings>=15,{...r,timeline:undefined});}
// ---------- A2 · defence pays: parry → riposte, roll through a blow → stamina back; Sentinel guard; foe tactics ----------
const watchWind=async(p,id)=>{for(let i=0;i<240;i++){await sim(p,1);const s=await p.evaluate(id=>{for(const g of window.__vale.world().groups)for(const m of g.mobs)if(m.id===id)return m.state;},id);if(s==='windup')return true;}return false;};
const key=(p,code,down)=>p.evaluate((c,d)=>dispatchEvent(new KeyboardEvent(d?'keydown':'keyup',{code:c})),code,down);
const near1=async(p,gid,x,z)=>{await p.evaluate((x,z)=>window.__vale.warp(x,z),x,z);await sim(p,30);const g=(await p.evaluate(()=>window.__vale.world())).groups.find(g=>g.id===gid);return g.mobs.find(m=>m.alive);};
if(!BEFORE){const p=await page(SAVE({}),ALLC);await sim(p,20);const t=await near1(p,'d-dome',8,35);await p.evaluate(()=>window.__vale.foeBulk(1000));await p.evaluate((x,z)=>window.__vale.warp(x,z-1.2),t.x,t.z);
  let parried=0,rip=0,slip=0,stam=[];for(let k=0;k<4&&rip<1;k++){if(!await watchWind(p,t.id))break;await sim(p,22);await key(p,'KeyQ',true);await sim(p,8);await key(p,'KeyQ',false);await key(p,'KeyK',true);await key(p,'KeyK',false);await sim(p,20);await p.evaluate(()=>window.__vale.heal());
    const c=await p.evaluate(()=>window.__vale.combat().counts);parried=c.parry;rip=c.riposte;}
  for(let k=0;k<4&&slip<1;k++){if(!await watchWind(p,t.id))break;await sim(p,19);const s0=await p.evaluate(()=>window.__vale.combat().stamina);await key(p,'KeyC',true);await sim(p,1);await key(p,'KeyC',false);await sim(p,14);const c=await p.evaluate(()=>window.__vale.combat());slip=c.counts.slip;stam.push([s0,c.stamina]);await p.evaluate(()=>window.__vale.heal());}
  R.defence={parried,ripostes:rip,slips:slip,stamina:stam};
  ok('parry opens a riposte (next blow ×1.5, hard stagger)',parried>=1&&rip>=1,R.defence);
  ok('rolling through a blow refunds stamina (+12)',slip>=1,R.defence);await p.close();}
const res=[];if(!BEFORE)for(const w of ['rusty','spear']){const p=await page(SAVE({weapons:['rusty',w],weapon:w}),ALLC);await sim(p,20);const S=async()=>(await p.evaluate(()=>window.__vale.world())).groups.find(g=>g.id==='d-south').mobs.find(m=>m.look==='sentinel');
  const s=await S();await p.evaluate((x,z)=>window.__vale.warp(x,z-4),s.x,s.z);await sim(p,30);await p.evaluate(()=>window.__vale.foeBulk(1000));let r=null;
    for(let k=0;k<5&&!r;k++){const m=await S();if(!await watchWind(p,m.id))break;let st='';for(let i=0;i<40&&st!=='recover';i++){await sim(p,1);st=(await S()).state;}await p.evaluate(()=>window.__vale.heal());
      const hp0=(await S()).hp;await key(p,'KeyK',true);await key(p,'KeyK',false);await sim(p,10);const m2=await S();if(m2.hp<hp0)r={weapon:(await p.evaluate(()=>window.__vale.combat().weapon)),dHp:+(hp0-m2.hp).toFixed(3),state:m2.state};}
    res.push(r);await p.close();}
{  R.guard=res;if(!BEFORE)ok('Sentinel guard: a frontal Rusty-sword cut glances (half damage, no stagger); a Spear thrust gets through',!!(res[0]&&res[1]&&res[0].dHp<res[1].dHp&&res[0].state!=='stagger'&&res[1].state==='stagger'),res);}
if(!BEFORE){const p=await page(SAVE({}),ALLC,'&tod=0.97');await sim(p,20);await p.evaluate(()=>window.__vale.warp(-12,-30));const seen=new Set();
  for(let i=0;i<300;i++){await p.evaluate(()=>window.__vale.heal());await sim(p,1);const t=await p.evaluate(()=>window.__vale.world().groups.find(g=>g.id==='n-road').mobs.map(m=>m.tac).join());t.split(',').forEach(x=>x&&seen.add(x));if(seen.has('circle'))break;}
  R.tactics={shade:[...seen]};ok('Gloam Shades circle to flank before striking',seen.has('circle'),R.tactics);await p.close();}
// ---------- B2 · attack token: two Gloam Shades at night on an idle player ----------
{const p=await page(SAVE({}),ALLC,'&tod=0.97');await sim(p,20);await p.evaluate(()=>window.__vale.warp(-12,-30));await sim(p,4);
  const starts=[];let prev={},maxW=0;for(let i=0;i<360;i++){await p.evaluate(()=>window.__vale.heal());await sim(p,1);const ms=await p.evaluate(()=>window.__vale.world().groups.filter(g=>g.present&&g.near).flatMap(g=>g.mobs.filter(m=>m.alive).map(m=>[m.id,m.state])));
    let w=0;for(const [id,s] of ms){if(s==='windup'){w++;if(prev[id]!=='windup')starts.push({id,t:i/30});}prev[id]=s;}maxW=Math.max(maxW,w);}
  let minGap=99,close=0;for(let i=1;i<starts.length;i++){if(starts[i].id!==starts[i-1].id){const gp=starts[i].t-starts[i-1].t;minGap=Math.min(minGap,gp);if(gp<0.3)close++;}}
  const r={windupStarts:starts.length,maxAtOnce:maxW,minGapBetweenFoesS:+minGap.toFixed(3),startsUnder0_3s:close};R.token=r;
  ok('attack token: two shades never start wind-ups within 0.4 s of each other; ≤ 2 wind-ups at once',starts.length>=4&&minGap>=0.4&&maxW<=2,r);await p.close();}
// ---------- B2 · mixed groups (existing foes, same spots) + draw cost ----------
{const p=await page(SAVE({}),ALLC);await sim(p,20);const w=await p.evaluate(()=>window.__vale.world());const G=id=>w.groups.find(g=>g.id===id);
  const comp=Object.fromEntries(['n-road','n-shrine','n-pale','n-azure','n-sun','n-dome','n-east','d-veil','d-south','d-dome'].map(id=>[id,{looks:G(id).mobs.map(m=>m.look),x:G(id).x,z:G(id).z}]));R.groups=comp;
  const want={'n-sun':'brute,shade','n-east':'husk,shade','d-veil':'cultist,husk','d-south':'sentinel,husk','n-road':'shade,shade','d-dome':'husk,husk'};
  ok('mixed groups: n-sun Brute+Shade, n-east Husk+Shade, d-veil Cultist+Husk, d-south Sentinel+Husk; opening (d-dome) and n-road unchanged',Object.entries(want).every(([id,l])=>comp[id].looks.join()===l),Object.fromEntries(Object.keys(want).map(k=>[k,comp[k].looks.join()])));
  const pos={'n-sun':[-44,52],'n-east':[86,-12],'d-veil':[-96,-58],'d-south':[4,96]};ok('mixed groups keep their spots',Object.entries(pos).every(([id,[x,z]])=>comp[id].x===x&&comp[id].z===z),{});
  await p.evaluate(()=>window.__vale.warp(-90,-52));await sim(p,40);const g=(await p.evaluate(()=>window.__vale.world())).groups.find(g=>g.id==='d-veil');const a=g.mobs.find(m=>m.alive)||g;
  await p.evaluate((x,z)=>{const v=window.__vale,c=v.camInfo().st;const yaw=Math.atan2(x-c.px,z-c.pz);v.view(yaw,yaw,0.15,c.dist);},a.x,a.z);await sim(p,6);
  const frame=()=>p.evaluate(()=>{const V=window.__vale;const a=V.bench(2),c=V.bench(4);return {calls:Math.round((c.calls-a.calls)/2),tris:Math.round((c.tris-a.tris)/2)};});const up=await frame();
  await p.evaluate(()=>window.__vale.foeBulk(-1e9));await sim(p,60);const down=await frame();R.drawVeil={up,down,groupCalls:up.calls-down.calls,groupTris:up.tris-down.tris};
  ok('d-veil group (now Cultist + Husk) in view costs ≤ 40 draw calls (M63 husk pair: see BEFORE run)',R.drawVeil.groupCalls<=40,R.drawVeil);await p.close();}
// ---------- B4 · out-of-combat recovery ----------
{const p=await page(SAVE({}),ALLC);await sim(p,20);await p.evaluate(()=>window.__vale.warp(3,1));await sim(p,30);await p.evaluate(()=>window.__vale.wound(2));const hp=[];
  for(let s=0;s<=10;s++){hp.push(await p.evaluate(()=>window.__vale.world().playerHp));await sim(p,30);}R.regen={hpEachSecond:hp};
  const t2=hp.findIndex(h=>h>=2),t3=hp.findIndex(h=>h>=3);
  ok('recovery: 1→2 hearts after ~4 s calm, full (3) after ~6.5 s — no longer all at once at 6 s',hp[0]===1&&t2>=4&&t2<=5&&t3>=6&&t3<=8,{hp,t2,t3});await p.close();}
// ---------- B5 · wind-ups (tier 0 and tier 5) ----------
{const W={};for(const [lab,o] of [['t0',{}],['t5',{seals:{dawn:true,sun:true,tide:true,forge:true},done:true,beacon:true,wind:true,xp:400,cave:1}]]){const p=await page(SAVE(o),ALLC);await sim(p,30);const ft=await p.evaluate(()=>window.__vale.foeTier());
  W[lab]={};for(const g of ft.sample)for(const m of g.mobs)W[lab][m.look]=m.windup;await p.close();}R.windups=W;
  ok('wind-ups unchanged from M63 (shade 0.700 → 0.595 s at tier 5; brute 1.150 → ~0.977 s)',W.t0.shade===0.7&&W.t5.shade===0.595&&W.t0.brute===1.15&&Math.abs(W.t5.brute-0.9775)<0.002,W);}
// ---------- save compatibility: an M63 save (with a guard record) loads ----------
if(!BEFORE){const old={v:1,started:true,done:false,xp:120,seals:{forge:true,sun:true},runes:[1,0,0],wind:false,warden:false,mirrors:[0,0,0,0],beacon:false,echo:false,charted:[false,false,false,false,false,false,false],cave:0,coast:0,sea:0,lamp:0,weapons:['rusty','maul'],weapon:'maul',whet:1,day:2,rk:{'g-sun':2,'d-veil':1},future:{y:2}};
  const p=await page(JSON.stringify(old),ALLC);await sim(p,30);const s=await p.evaluate(()=>window.__vale.quest().save);const ft=await p.evaluate(()=>window.__vale.foeTier());
  ok('M63 save: progress, weapon, whetstone and guard record carry over; tier 2',s.xp===120&&s.seals.forge&&s.seals.sun&&s.weapon==='maul'&&s.whet===1&&s.rk['g-sun']===2&&ft.tier===2,{xp:s.xp,seals:s.seals,weapon:s.weapon,tier:ft.tier});await p.close();}
ok('no page errors',errs.length===0,errs.slice(0,3));
R.fails=fails;R.total=n;console.log(BEFORE?'M64-COMBAT MEASURED (before)':fails?`M64-COMBAT FAIL ${fails}/${n}`:`M64-COMBAT PASS ${n}/${n}`);if(process.env.OUT)fs.writeFileSync(process.env.OUT,JSON.stringify(R,null,1));await b.close();process.exit(fails?1:0);})().catch(e=>{console.error('ERR',e.message);process.exit(2);});
