// Web Worker do robô: pensa fora da tela principal para a interface não travar.
import { compileRules, deserializeState } from './engine.js';
import { Searcher } from './ai.js';

let workerKey = null;
let workerSearcher = null;

self.onmessage = (e) => {
  const { id, rulesKey, rules, state, hist, level } = e.data;
  try {
    if (rulesKey !== workerKey || !workerSearcher) {
      workerSearcher = new Searcher(compileRules(rules));
      workerKey = rulesKey;
    }
    const r = workerSearcher.think(deserializeState(state), hist, level);
    self.postMessage({ id, ok: true, move: r ? r.move : null, score: r ? r.score : 0, depth: r ? r.depth : 0, nodes: r ? r.nodes : 0 });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
