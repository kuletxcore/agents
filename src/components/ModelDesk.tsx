import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, operatorToken, setOperatorToken, type Health } from '../lib/api';
import './model-desk.css';

const recipes = [
  ['OpenAI', 'https://api.openai.com/v1', 'gpt-4o-mini'],
  ['Anthropic', 'https://api.anthropic.com/v1', '<your-claude-model-id>'],
  ['Gemini', 'https://generativelanguage.googleapis.com/v1beta/openai', '<your-gemini-model-id>'],
  ['OpenRouter', 'https://openrouter.ai/api/v1', '<publisher/model>'],
  ['Custom', '<your-compatible-base-url>', '<served-model-id>'],
];
export default function ModelDesk({health, onHealth}: {health: Health | null; onHealth: (h: Health) => void}) {
  const [pick, setPick] = useState(0);
  const [name, base, model] = recipes[pick];
  const [token, setToken] = useState(operatorToken);
  const [notice, setNotice] = useState('');
  const [checking, setChecking] = useState(false);
  const recipe = `LLM_PROTOCOL=${name === 'Anthropic' ? 'anthropic' : 'openai'}\nLLM_BASE_URL=${base}\nLLM_MODEL=${model}\nLLM_API_KEY=<provider-key>\nOPERATOR_TOKEN=<random-operator-token>`;
  async function check(value: string) {
    setChecking(true);
    try {
      setOperatorToken(value.trim());
      const h = await api<Health>('/api/health'); onHealth(h);
      setNotice(h.llm === 'live' ? 'Tab authorized. No model request was made.' : h.llm === 'gated' ? 'Tab locked. Check the operator token.' : 'Demo mode. Configure the Worker and restart it.');
    } catch { setNotice('Could not check authorization. Retry when the Worker is reachable.'); }
    finally { setChecking(false); }
  }
  return <section className="model-desk"><header><span className="model-code">RUNTIME / MODEL CONNECTION</span><h2>Bring your own model.</h2><p>Choose the engine. Keep the same tools, trace, and approval step.</p></header>
    <div className="model-panels"><div><h3><b>01</b> Configure the Worker</h3><label>Provider recipe <select value={pick} onChange={e => {setPick(Number(e.target.value)); setNotice('');}}>{recipes.map(([n],i) => <option key={n} value={i}>{n}</option>)}</select></label>
    <p>Fill these placeholders in your local <code>.dev.vars</code> and restart. For a deployment, use Worker secrets. Choosing a recipe does not switch the running model.</p><pre>{recipe}</pre><button onClick={async () => {try {await navigator.clipboard.writeText(recipe);setNotice('Template copied. Replace the placeholders on the Worker.');} catch {setNotice('Clipboard unavailable. Select and copy the template above.');}}}>Copy template</button></div>
    <div><h3><b>02</b> Authorize this tab</h3><p>Use the operator token, not your provider key. Checking authorization does not spend tokens.</p><label>Operator token<input type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} /></label>
    <div className="model-actions"><button disabled={checking} onClick={() => void check(token)}>{checking ? 'Checking…' : 'Check authorization'}</button><button disabled={checking} onClick={() => {setToken('');void check('');}}>Clear</button></div>
    <div className="model-status"><span className="model-code">WORKER GATE</span><strong>{!health ? 'Unknown' : { live:'Authorized', gated:'Token required', demo:'Scripted demo' }[health.llm]}</strong></div><Link to="/runs">Open agent runs →</Link><p>Runs need a tool-calling model. Text-only models can power chat.</p></div></div><p role="status" className="model-notice">{notice}</p></section>;
}
