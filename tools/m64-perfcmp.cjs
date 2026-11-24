// M64H · perf comparison M63 (logs/m63/final) vs M64 RC (logs/m64/RC): drawcalls audit (m39-audit, computed by the renderer),
// perfrun headless estimates (swiftshader on a shared box: indicative only). Usage: node tools/m64-perfcmp.cjs [rcLabel]
const fs=require('fs');const A='/workspace/vale3d/logs/m63/final',B='/workspace/vale3d/logs/m64/'+(process.argv[2]||'RC');
const dc=f=>{const o={};if(!fs.existsSync(f))return o;for(const l of fs.readFileSync(f,'utf8').split('\n')){const m=l.match(/^([\w\- ·()]+?) (\{"calls":\d+.*?\})/);if(m){try{o[m[1].trim()]=JSON.parse(m[2]);}catch{}}}return o;};
const a=dc(A+'/gate-drawcalls.log'),b=dc(B+'/gate-drawcalls.log');const out=['### Draw calls / triangles per view (m39-audit, lite) · M63 → M64','| view | calls M63 → M64 | tris M63 → M64 |','|---|---|---|'];
for(const k of Object.keys({...a,...b}))out.push(`| ${k} | ${a[k]?.calls??'–'} → ${b[k]?.calls??'–'} | ${a[k]?.tris??'–'} → ${b[k]?.tris??'–'} |`);
const pr=f=>fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')):[];const pa=pr(A+'/gate-perfrun.json'),pb=pr(B+'/gate-perfrun.json');
out.push('','### perfrun (HEADLESS ESTIMATE, swiftshader, 412×915 lite) · M63 → M64','| scene | fps avg | frame ms p50 | p95 | draws avg / max | tris avg | heap MB | ready s |','|---|---|---|---|---|---|---|---|');
for(const x of pa){const y=pb.find(z=>z.scene===x.scene&&z.quality===x.quality)||{};const f=(p,q)=>`${p??'–'} → ${q??'–'}`;
 out.push(`| ${x.scene} | ${f(x.fpsAvg,y.fpsAvg)} | ${f(x.frameMs?.p50,y.frameMs?.p50)} | ${f(x.frameMs?.p95,y.frameMs?.p95)} | ${f(x.drawCalls?.avg+'/'+x.drawCalls?.max,y.drawCalls?y.drawCalls.avg+'/'+y.drawCalls.max:null)} | ${f(x.triangles?.avg,y.triangles?.avg)} | ${f(x.jsHeapMB,y.jsHeapMB)} | ${f(x.load?.readyS,y.load?.readyS)} |`);}
console.log(out.join('\n'));
