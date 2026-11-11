const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const HANDLE = /^[A-Za-z0-9_]{1,15}$/;
const env = k => (process.env[k] || "").trim();
const cfg = () => {
  const mint = env("HAT_MINT"), fee = env("FEE_WALLET"), min = Number(env("HAT_MIN") || 100000), every = Number(env("HAT_EVERY_HOURS") || 24);
  return { mint: B58.test(mint) ? mint : null, feeWallet: B58.test(fee) ? fee : null, min: isFinite(min) && min > 0 ? min : 100000,
    every: [1, 2, 3, 4, 6, 8, 12, 24].includes(every) ? every : 24, registry: !!kvConf(), xapi: !!env("X_BEARER_TOKEN") };
};
const rpcUrl = () => env("RPC_URL") || "https://api.mainnet-beta.solana.com";
async function get(url, opt = {}, ms = 9000, raw = false) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, { redirect: "follow", ...opt, signal: ac.signal, headers: { "user-agent": "hat-site/1.0", ...(opt.headers || {}) } });
    if (!r.ok) { const e = new Error("upstream " + r.status); e.status = r.status; throw e; }
    return raw ? r : await r.json();
  } finally { clearTimeout(t); }
}
async function rpc(method, params, ms = 12000) {
  for (let i = 0; i < 3; i++) {
    try {
      const j = await get(rpcUrl(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }, ms);
      if (j.error) throw new Error("rpc " + (j.error.code || ""));
      return j.result;
    } catch (e) { if (i === 2) throw e; await new Promise(r => setTimeout(r, 250 * (i + 1))); }
  }
}
async function holdings(owner, mint) {
  const r = await rpc("getTokenAccountsByOwner", [owner, { mint }, { encoding: "jsonParsed", commitment: "confirmed" }]);
  return ((r && r.value) || []).reduce((s, a) => s + Number(((((a.account || {}).data || {}).parsed || {}).info || {}).tokenAmount ? a.account.data.parsed.info.tokenAmount.uiAmountString : 0), 0);
}
async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}
// tiny Redis-over-REST client (Vercel KV or Upstash). Nothing is stored when it isn't configured.
function kvConf() {
  const url = env("KV_REST_API_URL") || env("UPSTASH_REDIS_REST_URL"), token = env("KV_REST_API_TOKEN") || env("UPSTASH_REDIS_REST_TOKEN");
  return url && token && /^https:\/\//.test(url) ? { url: url.replace(/\/$/, ""), token } : null;
}
async function kv(cmd) {
  const c = kvConf(); if (!c) return null;
  const j = await get(c.url, { method: "POST", headers: { authorization: "Bearer " + c.token, "content-type": "application/json" }, body: JSON.stringify(cmd) }, 8000);
  if (j.error) throw new Error("kv " + j.error);
  return j.result;
}
function send(res, code, body, age = 15) {
  res.statusCode = code;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", code === 200 && age > 0 ? "public, s-maxage=" + age + ", stale-while-revalidate=" + age * 3 : "no-store");
  res.end(JSON.stringify(body));
}
module.exports = { B58, HANDLE, env, cfg, rpc, get, holdings, pool, kv, kvConf, send };
