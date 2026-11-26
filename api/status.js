// Diagnóstico sem dados: diz só se cada fonte responde (sim/não) e o motivo do erro. Não mostra números nem chaves.
const painel = require('./painel');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const limpo = (k) => String(process.env[k] || '').replace(/["'“”‘’`\s]/g, '').replace(/^Bearer/i, '');
  // Só o formato (tamanho e começo), nunca o valor.
  const vars = Object.fromEntries(['PAINEL_LOGINS', 'ZERNIO_API_KEY', 'VERCEL_TOKEN'].map((k) => [k, { preenchida: Boolean(process.env[k]), tamanho: limpo(k).length }]));
  vars.ZERNIO_API_KEY.comecaComSk = limpo('ZERNIO_API_KEY').startsWith('sk_');
  vars.VERCEL_TOKEN.pareceChaveZernio = limpo('VERCEL_TOKEN').startsWith('sk_');
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
