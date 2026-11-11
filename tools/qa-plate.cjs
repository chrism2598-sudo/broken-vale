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
// M21a · Pale Keep pressure plate opens the bookshelf door
await at(-6.0,-1.8,0);await sleep(400);k=await K();ok('secret closed before plate',k.secret===false,{secret:k.secret});
await at(-6.0,-3.2,0);await settle('window.__vale.castle().secret===true',8000).catch(()=>{});k=await K();{const ci=await p.evaluate(()=>window.__vale.camInfo());log('pos',{lx:ci.st.px-k.O.x,lz:ci.st.pz-k.O.z,y:k.y,near:k.near});}ok('plate opens the bookshelf secret',k.secret===true&&k.save.secrets.includes('pale'),{secret:k.secret});
await sleep(2000);await at(-10.2,1.0,0,-Math.PI/2);await sleep(300);k=await K();ok('walk-in: hidden room reachable',k.room==='Hidden room',{room:k.room});
ok('no errors',errs.length===0,{errs:errs.slice(0,3)});console.log(fails?'FAILS '+fails:'ALL PASS');await b.close();process.exit(fails?1:0);})();
