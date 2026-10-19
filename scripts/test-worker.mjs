import assert from 'node:assert/strict';
import worker,{target,seal,unseal,TOOLS} from '../worker/index.js';
const blobs=new Map();let calls=[];
const env={PUBLIC_ORIGIN:'https://bridge.example.org',CREDENTIAL_ENCRYPTION_KEY:'ab'.repeat(32),BUCKET:{async get(k){return blobs.has(k)?{text:async()=>blobs.get(k)}:null},async put(k,v){blobs.set(k,v)},async delete(k){blobs.delete(k)}},UPSTREAM_FETCH:async(url,init)=>{assert.equal(new URL(url).origin,'https://plexus.example.org');assert.equal(init.headers['x-admin-key'],'test-secret');assert.equal(init.redirect,'manual');const m=JSON.parse(init.body);calls.push(m);return Response.json({jsonrpc:'2.0',id:m.id,result:m.method==='tools/list'?{tools:[{name:'plexus_config'}]}:m.method==='tools/call'?{content:[{type:'text',text:'test-secret masked'}]}:{protocolVersion:'2025-03-26'}})}};
const request=(path,options={})=>new Request('https://worker.internal'+path,options);
async function formToken(user){const r=await worker.fetch(request('/',{headers:{'oai-authenticated-user-id':user}}),env);assert.equal(r.status,200);const html=await r.text();const match=html.match(/name="csrf" value="([^"]+)"/);assert(match);return match[1].replaceAll('&quot;','"').replaceAll('&amp;','&').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>');}
async function post(user,origin,csrf,path='/configure'){const headers={'oai-authenticated-user-id':user,'Content-Type':'application/x-www-form-urlencoded'};if(origin!==undefined)headers.Origin=origin;return worker.fetch(request(path,{method:'POST',headers,body:new URLSearchParams({base:'https://plexus.example.org',key:'test-secret',...(csrf?{csrf}: {})})}),env);}
let r=await worker.fetch(request('/configure',{method:'POST'}),env);assert.equal(r.status,401);
const aToken=await formToken('a');
assert.equal((await post('a','https://attacker.org',aToken)).status,403);
assert.equal((await post('a','null',null)).status,403);
assert.equal((await post('a','null','corrupt')).status,403);
assert.equal((await post('b','null',aToken)).status,403);
const expired=await seal(env,'a',{purpose:'csrf',issued:Date.now()-1800001,nonce:'x'});assert.equal((await post('a','null',expired)).status,403);
const future=await seal(env,'a',{purpose:'csrf',issued:Date.now()+60000,nonce:'x'});assert.equal((await post('a','null',future)).status,403);
r=await post('a','null',aToken);assert.equal(r.status,303);assert.equal(r.headers.get('Location'),'https://bridge.example.org/?saved=1');assert.equal(blobs.size,1);assert(![...blobs.values()][0].includes('test-secret'));
assert.equal((await post('a',undefined,await formToken('a'))).status,303);
assert.equal((await post('a','https://bridge.example.org',await formToken('a'))).status,303);
const payload=await seal(env,'a',{key:'secret'});await assert.rejects(()=>unseal(env,'b',payload));
async function call(user,name,args={}){return worker.fetch(request('/mcp',{method:'POST',headers:{'oai-authenticated-user-id':user,'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})}),env)}
const prior=calls.length;r=await call('b','plexus_config',{operation:'status'});assert((await r.json()).result.isError);assert.equal(calls.length,prior);
r=await call('a','plexus_config',{operation:'status'});let result=await r.text();assert(!result.includes('test-secret'));assert(result.includes('[REDACTED]'));assert.equal(calls.at(-1).params.arguments.redact,true);
r=await call('a','plexus_config',{operation:'status',redact:false});assert((await r.json()).result.isError);
r=await worker.fetch(request('/',{headers:{'oai-authenticated-user-id':'a'}}),env);const html=await r.text();assert.equal((html.match(/name="csrf"/g)||[]).length,2);
assert.equal((await post('a','null',null,'/disconnect')).status,403);assert.equal(blobs.size,1);
assert.equal((await post('a','null',await formToken('a'),'/disconnect')).status,303);assert.equal(blobs.size,0);
for(const s of ['http://example.org','https://a:b@example.org','https://127.0.0.1','https://localhost','https://example.org/?key=x'])assert.throws(()=>target(s));
assert.equal(TOOLS.length,14);
console.log('PASS: authenticated setup, null/missing/public Origin with valid token, cross-user/tampered/expired/missing token rejection, hostile origin rejection, disconnect protection, encrypted storage, isolation, forwarding, redaction, public redirects and catalog');

const setupResponse=await worker.fetch(request('/',{headers:{'oai-authenticated-user-id':'a'}}),env);
const csp=setupResponse.headers.get('Content-Security-Policy');
assert(!csp.includes('default-src')&&!csp.includes('script-src')&&!csp.includes('frame-ancestors'));
assert(csp.includes("object-src 'none'"));
console.log('PASS: page CSP leaves platform-injected scripts and hosting frame policy intact');

let redirectCalls=0;
const redirectEnv={...env,UPSTREAM_FETCH:async(url,init)=>{redirectCalls++;assert.equal(init.redirect,'manual');return new Response(null,{status:302,headers:{Location:'https://attacker.org/collect'}});}};
const redirectToken=await formToken('redirect-user');
const redirectResponse=await worker.fetch(request('/configure',{method:'POST',headers:{'oai-authenticated-user-id':'redirect-user','Origin':'null','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({base:'https://plexus.example.org',key:'test-secret',csrf:redirectToken})}),redirectEnv);
assert.equal(redirectCalls,1);assert((await redirectResponse.text()).includes('administrator credentials will not be forwarded'));assert(!blobs.has('connections/redirect-user'));
console.log('PASS: edge-compatible manual redirects; redirect rejected after one request with no credential forwarding or storage');
