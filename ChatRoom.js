import { commandexists, executecommand } from './commands.js';

const COOLDOWN = 500; // (ms) time between messages per client 
const MAXCLIENTSPERROOM = 10;

// fat cock
export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.clients = [];
  }

  getRegistryStub() {
    const id = this.env.global_registry.idFromName("global");
    return this.env.global_registry.get(id);
  }
  async registryIncrement() {
    const stub = this.getRegistryStub();
    await stub.fetch("https://registry/", {
      method: "POST",
      body: JSON.stringify({ action: "increment" })
    });
  }
  async registryDecrement() {
    const stub = this.getRegistryStub();
    await stub.fetch("https://registry/", {
      method: "POST",
      body: JSON.stringify({ action: "decrement" })
    });
  }
  async getGlobalUserCount() {
    const stub = this.getRegistryStub();
    const res = await stub.fetch("https://registry/", {
      method: "POST",
      body: JSON.stringify({ action: "get" })
    });
    const data = await res.json();
    return data.count;
  }

  async fetch(request) {
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('expected WebSocket', { status: 426 });
    }

    if (this.clients.length >= MAXCLIENTSPERROOM) {
      return new Response("room full", { status: 503});
    }

    const [client, server] = Object.values(new WebSocketPair());
    server.accept();

    let username = null;
    let roomid = null;
    let hiddenroom = null;
    this.clients.push({ socket: server, username: null, roomid: null, hiddenroom: null, lastMessageTime: 0 });

    server.addEventListener("message", async evt => {
      const data = JSON.parse(evt.data);

      if (data.type === "message") {
        const clientObj = this.clients.find(c => c.socket === server);
        if (clientObj) {
          const now = Date.now();
          if (now - clientObj.lastMessageTime < COOLDOWN) {
            return;
          }
          clientObj.lastMessageTime = now;
        }


        if(data.message && data.message.startsWith("/")) {
          await this.handlecommand(data, server, username, roomid)
        } else this.handleChatMessage(data, username);
      } else if (data.type === "join") {
        const result = await this.handleJoin(data, server);
        username = result.username;
        roomid = result.roomid;
        hiddenroom = result.hiddenroom;
      }
    });

    server.addEventListener("close", () => {
      this.handleDisconnect(server, username, roomid, hiddenroom);
    });

    return new Response(null, { 
      status: 101, 
      webSocket: client 
    });
  }

  async handlecommand(data, server, username, roomid) {
    const message = data.message.trim();
    const parts = message.slice(1).split(" ");
    const commandname = parts[0].toLowerCase();

    if (!commandexists(commandname)) { // see if we have that in store
      const errormsg = JSON.stringify({
        type: "private",
        message: `unknown command: /${commandname}. Type /help for available commands.`,
        timestamp: new Date().toISOString()
      });
      try { server.send(errormsg);} catch (e) {}
      return;
    }

    const response = await executecommand(commandname, this, data, server, username, roomid, MAXCLIENTSPERROOM)

    if(response) { // one of the commands uses eval() in return but that only goes to the person who ran the command itself so i think it is safe?
      try { server.send(JSON.stringify(response)) } catch (e) {}
    }
  }

  handleChatMessage(data, username) {

    // this is against nasty individuals who try to sneak in malicious code or sum shit
    let imageURL = null;
    if (data.imageURL) {
      try {
        const url = new URL(data.imageURL);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          imageURL = data.imageURL;
        }
      } catch (e) {}
    }
    let message = data.message
    if(message.length>200) message = message.trim().slice(0,200) // server side message length limit

    // base64 is ~33% bigger than the raw bytes it encodes
    const MAX_IMAGE_BASE64_LENGTH = 1000 * 1024 * 1.4;
    let imagedata = data.imagedata || null;
    if (imagedata && imagedata.length > MAX_IMAGE_BASE64_LENGTH) {
      imagedata = null;
    }

    const msg = JSON.stringify({
      type: "chat",
      username: username,
      message: message,
      imageURL: imageURL,
      imagedata: imagedata,
      timestamp: new Date().toISOString()
    });

    for (let c of this.clients) {
      if (c.roomid === data.roomid) {
        try { 
          c.socket.send(msg);
        } catch (e) {}
      }
    }
  }

  async handleJoin(data, server) {
    let username = data.username;
    const joincount = this.clients.length

    username = username.trim().slice(0, 20); // 31 character limit
    if (!username || username.length === 0 || username.includes("<") || username.includes(">")) {
      username = `anon-${joincount}`;
    }
    const roomid = data.roomid;
    const hiddenroom = data.hiddenroom;

    const clientObj = this.clients.find(c => c.socket === server);
    if (clientObj) {
      clientObj.username = username;
      clientObj.roomid = roomid;
      clientObj.hiddenroom = hiddenroom;
      clientObj.registered = true;
    }

    await this.registryIncrement();

    console.log(username + " joined")
    server.send(JSON.stringify(await executecommand("count", this, data, server, username, roomid, MAXCLIENTSPERROOM)))

    // broadcast join message
    const joinroomid = hiddenroom ? "[hidden]" : roomid;
    const msg = JSON.stringify({
      type: "system",
      message: `${username} joined ${joinroomid}`,
      timestamp: new Date().toISOString()
    });

    for (let c of this.clients) { 
      try { 
        c.socket.send(msg);
      } catch (e) {}
    }

    return { username, roomid, hiddenroom };
  }

  async handleDisconnect(server, username, roomid, hiddenroom) {
    const clientObj = this.clients.find(c => c.socket === server);
    if (clientObj && clientObj.registered) {
      await this.registryDecrement();
    }

    console.log(username + " left")
    const leftroomid = hiddenroom ? "[hidden]" : roomid;
    const msg = JSON.stringify({
      type: "system",
      message: `${username} left ${leftroomid}`,
      timestamp: new Date().toISOString()
    });

    for (let c of this.clients) {
      if (c.socket !== server) {
        try { 
          c.socket.send(msg);
        } catch (e) {}
      }
    }

    this.clients = this.clients.filter(c => c.socket !== server);
  }
}