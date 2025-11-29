import { commandexists, executecommand } from './commands.js';
// fat cock
export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.clients = [];
  }

  async fetch(request) {
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const [client, server] = Object.values(new WebSocketPair());
    server.accept();

    let username = null;
    let roomid = null;
    let hiddenroom = null;
    this.clients.push({ socket: server, username: null, roomid: null, hiddenroom: null });

    server.addEventListener("message", evt => {
      const data = JSON.parse(evt.data);

      if (data.type === "message") {
        if(data.message && data.message.startsWith("/")) {
          this.handlecommand(data, server, username, roomid)
        } else this.handleChatMessage(data, username);
      } else if (data.type === "join") {
        const result = this.handleJoin(data, server);
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

  handlecommand(data, server, username, roomid) {
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

    const response = executecommand(commandname, this, data, server, username, roomid)

    if(response) {
      try { server.send(JSON.stringify(response)) } catch (e) {}
    }
  }

  handleChatMessage(data, username) {
    const msg = JSON.stringify({
      type: "chat",
      username: username,
      message: data.message,
      imageURL: data.imageURL || null,
      imagedata: data.imagedata || null,
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

  handleJoin(data, server) {
    const username = data.username;
    const roomid = data.roomid;
    const hiddenroom = data.hiddenroom;

    const clientObj = this.clients.find(c => c.socket === server);
    if (clientObj) {
      clientObj.username = username;
      clientObj.roomid = roomid;
      clientObj.hiddenroom = hiddenroom;
    }

    // send private message with online users
    //this.sendOnlineUsers(server, roomid);
    server.send(JSON.stringify(executecommand("count", this, data, server, username, roomid)))

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

  sendOnlineUsers(server, roomid) {
    let on = [];
    for (let c of this.clients) {
      let displayName = c.username;
      if (c.roomid === roomid) { 
        displayName = displayName + "*";
      }
      on.push(displayName); 
    }

    const returntext = "currently online: " + on.toString() + " (" + on.length + ")";
    const msg = JSON.stringify({
      type: "private",
      message: returntext,
      timestamp: new Date().toISOString()
    });

    try { 
      server.send(msg);
    } catch (e) {}
  }

  handleDisconnect(server, username, roomid, hiddenroom) {
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