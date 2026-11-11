// M20a QA: keep interiors — enter by the door, walk rooms, ramp to the gallery, climb the tower to the lookout (perch), battlements walk,
// chests (XP, whetstone, new weapons), lore pages + Journal, secret rooms (Pale hearth, Azure tapestry), Hollow Sentinels (hit player, beatable),
// persistence across reload, leaving by the door. Uses deterministic sim() stepping for movement.
const pc=require(process.env.PUPPETEER_CORE);const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:900000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage();await p.setViewport({width:412,height:860,isMobile:true,hasTouch:true});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
const log=(k,v)=>console.log(k,JSON.stringify(v));let fails=0;const ok=(name,c,v)=>{if(!c)fails++;log((c?'PASS ':'FAIL ')+name,v);};
const K=()=>p.evaluate(()=>window.__vale.castle());const Q=()=>p.evaluate(()=>window.__vale.quest());const C=()=>p.evaluate(()=>window.__vale.combat());
const ready=()=>p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});
const at=(x,z,y,f=Math.PI)=>p.evaluate((x,z,y,f)=>window.__vale.castleAt(x,z,y,f),x,z,y,f);
const walk=(sx,sy,n)=>p.evaluate((sx,sy,n)=>{window.__vale.sim(Array(n).fill(1/30),sx,sy);},sx,sy,n);
const act=async()=>{await p.evaluate(()=>window.__vale.interact());};
const settle=async(fn,ms=60000)=>{await p.waitForFunction(fn,{timeout:ms,polling:200});};
await p.goto('http://localhost:8090/?q=lite&qa=1',{waitUntil:'load'});
await p.evaluate(()=>{localStorage.setItem('vale3d-hero',JSON.stringify({name:'Ilka',sex:'female'}));localStorage.setItem('vale3d-save',JSON.stringify({v:1,started:true,done:false,xp:0,seals:{},runes:[0,0,0],wind:false,warden:false,mirrors:[0,0,0,0],beacon:false,echo:false,charted:[false,false,false,false,false,false,false],cave:0,coast:0,sea:0,lamp:0}));});
await p.reload({waitUntil:'load'});await ready();await sleep(1500);
// 1 · the door
let k=await K();const door=k.doors.find(d=>d.id==='pale');
await p.evaluate((x,z)=>window.__vale.warp(x,z),door.x+0.1,door.z+0.1);await sleep(300);
let q=await Q();ok('keep door offers Enter',/Enter Pale Keep/.test(q.near||''),{near:q.near});
await act();await settle('window.__vale.castle().inCastle&&!window.__vale.castle().fading');k=await K();
ok('inside Pale Keep entry hall',k.id==='pale'&&k.room==='Entry hall'&&k.y===0,{room:k.room,y:k.y});
// 2 · walk north through the arch into the great hall
await at(0,7,0);await walk(0,-1,40);k=await K();ok('walk entry → great hall',k.room==='Great hall',{room:k.room});
// 3 · walls hold
await at(0,2.5,0);await walk(-1,0,80);let ci=await p.evaluate(()=>window.__vale.camInfo());const lx=ci.st.px-k.O.x;ok('west wall/hearth blocks',lx>-8.7,{lx});
// 4 · ramp to the gallery
await at(7.7,2.0,0);await walk(0,-1,75);k=await K();ok('ramp climbs to the gallery (y 4.5)',Math.abs(k.y-4.5)<0.05,{y:k.y,room:k.room});
await walk(0,1,8);k=await K();ok('no falling off the gallery edge',Math.abs(k.y-4.5)<0.6,{y:k.y});
// 5 · gallery → solar
await at(-5,-8.6,4.5);await walk(0,-1,40);k=await K();ok('gallery → solar',k.room==='Solar'&&Math.abs(k.y-4.5)<0.05,{room:k.room,y:k.y});
// 6 · climb the tower: six flights round the shaft
await at(5.2,-9.4,4.5);await walk(0,-1,20);k=await K();ok('into the tower shaft',k.room==='Tower',{room:k.room});
await at(8.1,-11.0,4.5);const legs=[[0,-1],[-1,0],[0,1],[1,0],[0,-1],[-1,0]];const ys=[];for(const [sx,sy] of legs){await walk(sx,sy,48);ys.push((await K()).y);}
k=await K();ok('climb six flights to the top landing (y 14.1)',Math.abs(k.y-14.1)<0.05&&/lookout/.test(k.near||''),{ys,near:k.near});
// 7 · lookout perch
let xp0=(await Q()).save.xp;const fog0=(await p.evaluate(()=>window.__vale.fog())).explored;
await act();await settle('!!window.__vale.castle().perch&&!window.__vale.castle().fading');k=await K();q=await Q();const fog1=(await p.evaluate(()=>window.__vale.fog())).explored;
ok('lookout perch on the crown tower',k.perch&&k.perch.kind==='top'&&k.perch.y>25&&q.save.xp===xp0+15&&fog1>fog0,{perch:k.perch,xp:q.save.xp-xp0,fog0,fog1});
await walk(0,-1,90);ci=await p.evaluate(()=>window.__vale.camInfo());let L=await p.evaluate((x,z)=>window.__vale.kLocal(x,z),ci.st.px,ci.st.pz);ok('lookout parapet holds',Math.hypot(L.u,L.v)<4.1&&Math.abs(ci.player[1]-k.perch.y)<0.01,{r:Math.hypot(L.u,L.v)});
await p.evaluate(()=>window.__vale.perchAt(0,0.3));await sleep(200);k=await K();ok('lookout offers the way down',/Down the tower/.test(k.near||''),{near:k.near});
await act();await settle('window.__vale.castle().inCastle&&!window.__vale.castle().fading');k=await K();ok('back down into the tower top',Math.abs(k.y-14.1)<0.05&&k.room==='Tower',{y:k.y,room:k.room});
// 8 · battlements
await at(-7.4,-8.25,4.5);k=await K();ok('gallery door offers battlements',/battlements/.test(k.near||''),{near:k.near});
await act();await settle('!!window.__vale.castle().perch&&!window.__vale.castle().fading');k=await K();ok('on the keep roof',k.perch&&k.perch.kind==='roof',{perch:k.perch});
await walk(1,0,120);ci=await p.evaluate(()=>window.__vale.camInfo());L=await p.evaluate((x,z)=>window.__vale.kLocal(x,z),ci.st.px,ci.st.pz);ok('roof walk stays on the roof, off the tower',Math.hypot(L.u,L.v)>5&&Math.abs(L.u)<6.7&&Math.abs(L.v)<6.1,{u:L.u,v:L.v});
await p.evaluate(()=>window.__vale.perchAt(0,5.6));await sleep(200);k=await K();ok('roof offers way back in',/Back inside/.test(k.near||''),{near:k.near});
await act();await settle('window.__vale.castle().inCastle&&!window.__vale.castle().fading');k=await K();ok('back on the gallery',Math.abs(k.y-4.5)<0.05,{y:k.y});
// 9 · lectern lore + library chest
await at(7.2,7.1,0);k=await K();ok('lectern',/ledger/.test(k.near||''),{near:k.near});await act();await sleep(300);q=await Q();ok('lore dialog + saved',q.talking&&/soot-black stone/.test(q.dlg)&&q.save.lore.includes('pale-ledger'),{dlg:q.dlg.slice(0,60)});
while((await Q()).talking){await p.evaluate(()=>window.__vale.advance());await sleep(120);}
xp0=(await Q()).save.xp;await at(8.65,5.0,0);k=await K();ok('library chest offered',/Open the chest/.test(k.near||''),{near:k.near});await act();await sleep(300);q=await Q();
ok('library chest: +20 XP, saved',q.save.xp===xp0+20&&q.save.chests.includes('pale-library'),{dxp:q.save.xp-xp0});k=await K();ok('opened chest no longer offered',!/Open the chest/.test(k.near||''),{near:k.near});
// 10 · chapel chest → whetstone (kill the chapel sentinel first so it doesn't interfere: done in 11)
// 11 · Sentinel fights
await at(-5.4,7.0,0,-Math.PI/2);await settle(`(()=>{const c=window.__vale.castle();return c.playerHp<3||c.mobs.find(m=>m.id==='pale-chapel').state==='windup'})()`,120000);
await settle(`window.__vale.castle().playerHp<3`,120000).catch(()=>{});k=await K();ok('sentinel notices and strikes',k.playerHp<3,{hp:k.playerHp,m:k.mobs});
let tries=0;for(;tries<40;tries++){k=await K();const m=k.mobs.find(x=>x.id==='pale-chapel');if(!m.alive)break;if(k.playerHp<=1){await p.evaluate(()=>window.__vale.castleAt(-5.4,7.0,0,-Math.PI/2));}
 await p.evaluate(()=>{const v=window.__vale;const c=v.castle();const m=c.mobs.find(x=>x.id==='pale-chapel');const ci=v.camInfo();v.castleAt(m.x-c.O.x+1.5,m.z-c.O.z,0,-Math.PI/2);});
 await p.keyboard.press('KeyK');await settle(`!window.__vale.combat().act`,30000).catch(()=>{});}
