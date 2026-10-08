import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const bundle = await build({ entryPoints: ['prototypes/punchies/src/sim/tune.ts'], bundle: true, platform: 'node', format: 'esm', write: false, loader: { '.json': 'json' } });
const { validateTuneJson, tune } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const meta = JSON.parse(readFileSync('prototypes/punchies/tune.meta.json', 'utf8'));

const live = JSON.parse(JSON.stringify(tune));
assert.equal(validateTuneJson(JSON.stringify(live)).ok, true, 'the shipped tune must validate');

// Every numeric value in tune.json has a range and sits inside it.
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : typeof v === 'number' ? [[`${p}${k}`, v]] : []));
for (const [k, v] of flat(live)) {
  assert.ok(meta[k] && typeof meta[k].min === 'number' && typeof meta[k].max === 'number', `${k} has no range in tune.meta.json`);
  assert.ok(v >= meta[k].min && v <= meta[k].max, `${k}=${v} is outside ${meta[k].min}..${meta[k].max}`);
}

const [key, value] = flat(live)[0];
const withValue = (v) => {
  const copy = JSON.parse(JSON.stringify(live));
  const parts = key.split('.');
  let o = copy;
  for (const p of parts.slice(0, -1)) o = o[p];
  o[parts.at(-1)] = v;
  return JSON.stringify(copy);
};
const reject = (label, json, part) => {
  const r = validateTuneJson(json);
  assert.equal(r.ok, false, `${label} must be rejected`);
  if (part) assert.match(r.error, part, label);
};
reject('above max', withValue(meta[key].max + 1), /out of range/);
reject('below min', withValue(meta[key].min - 1), /out of range/);
reject('wrong type', withValue(String(value)), /wrong type/);
reject('null value', withValue(null), /wrong type/);
reject('infinite number', withValue('__INF__').replace('"__INF__"', '1e999'), /not a finite number/);
reject('malformed JSON', '{"punches":', /not valid JSON/);
reject('array root', '[]', /not an object/);
reject('null root', 'null', /not an object/);
reject('object where number expected', withValue({ x: 1 }), /wrong type/);
assert.equal(validateTuneJson('{"notARealKey":123}').ok, true, 'unknown keys are ignored, not applied');
assert.equal(validateTuneJson('{}').ok, true, 'a partial tune is allowed');
console.log('PASS: tune guard accepts the shipped tune, rejects malformed, wrong-typed and out-of-range values, and every tune.json value has a range.');
