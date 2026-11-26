// Diagnóstico sem dados: diz só se cada fonte responde (sim/não) e o motivo do erro. Não mostra números nem chaves.
const painel = require('./painel');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const vars = Object.fromEntries(['PAINEL_LOGINS', 'ZERNIO_API_KEY', 'VERCEL_TOKEN'].map((k) => [k, Boolean(process.env[k])]));
  const inicio = Date.now();
  let fontes = {};
  try {
    const d = await painel.montar();
    fontes = { ok: Object.keys(d.erros || {}).length === 0, erros: d.erros };
  } catch (e) {
    fontes = { ok: false, erro: String(e.message || e) };
  }
  res.status(200).json({ variaveis: vars, fontes, ms: Date.now() - inicio });
};
