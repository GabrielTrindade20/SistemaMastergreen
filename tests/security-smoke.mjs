// No business-data writes. Creates and revokes diagnostic login sessions only.
import assert from 'node:assert/strict';
if(new URL(process.env.DATABASE_URL??'').pathname!=='/mastergreen_develop')throw new Error('Development database only.');
const base='http://127.0.0.1:5001';
const call=(path,options={})=>fetch(base+path,{signal:AbortSignal.timeout(15000),...options});
const jsonHeaders={'Content-Type':'application/json'};
const credentials=JSON.stringify({email:process.env.DEV_ADMIN_EMAIL,password:process.env.DEV_ADMIN_PASSWORD});
let cookie,token;
function noSecrets(value){
  if(!value||typeof value!=='object')return;
  assert.equal(Object.hasOwn(value,'password'),false);assert.equal(Object.hasOwn(value,'token_hash'),false);
  Object.values(value).forEach(noSecrets);
}
try{
  for(const path of ['/api/customers','/api/quotations','/api/dashboard/2026-10','/api/company-profile','/api/quick-proposals/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','/api/mobile/data','/api/mobile/summary?from=2026-10-01&to=2026-10-31']){
    const response=await call(path);assert.ok([401,403].includes(response.status),path);
  }
  assert.equal((await call('/api/company-profile',{method:'PUT',headers:jsonHeaders,body:'{}'})).status,403);
  assert.equal((await call('/api/mobile/data',{headers:{Authorization:'Bearer '+'a'.repeat(64)}})).status,401);
  const malformed=await call('/api/login',{method:'POST',headers:jsonHeaders,body:'{"bad"'});
  assert.equal(malformed.status,400);assert.doesNotMatch(await malformed.text(),/SyntaxError|stack|node_modules/);
  const login=await call('/api/login',{method:'POST',headers:jsonHeaders,body:credentials});assert.equal(login.status,200);
  const setCookie=login.headers.get('set-cookie');assert.match(setCookie,/HttpOnly/i);assert.match(setCookie,/SameSite=Lax/i);
  cookie=setCookie.split(';',1)[0];noSecrets(await login.json());
  for(const path of ['/api/me','/api/quotations','/api/customers']){
    const response=await call(path,{headers:{cookie}});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');noSecrets(await response.json());
  }
  assert.equal((await call('/api/dashboard/2026-99',{headers:{cookie}})).status,400);
  assert.equal((await call('/api/quick-proposals/invalid',{headers:{cookie}})).status,400);
  const mobile=await call('/api/mobile/auth/login',{method:'POST',headers:jsonHeaders,body:credentials});assert.equal(mobile.status,200);
  const body=await mobile.json();token=body.token;assert.match(token,/^[a-f0-9]{64}$/);assert.ok(Math.abs(Date.parse(body.expiresAt)-Date.now()-30*86400000)<60000);
  const headers={Authorization:'Bearer '+token};
  const invalid=await call('/api/mobile/proposals',{method:'POST',headers:{...jsonHeaders,...headers},body:JSON.stringify({totalCents:-1})});assert.equal(invalid.status,400);
  assert.equal((await call('/api/mobile/auth/logout',{method:'POST',headers})).status,200);
  assert.equal((await call('/api/mobile/data',{headers})).status,401);token=null;
  assert.equal((await call('/api/logout',{method:'POST',headers:{cookie}})).status,200);
  assert.equal((await call('/api/me',{headers:{cookie}})).status,401);cookie=null;
  console.log('PASS: protected endpoints, invalid JSON recovery, safe user serialization, no-store, cookies, 30-day token, invalid payload and session revocation.');
}finally{
  if(cookie)await call('/api/logout',{method:'POST',headers:{cookie}}).catch(()=>{});
  if(token)await call('/api/mobile/auth/logout',{method:'POST',headers:{Authorization:'Bearer '+token}}).catch(()=>{});
}
