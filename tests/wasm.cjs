const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
(async()=>{
 const {instance}=await WebAssembly.instantiate(fs.readFileSync('web/gather_core.wasm'),{}),w=instance.exports;
 const call=(command,state=null,rev=state?.revision??null)=>{
  const b=Buffer.from(JSON.stringify({state,expected_revision:rev,command}));const ptr=w.input_buffer(b.length);assert(ptr);new Uint8Array(w.memory.buffer,ptr,b.length).set(b);w.execute_request();return JSON.parse(Buffer.from(w.memory.buffer,w.output_buffer(),w.output_len()).toString());
 };
 let checks=0;const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
 let s=call({op:'sample'}).data.state;
 test('sample passes real WASM validation',()=>assert(call({op:'validate'},s).ok));
 test('sample has exact native oracle statuses',()=>assert.deepEqual(s.items.map(i=>i.status),['accepted','accepted','submitted','changes_requested','missing']));
 test('partial export has only two accepted byte-verified files',()=>{const p=call({op:'export',include_files:true},s).data.export;assert.equal(p.complete,false);assert.equal(p.files.length,2);for(const f of p.files){const b=Buffer.from(f.content_base64,'base64');assert.equal(crypto.createHash('sha256').update(b).digest('hex'),f.sha256);assert.equal(b.length,f.bytes);}});
 test('stale revision fails',()=>assert(!call({op:'accept',item_id:3,version:1},s,s.revision-1).ok));
 test('missing feedback fails',()=>assert(!call({op:'request_changes',item_id:3,version:1,feedback:' '},s).ok));
 test('accepted file replacement fails',()=>assert(!call({op:'submit',item_id:1,name:'new.txt',content:Buffer.from('new').toString('base64')},s).ok));
 test('nonexistent item fails',()=>assert(!call({op:'accept',item_id:999,version:1},s).ok));
 test('accept succeeds only once',()=>{s=call({op:'accept',item_id:3,version:1},s).data.state;assert(!call({op:'accept',item_id:3,version:1},s).ok);});
 test('revision invalidates acceptance',()=>{s=call({op:'request_changes',item_id:1,version:1,feedback:'Revise colours'},s).data.state;assert.equal(call({op:'export',include_files:false},s).data.export.accepted_count,2);});
 test('resubmission increments version and rejects prior review',()=>{s=call({op:'submit',item_id:1,name:'revised.txt',content:Buffer.from('Rev 2').toString('base64')},s).data.state;assert.equal(s.items[0].version,2);assert(!call({op:'accept',item_id:1,version:1},s).ok);s=call({op:'accept',item_id:1,version:2},s).data.state;});
 test('malformed dangerous names and bytes fail',()=>{for(const [name,content]of [['../evil.txt','a'],['.hidden.txt','a'],['a.svg','<svg/>'],['x.json','{notjson'],['x.txt','\0']]){assert(!call({op:'submit',item_id:5,name,content:Buffer.from(content).toString('base64')},s).ok,name);}});
 test('tampered manifest is rejected',()=>{const c=structuredClone(s);c.items[0].file.size++;assert(!call({op:'validate'},c).ok);});
 test('unknown request fields rejected',()=>assert(!call({op:'sample',anything:true}).ok));
 test('2 MiB boundary and aggregate limits through WASM',()=>{let p=call({op:'create',project_id:'limit-test',title:'Limits',client:'Demo',requirements:Array.from({length:4},(_,i)=>({title:`Item ${i}`,instructions:'Text only',formats:['txt']}))}).data.state;const data=Buffer.alloc(2*1024*1024,65).toString('base64');for(let i=1;i<=3;i++){const r=call({op:'submit',item_id:i,name:'at-limit.txt',content:data},p);assert(r.ok,r.error);p=r.data.state;}assert(!call({op:'submit',item_id:4,name:'over.txt',content:'YQ=='},p).ok);assert(!call({op:'submit',item_id:4,name:'over.txt',content:Buffer.alloc(2*1024*1024+1,65).toString('base64')},p).ok);});
 test('oversized ABI rejects allocation and cannot replay prior input',()=>{assert.equal(w.input_buffer(12*1024*1024+1),0);w.execute_request();const r=JSON.parse(Buffer.from(w.memory.buffer,w.output_buffer(),w.output_len()).toString());assert.equal(r.ok,false);});
 test('subsequent small request survives memory growth',()=>assert.equal(call({op:'sample'}).data.state.items.length,5));
 test('bounded malformed UTF8 inputs never trap',()=>{for(let n=0;n<100;n++){const b=crypto.randomBytes(n*3+1),ptr=w.input_buffer(b.length);new Uint8Array(w.memory.buffer,ptr,b.length).set(b);w.execute_request();const r=JSON.parse(Buffer.from(w.memory.buffer,w.output_buffer(),w.output_len()).toString());assert.equal(r.ok,false);}});
 console.log(`${checks} WASM integration checks passed.`);
})().catch(e=>{console.error(e);process.exit(1)});
