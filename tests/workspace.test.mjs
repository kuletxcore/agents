import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

// Real Worker routing, D1 transactions and KV; never contact a model provider.
test('private workspace and Keeper approval lifecycle', async t => {
  const { outputFiles } = await build({ entryPoints: ['worker/index.ts'], bundle: true, format: 'esm', write: false });
  const options = { modules: true, script: outputFiles[0].text, compatibilityDate: '2026-11-01',
    d1Databases: ['DB'], kvNamespaces: ['CONFIG'], bindings: { WORKSPACE_MODE: 'private', WORKSPACE_PASSWORD: 'test-only' } };
  const mf = new Miniflare(convertV4MiniflareOptions(options));
  t.after(() => mf.dispose());
  const auth = { authorization: `Basic ${btoa('operator:test-only')}` };
  const request = (path, body, headers = auth) => mf.dispatchFetch(`https://workspace.test${path}`, {
    headers: { ...headers, 'content-type': 'application/json' }, method: body === undefined ? 'GET' : 'POST', body: JSON.stringify(body),
  });
  assert.equal((await request('/api/runs', undefined, {})).status, 401);
  assert.equal((await request('/', undefined, {})).status, 401);
  assert.equal((await request('/api/runs', {}, { ...auth, origin: 'https://other.test' })).status, 403);
  assert.equal((await request('/api/runs', {goal: 42})).status, 400);
  const db = await mf.getD1Database('DB');
  const countDocs = () => db.prepare('SELECT count(*) AS n FROM documents').first('n');
  for (const approve of [true, false]) {
    const initial = await countDocs();
    const started = await request('/api/runs', {agentId:'keeper', goal:'Review memory and missions'});
    assert.equal(started.status, 200);
    const { run } = await started.json();
    const path = `/api/runs/${run.id}`;
    // Read the persisted trace independently, just as a reopened tab would.
    const detail = await (await request(path)).json();
    assert.equal(detail.run.status, 'waiting');
    const pending = detail.steps.find(s => s.status === 'pending');
    assert.equal(pending.tool, 'document_write');
    const decide = `${path}/steps/${pending.id}`;
    assert.equal((await request(decide, {})).status, 400);
    assert.equal(await countDocs(), initial);
    const responses = await Promise.all([request(decide, {approve}), request(decide, {approve})]);
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
    const final = await (await request(path)).json();
    assert.equal(final.run.status, 'done');
    assert.equal(final.steps.find(s => s.id === pending.id).status, approve ? 'ok' : 'denied');
    assert.equal(await countDocs(), initial + Number(approve));
  }
  const action = await db.prepare('SELECT id, status FROM mission_actions LIMIT 1').first();
  assert.equal((await request(`/api/missions/missing/actions/${action.id}`, { status:'blocked' })).status, 404);
  assert.equal(await db.prepare('SELECT status FROM mission_actions WHERE id=?').bind(action.id).first('status'), action.status);
});
