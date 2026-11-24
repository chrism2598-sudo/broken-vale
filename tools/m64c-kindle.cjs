// M64C · targeted test: Kindling — earned only by defence after the first seal, four seal powers, attunement, HUD button
// layout, save migration (M54–M63 saves → no field → 0; values clamped; round-trip). EMULATED headless Chrome (not player data).
const pc=require(process.env.PUPPETEER_CORE);const fs=require('fs');const sleep=ms=>new Promise(r=>setTimeout(r,ms));const PORT=process.env.PORT||'8102';
let fails=0,n=0;const R={checks:[]};const ok=(name,c,d)=>{n++;R.checks.push({name,pass:!!c,d});console.log((c?'PASS ':'FAIL ')+name+(d!==undefined?' '+JSON.stringify(d).slice(0,400):''));if(!c)fails++;};
const SAVE=(o={})=>JSON.stringify({v:1,started:true,done:false,xp:0,seals:{},runes:[0,0,0],wind:false,warden:false,mirrors:[0,0,0,0],beacon:false,echo:false,charted:[false,false,false,false,false,false,false],cave:0,coast:0,sea:0,lamp:0,weapons:['rusty'],weapon:'rusty',...o});
const ALLC=['move','talk','seal','attack','dodge','rolled','parry','parried','stamina','hurt','claim','pick'];const ALL4={dawn:true,sun:true,tide:true,forge:true};
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:900000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const errs=[];
const page=async(save,q='&tod=0.42',vp={width:412,height:915})=>{const p=await b.newPage();await p.setViewport({...vp,isMobile:true,hasTouch:true});p.on('pageerror',e=>errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?q=lite&qa=1${q}`,{waitUntil:'load'});
  await p.evaluate((s,c)=>{localStorage.clear();localStorage.setItem('vale3d-hero',JSON.stringify({name:'Ilka',sex:'female'}));localStorage.setItem('vale3d-coach',JSON.stringify(c));if(s)localStorage.setItem('vale3d-save',s);},save,ALLC);
  await p.reload({waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(400);return p;};
const sim=(p,k)=>p.evaluate(k=>window.__vale.sim(Array(k).fill(1/30),0,0),k);const K=p=>p.evaluate(()=>window.__vale.kindle());
const key=(p,code,down)=>p.evaluate((c,d)=>dispatchEvent(new KeyboardEvent(d?'keydown':'keyup',{code:c})),code,down);
const W=p=>p.evaluate(()=>window.__vale.world());const G=async(p,id)=>(await W(p)).groups.find(g=>g.id===id);
const watchWind=async(p,id)=>{for(let i=0;i<240;i++){await sim(p,1);const s=await p.evaluate(id=>{for(const g of window.__vale.world().groups)for(const m of g.mobs)if(m.id===id)return m.state;},id);if(s==='windup')return true;}return false;};
const parryOnce=async(p,id)=>{if(!await watchWind(p,id))return;await sim(p,22);await key(p,'KeyQ',true);await sim(p,8);await key(p,'KeyQ',false);await sim(p,10);await p.evaluate(()=>window.__vale.heal());};
const rollOnce=async(p,id)=>{if(!await watchWind(p,id))return;await sim(p,19);await key(p,'KeyC',true);await sim(p,1);await key(p,'KeyC',false);await sim(p,14);await p.evaluate(()=>window.__vale.heal());};
const atHusks=async(p)=>{await p.evaluate(()=>window.__vale.warp(8,35));await sim(p,30);const g=await G(p,'d-dome');const t=g.mobs.find(m=>m.alive);await p.evaluate(()=>window.__vale.foeBulk(1000));await p.evaluate((x,z)=>window.__vale.warp(x,z-1.2),t.x,t.z);await sim(p,2);return t;};
// 1 · before the first seal: no button, parries give nothing
{const p=await page(SAVE({}));await sim(p,20);const t=await atHusks(p);await parryOnce(p,t.id);await parryOnce(p,t.id);const c=await p.evaluate(()=>window.__vale.combat().counts);const k=await K(p);
 ok('no seal yet: Kindle hidden; parries give no spark',!k.shown&&k.v===0&&c.parry>=1,{k,parries:c.parry});await p.close();}
// 2 · after the Forge Heart: button shows, parry +1, roll-through +½, spend → Temper (3 hard-staggering blows)
{const p=await page(SAVE({seals:{forge:true},xp:50}));await sim(p,20);const t=await atHusks(p);let k=await K(p);
 ok('after the first seal: Kindle shows, attuned to the Forge Heart (⚒), 3 empty pips',k.shown&&k.attuned==='forge'&&k.glyph==='⚒'&&k.pips==='···',k);
 for(let i=0;i<4&&(await K(p)).v<1;i++)await parryOnce(p,t.id);const k1=await K(p);const c1=await p.evaluate(()=>window.__vale.combat().counts);
 ok('a parry gathers a spark (+1)',k1.v>=1&&c1.parry>=1,{k1,parry:c1.parry});
 const v0=k1.v;for(let i=0;i<4&&(await K(p)).v===v0;i++)await rollOnce(p,t.id);const k2=await K(p);ok('rolling through a blow gathers half a spark',k2.v===v0+0.5,{before:v0,after:k2.v});
 const r=await p.evaluate(()=>window.__vale.kindleNow());const k3=await K(p);ok('kindle the Forge Heart: spends a spark, Temper = 3 blows',r&&k3.v===k2.v-1&&k3.temper===3,k3);
 let st=[];for(let i=0;i<3;i++){await key(p,'KeyK',true);await key(p,'KeyK',false);await sim(p,14);const g=await G(p,'d-dome');st.push(g.mobs.find(m=>m.id===t.id).state);}const k4=await K(p);
 ok('Tempered blows stagger and are used up',k4.temper===0&&st.includes('stagger'),{st,temper:k4.temper});
 await p.evaluate(()=>window.__vale.setKindle(0));const r0=await p.evaluate(()=>window.__vale.kindleNow());ok('no spark → refused, nothing spent',!r0&&(await K(p)).v===0,{});
 await p.close();}
// 3 · all seals, 3 sparks: Daybreak (reel within 6 m + 1 heart), Undertow (thrown back), Glare (front cone), re-attune with G
{const p=await page(SAVE({seals:ALL4,xp:200,kindle:3,attune:'dawn'}));await sim(p,20);const t=await atHusks(p);await p.evaluate(()=>window.__vale.wound(1));
 const hp0=(await W(p)).playerHp;await p.evaluate(()=>window.__vale.kindleNow());await sim(p,2);let g=await G(p,'d-dome');const hp1=(await W(p)).playerHp;
 ok('Daybreak: nearby foes reel and a heart mends',g.mobs.filter(m=>m.alive).every(m=>m.state==='stagger')&&hp1===hp0+1,{states:g.mobs.map(m=>m.state),hp0,hp1});
 await key(p,'KeyG',true);await key(p,'KeyG',false);await sim(p,2);let k=await K(p);ok('G re-attunes to the next claimed seal (dawn → sun)',k.attuned==='sun'&&k.glyph==='✹',k);
 await sim(p,45);const m0=(await G(p,'d-dome')).mobs.find(m=>m.id===t.id);const pose=await p.evaluate(()=>{const c=window.__vale.camInfo().st;return {x:c.px,z:c.pz};});
 await key(p,'KeyG',true);await key(p,'KeyG',false);await sim(p,1);k=await K(p);const d0=Math.hypot(m0.x-pose.x,m0.z-pose.z);await p.evaluate(()=>window.__vale.kindleNow());await sim(p,12);
 const m1=(await G(p,'d-dome')).mobs.find(m=>m.id===t.id);const d1=Math.hypot(m1.x-pose.x,m1.z-pose.z);ok('Undertow: foes thrown back (farther) and reeling',k.attuned==='tide'&&d1>d0+0.8&&m1.state==='stagger',{attuned:k.attuned,d0:+d0.toFixed(2),d1:+d1.toFixed(2),state:m1.state});
 const ks=await K(p);ok('kindle stats recorded per seal; sparks spent 3 → 1',ks.v===1&&ks.kstat.dawn===1&&ks.kstat.tide===1,ks);await p.close();}
{const p=await page(SAVE({seals:ALL4,xp:200,kindle:2,attune:'sun'}));await sim(p,20);const t=await atHusks(p);let tries=0,ok1=false,info=null;
 for(;tries<4&&!ok1;tries++){if(!await watchWind(p,t.id))break;await sim(p,8);await p.evaluate(()=>window.__vale.kindleNow());await sim(p,2);const m=(await G(p,'d-dome')).mobs.find(m=>m.id===t.id);info=m.state;ok1=m.state==='stagger';await p.evaluate(()=>window.__vale.setKindle(2));}
 ok('Glare: a foe in front loses its wind-up and reels',ok1,{info,tries});await p.close();}
// 4 · layout: the Kindle button stays clear of every other control (portrait 360×740, 412×915; landscape 915×412)
for(const vp of [{width:360,height:740},{width:412,height:915},{width:915,height:412}]){const p=await page(SAVE({seals:{forge:true},xp:50,kindle:1}),'&tod=0.42',vp);await sim(p,20);await atHusks(p);await sim(p,10);
 const L=await p.evaluate(()=>{const r=id=>{const e=document.getElementById(id);if(!e||e.hidden)return null;const b=e.getBoundingClientRect();return b.width?{id,x:b.left,y:b.top,w:b.width,h:b.height}:null;};return {kin:r('b-kin'),others:['b-atk','b-hvy','b-blk','b-dge','b-jmp','b-wpn','stam','joy','b-menu','quest','wind'].map(r).filter(Boolean),vw:innerWidth,vh:innerHeight};});
 const ov=L.kin?L.others.filter(o=>!(o.x>=L.kin.x+L.kin.w||o.x+o.w<=L.kin.x||o.y>=L.kin.y+L.kin.h||o.y+o.h<=L.kin.y)).map(o=>o.id):['missing'];
 const inView=L.kin&&L.kin.x>=0&&L.kin.y>=0&&L.kin.x+L.kin.w<=L.vw&&L.kin.y+L.kin.h<=L.vh;
 ok(`layout ${vp.width}×${vp.height}: Kindle (≥44 px) on screen, overlaps no control`,!!L.kin&&ov.length===0&&inView&&L.kin.w>=44,{kin:L.kin,ov});
 if(vp.width===412)await p.screenshot({path:'/workspace/vale3d-m64/shots/m64/m64c-kindle-hud.png'});await p.close();}
// 5 · saves: M54-era and M63 saves load (no field → 0, sparks start once a seal is held); bad values clamp; round-trip
{const m54={v:1,started:true,done:false,xp:120,seals:{dawn:true,forge:true},runes:[0,0,0],wind:false,warden:false,mirrors:[0,0,0,0],beacon:false,echo:false,charted:[false,false,false,false,false,false,false],cave:0,coast:0,sea:0,lamp:0};
 let p=await page(JSON.stringify(m54));await sim(p,20);let s=await p.evaluate(()=>window.__vale.quest().save);let k=await K(p);
 ok('M54-era save (no weapons/kindle fields): loads, sparks 0, attuned to the first claimed seal (dawn)',s.xp===120&&s.seals.dawn&&k.v===0&&k.attuned==='dawn',{xp:s.xp,k});await p.close();
 const m63=JSON.parse(SAVE({xp:150,seals:{forge:true,sun:true,dawn:true},whet:2,day:4,rk:{'g-tide':4}}));p=await page(JSON.stringify(m63));await sim(p,20);k=await K(p);s=await p.evaluate(()=>window.__vale.quest().save);
 ok('M63 save: loads with progress intact, sparks 0',s.xp===150&&s.whet===2&&s.rk['g-tide']===4&&k.v===0,{k});await p.evaluate(()=>window.__vale.setKindle(2.5));await p.evaluate(()=>{dispatchEvent(new KeyboardEvent('keydown',{code:'KeyG'}));});await sim(p,5);
 const raw=JSON.parse(await p.evaluate(()=>localStorage.getItem('vale3d-save')));await p.reload({waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sim(p,10);k=await K(p);
 ok('round-trip: sparks and attunement survive a reload',raw.kindle===2.5&&k.v===2.5&&k.attuned===raw.attune&&!!raw.attune,{raw:{kindle:raw.kindle,attune:raw.attune},k});await p.close();
 p=await page(JSON.stringify({...m63,kindle:99,attune:'moon',perks:['x',3],relics:'no'}));await sim(p,10);s=await p.evaluate(()=>window.__vale.quest().save);
 ok('bad values clamp/drop: kindle 99 → 4, unknown attune dropped, bad lists dropped/filtered (unknown perk ids dropped since M64F)',s.kindle===4&&s.attune===undefined&&JSON.stringify(s.perks)==='[]'&&s.relics===undefined,{kindle:s.kindle,attune:s.attune,perks:s.perks,relics:s.relics});await p.close();}
ok('no page errors',errs.length===0,errs.slice(0,3));
R.fails=fails;R.total=n;console.log(fails?`M64C-KINDLE FAIL ${fails}/${n}`:`M64C-KINDLE PASS ${n}/${n}`);if(process.env.OUT)fs.writeFileSync(process.env.OUT,JSON.stringify(R,null,1));await b.close();process.exit(fails?1:0);})().catch(e=>{console.error('ERR',e.message);process.exit(2);});
