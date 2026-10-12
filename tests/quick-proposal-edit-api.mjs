// Read-only API verification; all PUT requests below must be rejected before writing.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
assert.equal(new URL(process.env.DATABASE_URL).pathname,'/mastergreen_develop');
const base='http://127.0.0.1:5001';
let cookie='';
const request=(path,method='GET',data,authenticated=true)=>fetch(base+path,{method,headers:{...(authenticated&&cookie?{Cookie:cookie}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
try {
  const login=await request('/api/login','POST',{email:process.env.DEV_ADMIN_EMAIL,password:process.env.DEV_ADMIN_PASSWORD});
  assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];
  const list=await(await request('/api/quick-proposals')).json();assert.ok(list.quickProposals.length);
  const row=list.quickProposals[0],path='/api/quick-proposals/'+row.id;
  const before=await(await request(path)).json();
  for(const key of ['id','quotationNumber','date','customer','totalCents','freight','payment','warranty','discountPercent']) assert.deepEqual(before[key],row[key]);
  assert.match(before.revision,/^[a-f0-9]{64}$/);
  const {id,quotationNumber,date,revision,...fields}=before;
  const valid={...fields,proposalDate:date,revision};
  assert.equal((await request(path,'GET',undefined,false)).status,403);
  assert.equal((await request(path,'PUT',valid,false)).status,403);
  assert.equal((await request('/api/quick-proposals/not-uuid')).status,400);
  assert.equal((await request('/api/quick-proposals/'+randomUUID())).status,404);
  assert.equal((await request(path,'PUT',{...valid,totalCents:-1})).status,400);
  assert.equal((await request(path,'PUT',{...valid,quotationNumber:'#11111111'})).status,400);
  assert.equal((await request(path,'PUT',{...valid,revision:'0'.repeat(64)})).status,409);
  assert.equal((await request('/api/quick-proposals/'+randomUUID(),'PUT',valid)).status,404);
  assert.deepEqual(await(await request(path)).json(),before);
  console.log('PASS: API autenticada, paridade lista/editor, acesso negado, validação, 404 e 409 sem mudar proposta.');
} finally {if(cookie)await request('/api/logout','POST');}
