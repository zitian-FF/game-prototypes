// Test helper: preload with `node --import ./scripts/lib-fetch-stub.mjs` to answer fetch()
// from the file in STUB_FETCH_BODY (status from STUB_FETCH_STATUS, default 200).
import fs from 'node:fs';
globalThis.fetch = async () => new Response(fs.readFileSync(process.env.STUB_FETCH_BODY, 'utf8'), { status: Number(process.env.STUB_FETCH_STATUS ?? 200) });
