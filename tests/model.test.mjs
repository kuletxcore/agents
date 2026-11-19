import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveTurn } from '../worker/kernel/model.ts';

const env = { LLM_BASE_URL:'https://model.invalid/v1/', LLM_API_KEY:'fixture-key', LLM_MODEL:'fixture-model' };
const messages = [{role:'system', content:'Stay in scope.'}, {role:'user', content:'Read the notes.'}];
const tool = {name:'read_notes', description:'Read notes', parameters:{type:'object',properties:{}}};
test('compatible chat keeps the legacy bearer protocol and omits tools for text models', async t => {
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'https://model.invalid/v1/chat/completions');
    assert.equal(init.headers.authorization, 'Bearer fixture-key');
    const body = JSON.parse(init.body); assert.deepEqual(body.messages, messages); assert.ok(!('tools' in body));
    return Response.json({choices:[{message:{content:'Ready.'}}],usage:{prompt_tokens:4,completion_tokens:2}});
  });
  assert.deepEqual(await liveTurn(env,messages,[]),{content:'Ready.',toolCalls:[],tokensIn:4,tokensOut:2});
});
test('native Messages preserves tool IDs, grouped results, system prompt and usage', async t => {
  const use = { type:'tool_use', id:'c1', name:'read_notes', input:{} };
  const use2 = {...use,id:'c2'};
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    const body = JSON.parse(init.body);
    assert.equal(url,'https://model.invalid/v1/messages'); assert.equal(init.headers['x-api-key'],'fixture-key'); assert.ok(!init.headers.authorization);
    assert.equal(body.system,messages[0].content); assert.deepEqual(body.tools[0].input_schema,tool.parameters);
    if (++calls === 1) return Response.json({content:[use,use2],usage:{input_tokens:3,output_tokens:7}});
    assert.deepEqual(body.messages[1],{role:'assistant',content:[use,use2]});
    assert.deepEqual(body.messages[2].content.map(b => b.tool_use_id), ['c1','c2']);
    return Response.json({content:[{type:'text',text:'Done.'}]});
  });
  const native = {...env, LLM_PROTOCOL:'anthropic'};
  const turn = await liveTurn(native,messages,[tool]); assert.equal(turn.tokensOut,7);
  const next = [...messages,{role:'assistant',content:null,tool_calls:turn.toolCalls},...turn.toolCalls.map(c => ({role:'tool',tool_call_id:c.id,content:'{}'}))];
  assert.equal((await liveTurn(native,next,[tool])).content,'Done.');
});
test('provider errors do not expose response bodies in public traces', async t => {
  t.mock.method(globalThis,'fetch',async () => new Response('sensitive detail',{status:401}));
  await assert.rejects(liveTurn(env,messages,[]),e => /401/.test(e.message) && !e.message.includes('sensitive'));
});
