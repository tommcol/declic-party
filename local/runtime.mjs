// The shared Worker classes only use these fields and the WebSocket heartbeat.
export class DurableObject {
  constructor(ctx,env){Object.assign(this,{ctx,env});}
}

export class WebSocketRequestResponsePair {
  constructor(request,response){Object.assign(this,{request,response});}
}
