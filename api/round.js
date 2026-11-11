// the payout round: re-check every member (picture + holdings) and return who gets what. Needs ROUND_KEY.
const { cfg, env, kv, rpc, holdings, pool, send } = require("./_lib");
const { codeFor } = require("./_code");
const { readPfp } = require("./_pfp");
const RESERVE = 0.01;
module.exports = async (req, res) => {
  const key = env("ROUND_KEY"), c = cfg();
  if (!key || (req.headers || {})["x-round-key"] !== key) return send(res, 401, { error: "not allowed" });
  if (!c.registry || !c.mint || !c.feeWallet) return send(res, 400, { error: "set HAT_MINT, FEE_WALLET and the registry first" });
  const flat = (await kv(["HGETALL", "hat:members"])) || [], ms = [];
  for (let i = 0; i + 1 < flat.length; i += 2) { try { ms.push(JSON.parse(flat[i + 1])); } catch (e) {} }
  const seen = new Set();
  const checked = await pool(ms, 4, async m => {
    try {
      const [h, p] = await Promise.all([holdings(m.wallet, c.mint), readPfp(m.handle)]);
      const ok = h >= c.min && p.band && p.band.valid && p.band.hex === codeFor(m.wallet).hex;
      m.holds = h; m.ok = ok ? 1 : 0; m.checked = Date.now();
    } catch (e) { m.ok = 0; m.checked = Date.now(); m.err = 1; }
    await kv(["HSET", "hat:members", m.handle.toLowerCase(), JSON.stringify(m)]);
    return m;
  });
  const wearers = checked.filter(m => m.ok && !seen.has(m.wallet) && seen.add(m.wallet));
  const bal = ((await rpc("getBalance", [c.feeWallet, { commitment: "confirmed" }])) || {}).value / 1e9 || 0;
  const pot = Math.max(0, bal - RESERVE), total = wearers.reduce((s, m) => s + m.holds, 0);
  const list = wearers.map(m => ({ handle: m.handle, wallet: m.wallet, holds: m.holds, share: total ? m.holds / total : 0, sol: total ? Math.floor(pot * m.holds / total * 1e6) / 1e6 : 0 }));
  const round = { t: Date.now(), pot, total, list };
  await kv(["SET", "hat:round", JSON.stringify(round)]);
  send(res, 200, round, 0);
};
