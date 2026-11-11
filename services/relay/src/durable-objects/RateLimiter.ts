type Counts = { upload: number; download: number; delete: number };
type Budget = { hour: number; global: Counts; clients: Record<string, Counts> };
const empty = (): Counts => ({ upload: 0, download: 0, delete: 0 });
const PER_CLIENT: Counts = { upload: 3, download: 30, delete: 20 };
const GLOBAL: Counts = { upload: 50, download: 500, delete: 500 };
export class RateLimiter {
  constructor(private state: DurableObjectState) {}
  async fetch(request: Request) {
    let input: { client?: string; action?: keyof Counts };
    try {
      input = await request.json();
    } catch {
      return new Response("Invalid budget request", { status: 400 });
    }
    const action = input.action,
      client = input.client;
    if (
      !action ||
      !["upload", "download", "delete"].includes(action) ||
      !client ||
      !/^[a-f0-9]{64}$/.test(client)
    )
      return new Response("Invalid budget request", { status: 400 });
    const allowed = await this.state.storage.transaction(async (tx) => {
      const hour = Math.floor(Date.now() / 3600000);
      let budget = await tx.get<Budget>("budget");
      if (!budget || budget.hour !== hour)
        budget = { hour, global: empty(), clients: {} };
      if (budget.global[action] >= GLOBAL[action]) return false;
      const personal = budget.clients[client] ?? empty();
      if (personal[action] >= PER_CLIENT[action]) return false;
      // The global budgets bound successful new client entries to <=1050/hour.
      budget.global[action]++;
      personal[action]++;
      budget.clients[client] = personal;
      await tx.put("budget", budget);
      return true;
    });
    return new Response(null, { status: allowed ? 204 : 429 });
  }
}