k=await K();q=await Q();ok('chapel sentinel beaten with K',!k.mobs.find(x=>x.id==='pale-chapel').alive&&q.save.foes.includes('pale-chapel'),{tries,hp:k.playerHp});
xp0=q.save.xp;await at(-10.3,8.35,0,Math.PI);await act();await sleep(300);q=await Q();ok('chapel chest: whetstone + lore page',q.save.whet===1&&q.save.chests.includes('pale-chapel')&&q.save.xp===xp0+15,{whet:q.save.whet});
await settle(`window.__vale.quest().save.lore.includes('pale-chapel')`,30000).catch(()=>{});q=await Q();ok('chest lore page into Journal',q.save.lore.includes('pale-chapel'),{lore:q.save.lore});
// 12 · secret behind the hearth
await at(-8.0,0.4,0,-Math.PI/2);k=await K();ok('hearth clue offered',/soot-black stone/.test(k.near||''),{near:k.near});await act();await sleep(300);k=await K();ok('secret opens',k.secret===true&&k.save.secrets.includes('pale'),{secret:k.secret});
await at(-8.2,1.0,0);await walk(-1,0,40);k=await K();ok('walk into the hidden room',k.room==='Hidden room',{room:k.room});
await at(-13.25,0.8,0,-Math.PI/2);await act();await settle(`window.__vale.combat().owned.includes('knight')`,30000).catch(()=>{});let c=await C();ok('secret chest → Knight’s Longsword',c.owned.includes('knight')&&c.weapon==='knight',{owned:c.owned,weapon:c.weapon});
// 13 · hall sentinel (with the longsword + whetstone)
tries=0;for(;tries<40;tries++){k=await K();const m=k.mobs.find(x=>x.id==='pale-hall');if(!m.alive)break;
 await p.evaluate(()=>{const v=window.__vale;const c=v.castle();const m=c.mobs.find(x=>x.id==='pale-hall');v.castleAt(m.x-c.O.x,m.z-c.O.z+1.5,0,Math.PI);});
 await p.keyboard.press('KeyK');await settle(`!window.__vale.combat().act`,30000).catch(()=>{});}
