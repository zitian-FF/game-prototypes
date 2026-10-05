// The few Cloudflare runtime types this Worker uses, declared locally so the
// repo does not need @cloudflare/workers-types just for them.

interface DurableObjectStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put(entries: Record<string, unknown>): Promise<void>;
  put(key: string, value: unknown): Promise<void>;
  delete(keys: string[]): Promise<number>;
  delete(key: string): Promise<boolean>;
  deleteAll(): Promise<void>;
  list<T = unknown>(options?: { prefix?: string; start?: string; end?: string; limit?: number }): Promise<Map<string, T>>;
  setAlarm(scheduledTime: number): Promise<void>;
  deleteAlarm(): Promise<void>;
}

interface CfWebSocket extends WebSocket {
  serializeAttachment(value: unknown): void;
  deserializeAttachment(): unknown;
}

interface DurableObjectState {
  readonly storage: DurableObjectStorage;
  acceptWebSocket(ws: WebSocket, tags?: string[]): void;
  getWebSockets(tag?: string): CfWebSocket[];
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;
}

interface DurableObjectNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(request: Request): Promise<Response> };
}

declare class WebSocketPair {
  0: WebSocket;
  1: WebSocket;
}
