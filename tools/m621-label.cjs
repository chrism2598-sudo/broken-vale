// M62.1 · targeted check: the Journal names the Wind Shrine as needed for the Beacon, and no Journal line calls it optional.
// Other Journal "(optional)" headings (Warden, Echo Grove, keeps) are unchanged. PORT=8099 [DIST=dist] node tools/m621-label.cjs
const pc=require(process.env.PUPPETEER_CORE);const fs=require('fs');const sleep=ms=>new Promise(r=>setTimeout(r,ms));const PORT=process.env.PORT||'8099';
let fails=0;const ok=(n,c,d)=>{console.log((c?'PASS ':'FAIL ')+n+(d?' '+JSON.stringify(d):''));if(!c)fails++;};
const SAVE=(o={})=>JSON.stringify({v:1,started:true,done:false,xp:0,seals:{},runes:[0,0,0],wind:false,warden:false,mirrors:[0,0,0,0],beacon:false,echo:false,charted:[false,false,false,false,false,false,false],cave:0,coast:0,sea:0,lamp:0,weapons:['rusty'],weapon:'rusty',...o});
// bundle-level: the old literal is gone, the new one is present (prod + diag)
const D=process.env.DIST||'dist';for(const dir of [D+'/assets',D+'/diag/assets']){const f=fs.readdirSync(dir).find(x=>/^index-.*\.js$/.test(x));const s=fs.readFileSync(dir+'/'+f,'utf8');
  ok(`${dir}/${f}: new label present, old label absent`,s.includes('Wind Shrine (needed for the Beacon)')&&!s.includes('Wind Shrine (optional)'));}
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:600000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const errs=[];
const ALL4={dawn:true,sun:true,tide:true,forge:true};
for(const [name,o] of [['fresh quest, 0 seals',{}],['2 seals',{seals:{dawn:true,forge:true},xp:100}],['all seals, Chapter I done, shrine unsolved',{seals:ALL4,done:true,xp:280}],['shrine solved',{seals:ALL4,done:true,wind:true,xp:315}]]){
  const p=await b.newPage();await p.setViewport({width:412,height:915,isMobile:true,hasTouch:true});p.on('pageerror',e=>errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?q=lite&qa=1`,{waitUntil:'load'});
  await p.evaluate((s)=>{localStorage.clear();localStorage.setItem('vale3d-hero',JSON.stringify({name:'Ilka',sex:'female'}));localStorage.setItem('vale3d-coach',JSON.stringify({done:['move','talk','seal','attack','dodge','rolled','parry','parried','stamina','hurt','claim','pick']}));localStorage.setItem('vale3d-save',s);},SAVE(o));
  await p.reload({waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(600);
  await p.keyboard.press('KeyJ');await sleep(500);const sh=await p.evaluate(()=>window.__vale.sheets());const t=(sh.journalText||'').toLowerCase(); // headings are CSS text-transform: uppercase in innerText
  const lines=t.split('\n').filter(l=>/wind shrine/.test(l));
  ok(`${name}: Journal open`,!!sh.journal);
  ok(`${name}: heading "Wind Shrine (needed for the Beacon)"`,t.includes('wind shrine (needed for the beacon)'),{lines});
  ok(`${name}: no Journal line calls the Wind Shrine optional`,!lines.some(l=>/optional/i.test(l))&&!/Wind Shrine \(optional\)/i.test(t),{lines});
  ok(`${name}: other optional headings unchanged`,/vale warden \(optional\)/.test(t)&&/echo grove \(optional\)/.test(t)&&/the keeps \(optional\)/.test(t));
  await p.close();}
ok('no page errors',errs.length===0,errs.slice(0,3));
console.log(fails?`M621-LABEL FAIL ${fails}`:'M621-LABEL PASS');await b.close();process.exit(fails?1:0);})().catch(e=>{console.error('ERR',e.message);process.exit(2);});
