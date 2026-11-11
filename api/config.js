const { cfg, send } = require("./_lib");
module.exports = (req, res) => send(res, 200, cfg(), 60);