k=await K();ok('hall sentinel beaten',!k.mobs.find(x=>x.id==='pale-hall').alive,{tries});
// 14 · Journal shows keeps + lore
await p.keyboard.press('KeyJ');await sleep(500);const jt=await p.evaluate(()=>window.__vale.sheets().journalText);await p.keyboard.press('Escape');await sleep(300);
ok('Journal: keeps + lore pages',/Pale Keep — chests 3\/4 · secret room found · lookout climbed/i.test(jt)&&/Lore pages · 2\//i.test(jt)&&/Steward/i.test(jt),{j:(jt.match(/keeps[\s\S]{0,240}/i)||[jt.slice(0,300)])[0]});
// 15 · leave by the door
await at(0,8.8,0);k=await K();ok('exit offered',/Leave Pale Keep/.test(k.near||''),{near:k.near});await act();await settle('!window.__vale.castle().inCastle&&!window.__vale.castle().fading');
ci=await p.evaluate(()=>window.__vale.camInfo());ok('back outside by the keep door',Math.hypot(ci.st.px-door.x,ci.st.pz-door.z)<3&&!(await K()).perch,{d:Math.hypot(ci.st.px-door.x,ci.st.pz-door.z)});
// 16 · persistence
await p.reload({waitUntil:'load'});await ready();await sleep(1200);await p.evaluate(()=>window.__vale.enterCastle('pale'));k=await K();
ok('reload: secret open, foes stay down, chests stay open',k.secret===true&&k.mobs.every(m=>!m.alive)&&k.save.chests.length===3,{k:k.save});
c=await C();ok('reload: longsword kept',c.owned.includes('knight'),{owned:c.owned});
// 17 · Azure Keep: tapestry secret → halberd
await p.evaluate(()=>window.__vale.enterCastle('azure'));k=await K();ok('Azure Keep interior',k.id==='azure'&&k.room==='Entry hall',{id:k.id,room:k.room});
await at(-8.0,-12.2,4.5,-Math.PI/2);k=await K();ok('tapestry clue offered',/tapestry/i.test(k.near||''),{near:k.near});await act();await sleep(200);
await at(-8.2,-12.2,4.5);await walk(-1,0,40);k=await K();ok('into the azure hidden room',k.room==='Hidden room'&&Math.abs(k.y-4.5)<0.05,{room:k.room});
await at(-13.25,-13.5,4.5,-Math.PI/2);await act();await settle(`window.__vale.combat().owned.includes('halberd')`,30000).catch(()=>{});c=await C();ok('secret chest → Azure Halberd',c.owned.includes('halberd'),{owned:c.owned});
ok('no page errors',errs.length===0,errs.slice(0,5));
console.log(fails?`QA-CASTLE FAIL ${fails}`:'QA-CASTLE PASS');await b.close();process.exit(fails?1:0);})().catch(e=>{console.log('QA-CASTLE ERROR',e.message);process.exit(2);});
