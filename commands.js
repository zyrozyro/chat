export const commands = {
  help: {
    description: "gives list of commands or description of command, () means optional argument [] means required; usage /help (command)",
    run: (chatRoom, data, server, username, roomid) => { 
      const parts = data.message.slice(6).trim().split(" ");
      if(parts.length>0) {
        const commandname = parts[0];
        if(!commands[commandname]) {
          return {
            type: "private",
            message: `unknown command "${commandname}", for a list of commands type /help`,
            timestamp: new Date().toISOString()
          }
        }
        const description = commands[commandname].description
        return {
          type: "private",
          message: `${commandname}: ${description}`,
          timestamp: new Date().toISOString()
        }
      }
      
      const commandlist = Object.keys(commands).join(", ");

      return {
        type: "private",
        message: `available commands: ${commandlist} (${commandlist.length})`,
        timestamp: new Date().toISOString()
      };
    }
  },

  count: {
    description: "counts the users connected to your room, and the total users; usage: /count",
    run: (chatRoom, data, server, username, roomid) => {
      const usersinroom = chatRoom.clients
        .filter(c => c.roomid === roomid && c.username)
        .map(c => c.username);
      const totalusers = chatRoom.clients.length
      
      return {
        type: "private",
        message: `users in this room: ${usersinroom.join(", ")} (${usersinroom.length}), (${totalusers} total)`,
        timestamp: new Date().toISOString()
      };
    }
  },


  me: {
    description: "lets you do an action; usage: /me [action]",
    run: (chatRoom, data, server, username, roomid) => {
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

      return null;
    }
  },

  whisper: {
    description: "sends a private message to someone in your room; usage: /whisper [user] [message]",
    run: (chatRoom, data, server, username, roomid) => {
      const parts = data.message.slice(9).trim().split(" ");
      const targetUsername = parts[0];
      const message = parts.slice(1).join(" ");

      if (!targetUsername || !message) {
        return {
          type: "private",
          message: "usage: /whisper [user] [message]",
          timestamp: new Date().toISOString()
        };
      }

      const targetClient = chatRoom.clients.find(c => c.username === targetUsername); // test what happens if 2 people share same username
      
      if (!targetClient) {
        return {
          type: "private",
          message: `user "${targetUsername}" not found`,
          timestamp: new Date().toISOString()
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
    }
  },

  clear: {
    description: "clears your current chat history (you can also just do ctrl + r man); usage: /clear",
    run: (chatRoom, data, server, username, roomid) => {
      return {
        type: "command", // is always private for now
        code: `document.getElementById('chat').innerHTML=''`
      };
    }
  }


};

// helper function to check if a command exists
export function commandexists(name) {
  return !!commands[name]
}

// helper function to execute a command
export function executecommand(name, chatRoom, data, server, username, roomid) {
  if (!commandexists(name)) { return null } // double check to make sure haha
  
  return commands[name].run(chatRoom, data, server, username, roomid);
}