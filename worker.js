import { ChatRoom } from "./ChatRoom.js";
import HTML from "./index.html";
import ClientJS from "./client.txt?raw"

export { ChatRoom };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/client.txt") {
      return new Response(ClientJS, {
        headers: { "Content-Type": "application/javascript" }
      });
    }

    const upgradeHeader = request.headers.get('Upgrade');
    
    // If it's a websocket request, pass it to the Durable Object
    if (upgradeHeader === "websocket") {
      const roomid = url.searchParams.get("room") || "main";
      const id = env.chat_room.idFromName(roomid);
      const stub = env.chat_room.get(id);
      return stub.fetch(request);
    }
    
    // If not, serve the HTML page
    return new Response(HTML, {
      headers: { "Content-Type": "text/html" }
    });
  }
};