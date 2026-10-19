const VERSION = '0.3.3';
const DOMAINS = {
  plexus_config: 'Inspect Plexus configuration. Operations: get, export, status.',
  plexus_provider: 'Manage providers. Operations: list, get, put, create, update, delete, fetch_models.',
  plexus_pi_catalog: 'Inspect the pi catalog. Operations: providers, models, validate_config.',
  plexus_model_alias: 'Manage aliases and ordered targets. Operations: list, get, put, create, update, delete, delete_all.',
  plexus_key: 'Manage inference keys. Operations: list, get, put, create, update, delete. Secrets remain redacted.',
  plexus_quota: 'Manage quotas. Operations: list, get, put, create, update, delete, status, clear, recompute.',
  plexus_quota_checker: 'Inspect quota checkers. Operations: types, list, get.',
  plexus_usage: 'Review usage. Operations: list, summary, delete, delete_all.',
  plexus_debug: 'Manage debug capture. Operations: state, update, logs, get_log, delete_log, delete_all_logs.',
  plexus_mcp_gateway: 'Manage upstream MCPs. Operations: servers_list, list, get, put, create, update, delete, status, start, stop, restart, logs.',
  plexus_settings: 'Inspect settings. Operation: get.',
  plexus_system_logs: 'Inspect logs and runtime verbosity. Operations: recent, level, set_level, reset_level.',
  plexus_operations: 'Operational actions. Operations: backup, restore, restart, refresh_metadata, refresh_catalog, list_cooldowns, clear_cooldowns, reset_logs.'
};
const INPUT = { type:'object', properties:{operation:{type:'string',minLength:1},id:{type:'string'},category:{type:'string'},query:{type:'object',additionalProperties:true},body:{type:'object',additionalProperties:true},destructive:{type:'string',enum:['acknowledged']}},required:['operation'],additionalProperties:false };
const TOOLS = [{name:'plexus_connection_status',description:'Check whether this signed-in user has configured a Plexus admin connection. Never returns credentials.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,openWorldHint:false}}, ...Object.entries(DOMAINS).map(([name,description])=>({name,description:description+' Inspect the target before changes; use destructive: acknowledged only with user authorization. Upstream schemas and supported operations vary by version.',inputSchema:INPUT,annotations:{readOnlyHint:false,destructiveHint:true,openWorldHint:true}}))];
const enc = new TextEncoder();
const common = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"object-src 'none'; base-uri 'none'"};
const json = (data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...common,'Content-Type':'application/json'}});
const escape = s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function target(value){
 const u=new URL(value);
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw Error('Use an HTTPS base URL without credentials, query, or fragment.');
 const host=u.hostname.toLowerCase();
 if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.includes(':')||/^[\d.]+$/.test(host))throw Error('Use the public HTTPS hostname for the Plexus instance.');
 u.pathname=u.pathname.replace(/\/+$/,'');
 return u.href.replace(/\/$/,'');
}
async function cryptoKey(env){
 if(!/^[0-9a-f]{64}$/.test(env.CREDENTIAL_ENCRYPTION_KEY||''))throw Error('Encryption is not configured.');
 return crypto.subtle.importKey('raw',Uint8Array.from(env.CREDENTIAL_ENCRYPTION_KEY.match(/../g),h=>parseInt(h,16)),{name:'AES-GCM'},false,['encrypt','decrypt']);
}
const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes)));
const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function seal(env,user,data){const iv=crypto.getRandomValues(new Uint8Array(12));return JSON.stringify({v:1,iv:b64(iv),data:b64(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(user)},await cryptoKey(env),enc.encode(JSON.stringify(data))))});}
async function unseal(env,user,value){const box=JSON.parse(value);if(box.v!==1)throw Error('Unknown credential version.');return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(box.iv),additionalData:enc.encode(user)},await cryptoKey(env),bytes(box.data))));}
async function config(env,user){const obj=await env.BUCKET.get('connections/'+encodeURIComponent(user));return obj?unseal(env,user,await obj.text()):null;}
async function rpc(cfg,method,params={},doFetch=fetch){
 const r=await doFetch(cfg.base+'/mcp/plexus',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(25000),headers:{'Content-Type':'application/json','Accept':'application/json, text/event-stream','x-admin-key':cfg.key},body:JSON.stringify({jsonrpc:'2.0',id:crypto.randomUUID(),method,params})});
 if(r.status>=300&&r.status<400)throw Error('Plexus returned a redirect. Use its final HTTPS base URL; administrator credentials will not be forwarded to redirects.');
 if(!r.ok)throw Error('Plexus returned HTTP '+r.status+'. Check the endpoint, Management MCP enablement, and administrator credential.');
 const raw=await r.text();if(raw.length>4_000_000)throw Error('Response too large; narrow the query.');
 let msg;
 try {msg=JSON.parse(raw);}catch{for(const event of raw.split(/\r?\n\r?\n/)){const data=event.split(/\r?\n/).filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trimStart()).join('\n');try{const candidate=JSON.parse(data);if(candidate.id!==undefined&&(candidate.result!==undefined||candidate.error)){msg=candidate;break;}}catch{}}}
 if(!msg)throw Error('Plexus returned an unsupported MCP response.');
 if(msg.error)throw Error('Plexus rejected the MCP request ('+String(msg.error.code)+').');
 return msg.result;
}
async function verify(cfg,doFetch){
 await rpc(cfg,'initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'chatgpt-plexus-plugin',version:VERSION}},doFetch);
 const result=await rpc(cfg,'tools/list',{},doFetch);
 if(!Array.isArray(result?.tools)||!result.tools.some(t=>t.name==='plexus_config'))throw Error('The endpoint is not a supported Plexus management MCP.');
 return result.tools;
}
async function csrfToken(env,user){return seal(env,user,{purpose:'csrf',issued:Date.now(),nonce:b64(crypto.getRandomValues(new Uint8Array(24)))});}
async function validCsrf(env,user,value){
 if(typeof value!=='string'||value.length>2048)return false;
 try{const token=await unseal(env,user,value);const age=Date.now()-token.issued;return token.purpose==='csrf'&&Number.isFinite(token.issued)&&age>=0&&age<=1800000&&typeof token.nonce==='string';}catch{return false;}
}
function page(saved,message='',csrf=''){
 return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Plexus Admin</title><style>body{margin:0;background:#11131c;color:#f2f2fa;font:17px/1.6 system-ui}main{max-width:600px;margin:7vh auto;padding:24px}h1{font-size:38px;letter-spacing:-1px}p{color:#b9bdd0}label{display:block;margin:24px 0 7px}input{box-sizing:border-box;width:100%;padding:15px;border:1px solid #555c76;border-radius:10px;background:#1c2030;color:white;font:inherit}button,a.button{display:inline-block;margin-top:24px;padding:13px 20px;background:#c4b5fd;color:#18112e;border:0;border-radius:10px;font:600 16px system-ui;cursor:pointer}.status{padding:12px 16px;border:1px solid #555c76;border-radius:10px}.fine{font-size:14px}.remove button{background:#292e40;color:#f2f2fa}a{color:#c4b5fd}</style><main><p>PLEXUS / CHATGPT</p><h1>Your gateway.<br>Your connection.</h1><p>Connect Plexus management to your ChatGPT account. Setup works in a browser on your phone or computer.</p>${message?`<p role="status" class="status">${escape(message)}</p>`:''}${saved?`<p class="status">Connected to <strong>${escape(saved.base)}</strong></p><p>Return to ChatGPT and select the Plexus Admin OAuth plugin. Your administrator key stays server-side.</p>`:'<p class="status">No connection saved yet.</p>'}<form action="/configure" method="post"><input type="hidden" name="csrf" value="${escape(csrf)}"><label for="base">Plexus base URL</label><input id="base" name="base" type="url" required value="${escape(saved?.base||'https://plexus.example.com')}" autocomplete="url"><label for="key">Administrator key</label><input id="key" name="key" type="password" required autocomplete="off" placeholder="Enter your Plexus ADMIN_KEY"><p class="fine">Sent over HTTPS and stored encrypted for your signed-in identity. The key is never returned to chat. This adapter has administrator access to the selected Plexus instance.</p><button>Verify and save connection</button></form>${saved?`<form action="/disconnect" method="post" class="remove"><input type="hidden" name="csrf" value="${escape(csrf)}"><button>Remove saved connection</button></form>`:''}<p class="fine">The plugin uses Sites-managed authentication. You do not need a desktop app or a custom header form in ChatGPT.</p></main></html>`,{headers:{...common,'Content-Type':'text/html;charset=utf-8'}});
}
export default {async fetch(request,env){
 const u=new URL(request.url);const publicOrigin=env.PUBLIC_ORIGIN ? new URL(env.PUBLIC_ORIGIN).origin : u.origin;const user=request.headers.get('oai-authenticated-user-id');
 if(u.pathname==='/health')return json({ok:true,version:VERSION});
 if(u.pathname==='/mcp'){
  if(request.method!=='POST')return json({error:'Use POST'},405);
  if(Number(request.headers.get('Content-Length')||0)>128000)return json({error:'Request too large'},413);
  let m;try{const raw=await request.text();if(raw.length>128000)return json({error:'Request too large'},413);m=JSON.parse(raw);}catch{return json({error:'Invalid JSON'},400);}
  const result=value=>json({jsonrpc:'2.0',id:m.id??null,result:value});
  if(m.method==='server/discover')return result({supportedVersions:['2026-07-28'],capabilities:{tools:{}}});
  if(m.method==='initialize')return result({protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'plexus-admin-oauth',version:VERSION}});
  if(m.method==='notifications/initialized')return new Response(null,{status:202});
  if(m.method==='tools/list')return result({tools:TOOLS});
  if(m.method!=='tools/call')return json({jsonrpc:'2.0',id:m.id??null,error:{code:-32601,message:'Method not found'}});
  if(!user)return json({error:'Sign in with ChatGPT to use this connection.'},401);
  let cfg;
  try{
   cfg=await config(env,user);
   if(m.params?.name==='plexus_connection_status')return result({content:[{type:'text',text:JSON.stringify({configured:!!cfg,base:cfg?.base||null,setupUrl:publicOrigin+'/'})}]});
   if(!cfg)throw Error('Open '+u.origin+'/ in your browser and save your Plexus connection first.');
   if(!Object.hasOwn(DOMAINS,m.params?.name))throw Error('Unknown tool.');
   const args=m.params.arguments;
   if(!args||typeof args!=='object'||Array.isArray(args)||typeof args.operation!=='string'||!args.operation.trim())throw Error('operation is required.');
   if(Object.keys(args).some(k=>!Object.hasOwn(INPUT.properties,k)))throw Error('Unsupported argument.');
   const tools=await verify(cfg,env.UPSTREAM_FETCH);
   if(!tools.some(t=>t.name===m.params.name))throw Error('This Plexus version does not expose the requested tool.');
   const output=await rpc(cfg,'tools/call',{name:m.params.name,arguments:{...args,redact:true}},env.UPSTREAM_FETCH);
   // Never echo the configured administrator key, even if an upstream error includes it.
   return result(JSON.parse(JSON.stringify(output).split(cfg.key).join('[REDACTED]')));
  }catch(e){const safe=cfg?.key?String(e.message).split(cfg.key).join('[REDACTED]'):String(e.message);return result({content:[{type:'text',text:safe}],isError:true});}
 }
 if(!user){if(request.method!=='GET')return json({error:'Sign in required'},401);return new Response('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><h1>Plexus Admin</h1><a href="/signin-with-chatgpt?return_to=%2F" target="_top">Sign in with ChatGPT</a>',{headers:{...common,'Content-Type':'text/html'}});}
 if(request.method==='GET'&&u.pathname==='/'){
  try{return page(await config(env,user),u.searchParams.get('saved')==='1'?'Connection verified and saved.':'',await csrfToken(env,user));}catch{return page(null,'Connection storage is unavailable. Please try again later.');}
 }
 if(request.method==='POST'&&['/configure','/disconnect'].includes(u.pathname)){
  const origin=request.headers.get('Origin');
  if(origin&&origin!=='null'&&origin!==publicOrigin)return json({error:'Origin mismatch'},403);
  if(!(request.headers.get('Content-Type')||'').startsWith('application/x-www-form-urlencoded'))return json({error:'Use the setup form'},415);
  if(Number(request.headers.get('Content-Length')||0)>16000)return json({error:'Request too large'},413);
  const raw=await request.text();if(raw.length>16000)return json({error:'Request too large'},413);
  const f=new URLSearchParams(raw);
  if(!await validCsrf(env,user,f.get('csrf')))return json({error:'The form expired or could not be verified. Open the setup page again and retry.'},403);
  if(u.pathname==='/disconnect'){await env.BUCKET.delete('connections/'+encodeURIComponent(user));return Response.redirect(publicOrigin+'/',303);}
  let setupStage='validate';
  try{
   const cfg={base:target(f.get('base')||''),key:f.get('key')||''};
   if(!cfg.key||cfg.key.length>8192||/[\r\n]/.test(cfg.key))throw Error('Enter a valid administrator key.');
   setupStage='verify';
   await verify(cfg,env.UPSTREAM_FETCH);
   setupStage='store';
   await env.BUCKET.put('connections/'+encodeURIComponent(user),await seal(env,user,cfg));
   return Response.redirect(publicOrigin+'/?saved=1',303);
  }catch(e){console.warn(JSON.stringify({event:'connection_setup_failed',stage:setupStage}));const key=f.get('key');const message=key?String(e.message).split(key).join('[REDACTED]'):String(e.message);return page(null,message,await csrfToken(env,user));}
 }
 return json({error:'Not found'},404);
}};
export {target,seal,unseal,TOOLS,csrfToken};
