// fetch someone's current X picture and read the hat band out of it
const { env, get } = require("./_lib");
const { readBand } = require("./_code");
let sharp = null; try { sharp = require("sharp"); } catch (e) {}
const PBS = /^https:\/\/pbs\.twimg\.com\/profile_images\//;
async function avatarUrl(handle) {
  const tok = env("X_BEARER_TOKEN");
  if (tok) {
    const j = await get("https://api.x.com/2/users/by/username/" + encodeURIComponent(handle) + "?user.fields=profile_image_url", { headers: { authorization: "Bearer " + tok } });
    if (!j.data) { const e = new Error("no such account"); e.status = 404; throw e; }
    const u = String(j.data.profile_image_url || "").replace(/_normal(\.\w+)$/, "_400x400$1");
    if (!PBS.test(u)) throw new Error("no picture");
    return u;
  }
  return "https://unavatar.io/x/" + encodeURIComponent(handle) + "?fallback=false";
}
async function readPfp(handle) {
  if (!sharp) throw new Error("image reader missing");
  const url = await avatarUrl(handle);
  const r = await get(url, {}, 9000, true);
  const type = r.headers.get("content-type") || "";
  if (!/^image\//.test(type)) throw new Error("not an image");
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 5e6) throw new Error("too big");
  const raw = await sharp(buf).resize(400, 400, { fit: "fill" }).removeAlpha().raw().toBuffer();
  return { band: readBand(raw, 400, 400), source: PBS.test(url) ? "x" : "unavatar" };
}
module.exports = { readPfp, avatarUrl };
