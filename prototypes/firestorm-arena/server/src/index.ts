import type { ArenaGame } from "arena-sim";

interface MatchStub {
  fetch(request: Request): Promise<Response>;
}

interface MatchNamespace {
  idFromName(name: string): object;
  get(id: object): MatchStub;
}

interface Env {
  MATCH_ROOMS: MatchNamespace;
}

const ROOM_CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true, service: "firestorm-arena-server" }), {
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    const room = url.pathname.match(/^\/ws\/([ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5})$/)?.[1];
    if (!room || !ROOM_CODE.test(room)) {
      return new Response("Not found", { status: 404 });
    }

    if (request.method !== "GET" || request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected a WebSocket upgrade", { status: 426 });
    }

    const id = env.MATCH_ROOMS.idFromName(room);
    return env.MATCH_ROOMS.get(id).fetch(request);
  },
};

/**
 * The SQLite-backed class and binding are declared in wrangler.jsonc.
 * Claude will add the match protocol and persist/restore ArenaGame in the
 * next server milestone. Keep this starter intentionally empty.
 */
export class ArenaMatch {
  private game: ArenaGame | null = null;

  constructor(_state: unknown, _env: Env) {}

  async fetch(_request: Request): Promise<Response> {
    // The route is wired, but the WebSocket protocol is not implemented yet.
    return new Response("Firestorm match protocol is not implemented yet.", { status: 501 });
  }
}
