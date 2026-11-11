const { B58, HANDLE, cfg, holdings, kv, send } = require("./_lib");
const { codeFor } = require("./_code");
const { readPfp } = require("./_pfp");
module.exports = async (req, res) => {
  const q = req.query || {}, handle = String(q.handle || "").replace(/^@/, "").trim(), wallet = String(q.wallet || "").trim();
  if (!HANDLE.test(handle)) return send(res, 400, { error: "That isn't an X handle." });
  if (!B58.test(wallet)) return send(res, 400, { error: "That isn't a Solana wallet address." });
  const c = cfg(), want = codeFor(wallet).hex, out = { handle, wallet, code: want, min: c.min, t: Date.now() };
  // one check per handle per minute when the registry is on
  try { if (c.registry && (await kv(["SET", "hat:cool:" + handle.toLowerCase(), "1", "EX", "60", "NX"])) === null) return send(res, 429, { error: "Checked a moment ago. Try again in a minute." }); } catch (e) {}
  const [h, p] = await Promise.allSettled([c.mint ? holdings(wallet, c.mint) : Promise.resolve(null), readPfp(handle)]);
  out.holds = h.status === "fulfilled" ? h.value : null; out.holdsError = h.status === "rejected";
  out.enough = out.holds == null ? null : out.holds >= c.min;
  if (p.status === "fulfilled") {
    const b = p.value.band;
    out.found = b && b.valid ? b.hex : null; out.hat = !!b; out.wearing = !!(b && b.valid && b.hex === want);
    out.mismatch = !!(b && b.valid && b.hex !== want);
  } else { out.pfpError = p.reason && p.reason.status === 404 ? "no such account" : "couldn't read the picture right now"; out.wearing = null; }
  // join or update the registry
  out.registered = false;
  if (c.registry && out.wearing && out.enough) {
    try {
      const key = handle.toLowerCase(), prev = await kv(["HGET", "hat:members", key]); const old = prev ? JSON.parse(prev) : null;
      await kv(["HSET", "hat:members", key, JSON.stringify({ handle, wallet, holds: out.holds, joined: old && old.wallet === wallet ? old.joined : Date.now(), checked: Date.now(), ok: 1 })]);
      out.registered = true;
    } catch (e) { out.registryError = true; }
  } else if (c.registry && out.wearing === false) {
    try { const key = handle.toLowerCase(), prev = await kv(["HGET", "hat:members", key]); if (prev) { const o = JSON.parse(prev); o.ok = 0; o.checked = Date.now(); await kv(["HSET", "hat:members", key, JSON.stringify(o)]); } } catch (e) {}
  }
  send(res, 200, out, 0);
};
