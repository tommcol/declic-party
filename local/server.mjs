import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {WebSocketServer} from 'ws';
import {openStorage} from './storage.mjs';

export function createLocalServer({worker, PartyRoom, MusicLibrary}, directory) {
  const rooms=new Map();
  let closing=false;
  const upgrades=new WeakMap();
  const sockets=new WebSocketServer({noServer:true,maxPayload:80000});
  const storage=openStorage(directory,(name,deliver)=>runRoom(name,room=>deliver(()=>room.alarm())));
  const env={
    DECLIC_LOCAL:'true',
    ROOMS:{getByName:name=>new Proxy({},{
      get:(_,method)=>(...args)=>runRoom(name,room=>room[method](...args))
    })},
    MUSIC_LIBRARY:{getByName:name=>new Proxy({},{
      get:(_,method)=>(...args)=>storage.library(name,['setExcluded','savePlaylist'].includes(method),state=>
        new MusicLibrary({storage:state},env)[method](...args))
    })}
  };

  function runRoom(name,action) {
    let entry=rooms.get(name);
    if(!entry){
      const clients=new Set();
      let heartbeat;
      const ctx={
        storage:storage.room(name),
        getWebSockets:()=>[...clients],
        setWebSocketAutoResponse:pair=>{heartbeat=pair;},
        upgradeWebSocket(request){
          const {req,socket,head}=upgrades.get(request);
          if(socket.destroyed)return new Response(null,{status:400});
          sockets.handleUpgrade(req,socket,head,client=>{
            let attachment={role:'guest',last:0,count:0};
            const ws={
              send:data=>{if(client.readyState===client.OPEN)client.send(data);},
              close:(code,reason)=>client.close(code,reason),
              serializeAttachment:value=>{attachment=structuredClone(value);},
              deserializeAttachment:()=>structuredClone(attachment)
            };
            clients.add(ws);
            client.on('message',(payload,binary)=>{
              const message=binary?payload:payload.toString();
              if(message===heartbeat?.request)ws.send(heartbeat.response);
              else runRoom(name,room=>room.webSocketMessage(ws,message)).catch(reportError);
            });
            client.on('error',()=>runRoom(name,room=>room.webSocketError(ws)).catch(reportError));
            client.on('close',()=>{
              clients.delete(ws);
              if(!closing)runRoom(name,room=>room.webSocketClose(ws)).catch(reportError);
              release(name,entry);
            });
          });
          return new Response(null,{status:204});
        }
      };
      entry={clients,room:new PartyRoom(ctx,env),tail:Promise.resolve(),pending:0};
      rooms.set(name,entry);
    }
    entry.pending++;
    const result=entry.tail.then(()=>action(entry.room));
    entry.tail=result.catch(()=>{}).finally(()=>{
      entry.pending--;
      release(name,entry);
    });
    return result;
  }

  function release(name,entry) {
    if(!entry.pending&&!entry.clients.size)rooms.delete(name);
  }

  const server=createServer(async(req,res)=>{
    try {
      const response=await worker.fetch(asRequest(req),env);
      res.writeHead(response.status,Object.fromEntries(response.headers));
      if(response.body)await pipeline(Readable.fromWeb(response.body),res);
      else res.end();
    } catch(error) {
      if(res.destroyed)return;
      reportError(error);
      if(!res.headersSent)res.writeHead(500);
      res.end();
    }
  });

  // Route the handshake through the same origin, room and capacity checks as Cloudflare.
  server.on('upgrade',async(req,socket,head)=>{
    const onError=()=>socket.destroy();
    socket.on('error',onError);
    try {
      const request=asRequest(req);
      upgrades.set(request,{req,socket,head});
      const response=await worker.fetch(request,env);
      if(response.status!==204){
        socket.end('HTTP/1.1 '+response.status+' Rejected\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
      }
    } catch(error) {
      reportError(error);
      socket.destroy();
    } finally {
      if(!socket.destroyed)socket.removeListener('error',onError);
    }
  });

  storage.restoreAlarms();
  return {server, async close(){
    closing=true;
    storage.stopAlarms();
    for(const socket of sockets.clients)socket.terminate();
    await new Promise(resolve=>server.close(resolve));
    await Promise.all([...rooms.values()].map(entry=>entry.tail));
    storage.close();
  }};
}

function asRequest(req) {
  const origin=new URL('http://'+req.headers.host);
  if(!req.url.startsWith('/')||req.url.startsWith('//'))throw Error('Adresse invalide');
  // Concatenation keeps the request on its HTTP origin.
  const url=new URL(origin.origin+req.url);
  const hasBody=!['GET','HEAD'].includes(req.method);
  return new Request(url,{
    method:req.method,headers:req.headers,
    ...(hasBody?{body:Readable.toWeb(req),duplex:'half'}:{})
  });
}

function reportError(error){console.error('Serveur local Déclic Party :',error.message);}
