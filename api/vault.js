const { cfg, rpc, pool, send } = require("./_lib");
module.exports = async (req, res) => {
  const c = cfg();
  if (!c.feeWallet) return send(res, 200, { live: false }, 60);
  try {
    const w = c.feeWallet;
    const [bal, sigs] = await Promise.all([rpc("getBalance", [w, { commitment: "confirmed" }]), rpc("getSignaturesForAddress", [w, { limit: 30 }])]);
    const ok = (sigs || []).filter(s => !s.err && s.blockTime);
    const rows = (await pool(ok, 8, async s => {
      try {
        const tx = await rpc("getTransaction", [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }]);
        if (!tx || !tx.meta) return null;
        const keys = tx.transaction.message.accountKeys.map(k => (typeof k === "string" ? k : k.pubkey)); const i = keys.indexOf(w);
        const d = i < 0 ? 0 : (tx.meta.postBalances[i] - tx.meta.preBalances[i]) / 1e9;
        const ins = [...tx.transaction.message.instructions, ...((tx.meta.innerInstructions || []).flatMap(x => x.instructions))];
        const to = new Set();
        for (const x of ins) if (x.program === "system" && x.parsed && x.parsed.type === "transfer" && x.parsed.info.source === w) to.add(x.parsed.info.destination);
        return { s: s.signature, t: s.blockTime, d: Math.round(d * 1e6) / 1e6, n: to.size };
      } catch (e) { return null; }
    })).filter(Boolean);
    send(res, 200, { live: true, t: Date.now(), wallet: w, bal: (bal && typeof bal.value === "number" ? bal.value : 0) / 1e9, rows }, 120);
  } catch (e) { send(res, 502, { live: true, error: "solana unavailable" }); }
};
