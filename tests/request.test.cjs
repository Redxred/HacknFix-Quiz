const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function network(fetch){
  const context={window:{},fetch,AbortController,Response,setTimeout,clearTimeout};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../request.js'),'utf8'),context);
  return context.window.HNFNetwork.fetch;
}
const aborted=signal=>new Promise((resolve,reject)=>{
  if(signal.aborted)reject(signal.reason);
  else signal.addEventListener('abort',()=>reject(signal.reason),{once:true});
});
test('API timeout releases a connection stalled before headers without retrying a write',async()=>{
  let calls=0;const fetch=network((url,{signal})=>{calls++;return aborted(signal);});
  await assert.rejects(fetch('/write',{method:'POST'},30),/connection timed out/);
  assert.equal(calls,1);
});
test('API timeout also bounds a stalled response body',async()=>{
  const fetch=network(async(url,{signal})=>({arrayBuffer:()=>aborted(signal)}));
  await assert.rejects(fetch('/read',{},30),/connection timed out/);
});
test('API caller cancellation remains cancellation',async()=>{
  const controller=new AbortController(),fetch=network((url,{signal})=>aborted(signal));
  const result=fetch('/read',{signal:controller.signal},1000);
  controller.abort(new Error('User cancelled'));
  await assert.rejects(result,/User cancelled/);
});
test('API preserves JSON, errors and empty 204 responses',async()=>{
  const json=network(async()=>new Response('{"ok":true}',{status:200,headers:{'content-type':'application/json'}}));
  const result=await json('/read');assert.deepEqual(await result.json(),{ok:true});
  assert.equal(result.headers.get('content-type'),'application/json');
  assert.equal((await network(async()=>new Response(null,{status:204}))('/delete')).status,204);
  const error=await network(async()=>new Response('Denied',{status:403}))('/read');
  assert.equal(error.status,403);assert.equal(await error.text(),'Denied');
});
