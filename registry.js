// count the total number of clients connected to all rooms
export class GlobalRegistry {
  constructor(state, env) {
    this.state = state;
    this.count = 0;
  }

  async fetch(request) {
    const { action } = await request.json();

    if (action === "increment") this.count++;
    else if (action === "decrement") this.count = this.count - 1;

    return new Response(JSON.stringify({ count: this.count }));
  }
}