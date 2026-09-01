// count the total number of clients connected to all rooms
export class GlobalRegistry {
  constructor(state, env) {
    this.state = state;
    this.count = 0;
    this.rooms = new Set();
    // username set
  }

  async fetch(request) {
    const body = await request.json()
    const { action } = body;

    if (action === "increment") this.count++;
    else if (action === "decrement") this.count = this.count - 1;

    else if (action === "registerroom") this.rooms.add(body.roomid);
    else if (action === "getrooms") return new Response(JSON.stringify({ rooms: [...this.rooms] }));

    return new Response(JSON.stringify({ count: this.count }));
  }
}