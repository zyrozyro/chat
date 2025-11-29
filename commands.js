export const commands = {
  help: (chatRoom, data, server, username, roomid) => { // expand this so that it can optionally give a description of commands
    const commandlist = Object.keys(commands).join(", ");
    return {
      type: "private",
      message: `available commands: ${commandlist} (${commandlist.length})`,
      timestamp: new Date().toISOString()
    };
  },

  count: (chatRoom, data, server, username, roomid) => {
    const usersinroom = chatRoom.clients
      .filter(c => c.roomid === roomid && c.username)
      .map(c => c.username);
    const totalusers = chatRoom.clients.length
    
    return {
      type: "private",
      message: `users in this room: ${usersinroom.join(", ")} (${usersinroom.length}), (${totalusers} total)`,
      timestamp: new Date().toISOString()
    };
  },

  me: (chatRoom, data, server, username, roomid) => {
    // /me does a dance -> "username does a dance"
    const action = data.message.slice(4).trim(); // remove "/me " from the message
    
    if (!action) {
      return {
        type: "private",
        message: "usage: /me <action>",
        timestamp: new Date().toISOString()
      };
    }

    // broadcast in italics
    const msg = JSON.stringify({
      type: "action",
      username: username,
      message: action,
      timestamp: new Date().toISOString()
    });

    for (let c of chatRoom.clients) {
      if (c.roomid === roomid) {
        try { 
          c.socket.send(msg);
        } catch (e) {}
      }
    }

    return null; // already sent the message
  },

  whisper: (chatRoom, data, server, username, roomid) => {
    // /whisper targetuser message here
    const parts = data.message.slice(9).trim().split(" ");
    const targetUsername = parts[0];
    const message = parts.slice(1).join(" ");

    if (!targetUsername || !message) {
      return {
        type: "private",
        message: "usage: /whisper <username> <message>",
        timestamp: new Date().toISOString()
      };
    }

    const targetClient = chatRoom.clients.find(c => c.username === targetUsername); // test what happens if 2 people share same username
    
    if (!targetClient) {
      return {
        type: "private",
        message: `user "${targetUsername}" not found`
      };
    }

    // send to target
    const msg = JSON.stringify({
      type: "whisper",
      message: `${username} whimpered: ${message}`,
      timestamp: new Date().toISOString()
    });

    try {
      targetClient.socket.send(msg);
    } catch (e) {
      return {
        type: "private",
        message: "failed to whimper",
        timestamp: new Date().toISOString()
      };
    }

    // confirm to sender
    return {
      type: "whisper",
      message: `whimpered to ${targetUsername}: ${message}`,
      timestamp: new Date().toISOString()
    };
  },

  clear: (chatRoom, data, server, username, roomid) => {
    return {
      type: "private",
      message: `this doesnt do anything yet haha`,
      timestamp: new Date().toISOString()
    };
  }
};

// helper function to check if a command exists
export function commandexists(commandname) {
  return commandname in commands;
}

// helper function to execute a command
export function executecommand(commandname, chatRoom, data, server, username, roomid) {
  if (!commandexists(commandname)) { return null } // double check to make sure haha
  
  return commands[commandname](chatRoom, data, server, username, roomid);
}