const STORAGE_KEY = 'donkey-kong-high-scores';
let entries = [];
let runId = null;
try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? '[]');
    if (Array.isArray(saved)) entries = saved.filter(entry => entry &&
        typeof entry.id === 'string' && Number.isFinite(entry.score) && entry.score > 0)
        .map(entry => ({ id: entry.id, score: Math.floor(entry.score), name: 'MARIO' }))
        .sort((a, b) => b.score - a.score).slice(0, 5);
} catch { /* Keep scores in memory when browser storage is unavailable. */ }

export function beginScoreRun() {
    runId = `${Date.now()}-${Math.random()}`;
}

export function getHighScores() {
    return entries.map(entry => ({ ...entry }));
}

export function recordScore(score) {
    if (!Number.isFinite(score) || score <= 0) return;
    if (!runId) beginScoreRun();
    const previous = entries.find(entry => entry.id === runId);
    const best = Math.max(previous?.score ?? 0, Math.floor(score));
    entries = [...entries.filter(entry => entry.id !== runId), { id: runId, score: best, name: 'MARIO' }]
        .sort((a, b) => b.score - a.score).slice(0, 5);
    try { globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(entries)); } catch { /* In-memory fallback. */ }
}
