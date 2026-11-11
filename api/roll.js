const { cfg, kv, send } = require("./_lib");
module.exports = async (req, res) => {
  const c = cfg();
  if (!c.registry) return send(res, 200, { registry: false }, 60);
  try {
    const flat = (await kv(["HGETALL", "hat:members"])) || [], members = [];
    for (let i = 0; i + 1 < flat.length; i += 2) { try { const m = JSON.parse(flat[i + 1]); members.push({ handle: m.handle, wallet: m.wallet, holds: m.holds, joined: m.joined, checked: m.checked, ok: !!m.ok }); } catch (e) {} }
    members.sort((a, b) => b.ok - a.ok || b.holds - a.holds);
    let round = null; try { const r = await kv(["GET", "hat:round"]); round = r ? JSON.parse(r) : null; } catch (e) {}
    send(res, 200, { registry: true, t: Date.now(), members, round: round && { t: round.t, pot: round.pot, count: round.list.length } }, 30);
  } catch (e) { send(res, 502, { registry: true, error: "registry unavailable" }); }
};
