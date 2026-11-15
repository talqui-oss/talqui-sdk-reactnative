import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { buildChatUrl, commandScript, isTalquiPush, normalizeMeta, parseEvent, USER_HASH_PATTERN } from '../src/protocol.ts';

const fixtures = JSON.parse(readFileSync(new URL('../bridge-fixtures/v1.json', import.meta.url), 'utf8'));
const TENANT = 'a0047199-8537-4f7d-bef8-2fae04a7ffd6';
const CONNECTION = 'a575c54c-4f0e-49e9-87c1-1b80df59e9df';

test('the URL carries everything in the fragment, never in the query string', () => {
  const url = buildChatUrl({ baseUrl: 'https://webchat.talqui.chat/', tenantId: TENANT, connectionId: CONNECTION, identity: null });
  const [beforeHash, fragment] = url.split('#');
  assert.equal(beforeHash, 'https://webchat.talqui.chat/');
  const query = new URLSearchParams(fragment.split('?')[1]);
  assert.equal(query.get('T_ID'), TENANT);
  assert.equal(query.get('PC_ID'), CONNECTION);
  assert.equal(query.get('EMBED'), '1');
  assert.match(query.get('SDK') ?? '', /^react-native@\d+\.\d+\.\d+$/);
  assert.equal(query.has('A_ID') || query.has('S_ID'), false);
});

test('an anonymous identity goes as A_ID, an identified one as S_ID', () => {
  const anon = buildChatUrl({ baseUrl: 'https://x.test', tenantId: TENANT, connectionId: CONNECTION, identity: { kind: 'anonymous', id: 'device-0001' } });
  const user = buildChatUrl({ baseUrl: 'https://x.test', tenantId: TENANT, connectionId: CONNECTION, identity: { kind: 'identified', id: 'a'.repeat(64) } });
  assert.match(anon, /A_ID=device-0001/);
  assert.doesNotMatch(anon, /S_ID/);
  assert.match(user, new RegExp(`S_ID=${'a'.repeat(64)}`));
  assert.doesNotMatch(user, /A_ID/);
});

test('a command is delivered as a string literal: nothing in the payload runs as code', () => {
  let received: string | null = null;
  const window = { TalquiBridge: { receive: (json: string) => (received = json) } };
  const payload = { text: '"); alert(1); (" </script>' };
  new Function('window', commandScript('prefill', payload, 'c-1'))(window);
  assert.deepEqual(JSON.parse(received!), { talqui: 1, kind: 'command', name: 'prefill', id: 'c-1', payload });
});

test('every valid fixture command has the envelope this SDK builds', () => {
  for (const message of fixtures.commands.valid) {
    let received: string | null = null;
    new Function('window', commandScript(message.name, message.payload, message.id))({ TalquiBridge: { receive: (json: string) => (received = json) } });
    assert.deepEqual(JSON.parse(received!), message);
  }
});

test('every fixture event is read back with its name and payload', () => {
  for (const event of fixtures.events) {
    assert.deepEqual(parseEvent(JSON.stringify(event)), { name: event.name, payload: event.payload });
  }
});

test('anything that is not a v1 event is ignored', () => {
  assert.equal(parseEvent('not json'), null);
  assert.equal(parseEvent('null'), null);
  assert.equal(parseEvent(JSON.stringify({ talqui: 2, kind: 'event', name: 'ready', payload: {} })), null);
  assert.equal(parseEvent(JSON.stringify({ talqui: 1, kind: 'command', name: 'ready', payload: {} })), null);
  assert.deepEqual(parseEvent(JSON.stringify({ talqui: 1, kind: 'event', name: 'closeRequested' })), { name: 'closeRequested', payload: {} });
});

test('metadata is normalized, and what cannot be fixed is dropped with a warning', () => {
  const warnings: string[] = [];
  const out = normalizeMeta(
    { Plan: 'pro', 'Order Id': 4821, vip: true, gone: null, long: 'x'.repeat(300), nested: { a: 1 } as never, 'a.b': 'x', constructor: 'x' },
    (message) => warnings.push(message),
  );
  assert.deepEqual(out, { plan: 'pro', order_id: '4821', vip: 'true', gone: null, long: 'x'.repeat(255) });
  assert.ok(warnings.some((w) => w.includes('"Plan" was sent as "plan"')));
  assert.ok(warnings.some((w) => w.includes('"nested" ignored')));
  assert.ok(warnings.some((w) => w.includes('"a.b" ignored')));
  assert.ok(warnings.some((w) => w.includes('"constructor" ignored')));
  assert.deepEqual(normalizeMeta('nope' as never, () => undefined), {});
});

test('userHash must look like a hash, not a raw id', () => {
  assert.ok(USER_HASH_PATTERN.test('f'.repeat(64)));
  assert.ok(!USER_HASH_PATTERN.test('123'));
  assert.ok(!USER_HASH_PATTERN.test('user@example.com'.padEnd(40, 'x')));
});

test('recognizes only Talqui push messages', () => {
  assert.equal(isTalquiPush({ talqui: '1', tenantId: TENANT }), true);
  assert.equal(isTalquiPush({ talqui: 1 }), false);
  assert.equal(isTalquiPush({ type: 'promo' }), false);
  assert.equal(isTalquiPush(undefined), false);
});
