import {existsSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {deserialize, serialize} from 'node:v8';

export function openStorage(directory, deliverAlarm) {
  mkdirSync(directory,{recursive:true,mode:0o700});
  const db=new DatabaseSync(join(directory,'rooms.sqlite'));
  db.exec(`
    PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS records (
      actor TEXT, key TEXT, value BLOB NOT NULL, PRIMARY KEY (actor,key)
    );
    CREATE TABLE IF NOT EXISTS alarms (actor TEXT PRIMARY KEY, at INTEGER NOT NULL);
  `);
  const read=db.prepare('SELECT value FROM records WHERE actor=? AND key=?');
  const write=db.prepare('INSERT OR REPLACE INTO records VALUES (?,?,?)');
  const remove=db.prepare('DELETE FROM records WHERE actor=? AND key=?');
  const clear=db.prepare('DELETE FROM records WHERE actor=?');
  const alarms=db.prepare('SELECT actor, at FROM alarms');
  const setAlarm=db.prepare('INSERT OR REPLACE INTO alarms VALUES (?,?)');
  const deleteAlarm=db.prepare('DELETE FROM alarms WHERE actor=?');
  const timers=new Map();
  let stopped=false;

  function arm(actor, at, retryDelay=0) {
    clearTimeout(timers.get(actor));
    timers.delete(actor);
    if(stopped||at===null)return;
    const timer=setTimeout(async()=>{
      if(Date.now()<at){
        arm(actor,at);
        return;
      }
      try {
        await deliverAlarm(actor,async run=>{
          if(stopped||timers.get(actor)!==timer)return;
          await run();
          // A rescheduled alarm already has its own timer.
          if(timers.get(actor)===timer){
            deleteAlarm.run(actor);
            timers.delete(actor);
          }
        });
      } catch(error) {
        console.error('Alarme locale Déclic Party :',error.message);
        if(timers.get(actor)===timer)arm(actor,at,1000);
      }
    },Math.min(Math.max(at-Date.now(),retryDelay),2**31-1));
    timer.unref();
    timers.set(actor,timer);
  }

  return {
    restoreAlarms(){
      for(const {actor,at} of alarms.iterate())arm(actor,at);
    },
    stopAlarms(){
      stopped=true;
      for(const timer of timers.values())clearTimeout(timer);
      timers.clear();
    },
    close(){db.close();},
    room(actor){
      const get=key=>{
        const record=read.get(actor,key);
        return record?deserialize(record.value):undefined;
      };
      const put=(key,value)=>write.run(actor,key,serialize(value));
      const del=key=>remove.run(actor,key);
      const updateAlarm=at=>at===null?deleteAlarm.run(actor):setAlarm.run(actor,at);
      return {
        get,put,delete:del,deleteAll:()=>clear.run(actor),
        setAlarm(at){updateAlarm(at);arm(actor,at);},
        deleteAlarm(){updateAlarm(null);arm(actor,null);},
        async transaction(callback){
          // Stage the asynchronous callback, then commit its changes atomically.
          const changes=new Map();
          let alarm;
          const result=await callback({
            get:key=>changes.has(key)?(changes.get(key)?deserialize(changes.get(key)):undefined):get(key),
            put:(key,value)=>changes.set(key,serialize(value)),
            delete:key=>changes.set(key,null),
            setAlarm:at=>{alarm=at;},
            deleteAlarm:()=>{alarm=null;}
          });
          db.exec('BEGIN');
          try {
            for(const [key,change] of changes) {
              if(change)write.run(actor,key,change);
              else del(key);
            }
            if(alarm!==undefined)updateAlarm(alarm);
            db.exec('COMMIT');
          } catch(error) {
            db.exec('ROLLBACK');
            throw error;
          }
          if(alarm!==undefined)arm(actor,alarm);
          return result;
        }
      };
    },
    library(actor, mutating, callback){
      const file=join(directory,'library-'+actor+'.sqlite');
      const library=new DatabaseSync(mutating||existsSync(file)?file:':memory:');
      try {
        const sql={exec(query,...params){
          if(!/^\s*SELECT\b/i.test(query)){
            library.prepare(query).run(...params);
            return;
          }
          return {toArray:()=>library.prepare(query).all(...params)};
        }};
        return callback({sql});
      } finally {
        library.close();
      }
    }
  };
}
