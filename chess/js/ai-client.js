// Conversa com o robô. Usa um Web Worker; se o navegador não permitir,
// pensa na própria página (com menos tempo, para não travar demais).
import { compileRules, serializeState, deserializeState } from './engine.js';
import { Searcher, LEVELS } from './ai.js';

export function createAI() {
  let worker = null;
  let workerFailed = false;
  let seq = 0;
  const pending = new Map();
  let localSearcher = null;
  let localKey = null;

  function thinkLocal(job) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          if (localKey !== job.rulesKey || !localSearcher) {
            localSearcher = new Searcher(compileRules(job.rules));
            localKey = job.rulesKey;
          }
          const level = { ...job.level, timeMs: Math.min(job.level.timeMs, 1200) };
          const r = localSearcher.think(deserializeState(job.state), job.hist, level);
          resolve({ move: r ? r.move : null, score: r ? r.score : 0, depth: r ? r.depth : 0, nodes: r ? r.nodes : 0 });
        } catch (err) {
          reject(err);
        }
      }, 30);
    });
  }

  function failAll() {
    workerFailed = true;
    worker = null;
    const jobs = [...pending.values()];
    pending.clear();
    jobs.forEach((p) => thinkLocal(p.job).then(p.resolve, p.reject));
  }

  function getWorker() {
    if (worker || workerFailed) return worker;
    try {
      const inline = typeof document !== 'undefined' && document.getElementById('ai-worker-src');
      if (inline) {
        const url = URL.createObjectURL(new Blob([inline.textContent], { type: 'text/javascript' }));
        worker = new Worker(url);
      } else {
        worker = new Worker(new URL('./ai-worker.js', import.meta.url), { type: 'module' });
      }
      worker.onmessage = (e) => {
        const p = pending.get(e.data.id);
        if (!p) return;
        pending.delete(e.data.id);
        if (e.data.ok) p.resolve(e.data);
        else p.reject(new Error(e.data.error));
      };
      worker.onerror = (ev) => {
        if (ev && ev.preventDefault) ev.preventDefault();
        failAll();
      };
    } catch (err) {
      workerFailed = true;
      worker = null;
    }
    return worker;
  }

  return {
    // level: 'easy' | 'medium' | 'hard' ou objeto {timeMs, maxDepth, noise}
    think(rules, rulesKey, S, hist, level) {
      const job = { rules, rulesKey, state: serializeState(S), hist, level: typeof level === 'string' ? LEVELS[level] : level };
      const w = getWorker();
      if (!w) return thinkLocal(job);
      return new Promise((resolve, reject) => {
        const id = ++seq;
        pending.set(id, { resolve, reject, job });
        try {
          w.postMessage({ id, ...job });
        } catch (err) {
          pending.delete(id);
          thinkLocal(job).then(resolve, reject);
        }
      });
    },
    // Interrompe o que o robô estiver pensando
    cancel() {
      if (worker && pending.size) {
        worker.terminate();
        worker = null;
      }
      const jobs = [...pending.values()];
      pending.clear();
      jobs.forEach((p) => p.reject(new Error('cancelado')));
    },
    get usingWorker() {
      return !!worker && !workerFailed;
    },
  };
}
