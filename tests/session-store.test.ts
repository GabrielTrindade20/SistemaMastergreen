import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import type {Pool} from 'pg';
import {pool} from '../server/db';
if(new URL(process.env.DATABASE_URL!).pathname!=='/mastergreen_develop')throw new Error('Development database only.');
after(()=>pool.end());
test('production session store persists, expires and revokes against migration schema (temporary table)',async()=>{
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const migration=readFileSync('migrations/0005_web_sessions.sql','utf8').replace('CREATE TABLE IF NOT EXISTS','CREATE TEMP TABLE IF NOT EXISTS');
    await client.query(migration);
    const store=new (connectPgSimple(session))({pool:client as unknown as Pool,schemaName:'pg_temp',tableName:'web_sessions',pruneSessionInterval:false,createTableIfMissing:false});
    const sid=randomUUID(),data={cookie:{expires:new Date(Date.now()+60000)},user:{id:'test'}} as session.SessionData;
    const set=()=>new Promise<void>((resolve,reject)=>store.set(sid,data,error=>error?reject(error):resolve()));
    const get=()=>new Promise<session.SessionData|null|undefined>((resolve,reject)=>store.get(sid,(error,value)=>error?reject(error):resolve(value)));
    await set();assert.equal((await get())?.user?.id,'test');
    await client.query('UPDATE pg_temp.web_sessions SET expire=now()-interval \'1 second\' WHERE sid=$1',[sid]);assert.equal(await get(),undefined);
    await set();await new Promise<void>((resolve,reject)=>store.destroy(sid,error=>error?reject(error):resolve()));assert.equal(await get(),undefined);
  }finally{await client.query('ROLLBACK');client.release();}
});
