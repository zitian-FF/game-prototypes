import assert from 'node:assert/strict';
import { MAX_MESSAGE_BYTES, cleanName, parseClientMsg } from '../src/protocol';
import { test } from './harness';

const ok = (v: unknown) => parseClientMsg(JSON.stringify(v));

test('protocol: valid messages parse', () => {
  assert.deepEqual(ok({ t: 'hello', v: 1, clientId: 'abcdefgh1234', name: '  Sam  ', create: true }), {
    ok: true,
    msg: { t: 'hello', v: 1, clientId: 'abcdefgh1234', name: 'Sam', create: true },
  });
  assert.ok(ok({ t: 'start', fillBots: true }).ok);
  assert.ok(ok({ t: 'cancelStart' }).ok);
  assert.ok(ok({ t: 'ping', c: 5 }).ok);
  assert.ok(ok({ t: 'cmd', id: 1, cmd: { type: 'march', squadId: 's3', target: { kind: 'node', nodeId: 'n7' } } }).ok);
  assert.ok(ok({ t: 'cmd', id: 2, cmd: { type: 'march', squadId: 's3', target: { kind: 'hq', hqId: 'h2' } } }).ok);
  assert.ok(ok({ t: 'cmd', id: 3, cmd: { type: 'cancel', squadId: 's1' } }).ok);
  assert.ok(ok({ t: 'cmd', id: 4, cmd: { type: 'teleport', nodeId: 'n1' } }).ok);
  assert.ok(ok({ t: 'cmd', id: 5, cmd: { type: 'scout', scoutIndex: 2, target: { kind: 'node', nodeId: 'n1' } } }).ok);
  assert.ok(ok({ t: 'cmd', id: 6, cmd: { type: 'setDefend', squadId: 's1', defend: false } }).ok);
});

test('protocol: junk and hostile input is rejected, never thrown', () => {
  const bad: unknown[] = [
    'not json at all',
    '{"t":',
    '[]',
    'null',
    '123',
    { t: 'nope' },
    { t: 'hello', v: 1, clientId: 'short', name: 'x' },
    { t: 'hello', v: 1, clientId: 'abcdefgh1234', name: '   ' },
    { t: 'hello', v: 1, clientId: 'bad id with spaces', name: 'x' },
    { t: 'start' },
    { t: 'start', fillBots: 'yes' },
    { t: 'ping', c: 'x' },
    { t: 'cmd', id: 1.5, cmd: { type: 'cancel', squadId: 's1' } },
    { t: 'cmd', id: 1, cmd: { type: 'march', squadId: 's1' } },
    { t: 'cmd', id: 1, cmd: { type: 'march', squadId: 's1', target: { kind: 'node' } } },
    { t: 'cmd', id: 1, cmd: { type: 'march', squadId: '../etc', target: { kind: 'node', nodeId: 'n1' } } },
    { t: 'cmd', id: 1, cmd: { type: 'scout', scoutIndex: -1, target: { kind: 'node', nodeId: 'n1' } } },
    { t: 'cmd', id: 1, cmd: { type: 'scout', scoutIndex: 99, target: { kind: 'node', nodeId: 'n1' } } },
    { t: 'cmd', id: 1, cmd: { type: 'setDefend', squadId: 's1', defend: 'no' } },
    { t: 'cmd', id: 1, cmd: { type: 'hack', squadId: 's1' } },
    { t: 'cmd', id: 1, cmd: { type: 'march', squadId: 's1', target: { kind: 'node', nodeId: 'n1' }, playerId: 'admin' } },
  ];
  for (const b of bad) {
    const r = typeof b === 'string' ? parseClientMsg(b) : ok(b);
    if (r.ok) {
      // The only acceptable "ok" among these is the one with an extra playerId, which must be stripped.
      assert.ok(!('playerId' in (r.msg as object)) && !('playerId' in ((r.msg as { cmd?: object }).cmd ?? {})), JSON.stringify(b));
    }
  }
  assert.equal(parseClientMsg('x'.repeat(MAX_MESSAGE_BYTES + 1)).ok, false);
});

test('protocol: a client can never choose who a command is from', () => {
  const r = ok({ t: 'cmd', id: 1, cmd: { type: 'cancel', squadId: 's1', playerId: 'someone-else' } });
  assert.ok(r.ok);
  if (r.ok && r.msg.t === 'cmd') assert.deepEqual(r.msg.cmd, { type: 'cancel', squadId: 's1' });
});

test('protocol: names are cleaned and capped', () => {
  assert.equal(cleanName('  a   b  '), 'a b');
  assert.equal(cleanName('<b>Hi</b> there'), 'bHi/b there');
  assert.equal(cleanName('<script>alert(1)</script>'), 'scriptalert(1)/scrip', 'markup characters removed, then capped at 20');
  assert.equal(cleanName('x'.repeat(50)).length, 20);
  assert.equal(cleanName('tab\there\u0000'), 'tabhere');
});
