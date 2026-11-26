const { conferir, criarSessao, cookieSessao, DURACAO_S } = require('./_auth');

async function lerCorpo(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', cookieSessao('', 0));
    return res.status(200).json({ ok: true });
  }
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  if (!process.env.PAINEL_LOGINS) return res.status(500).json({ erro: 'Nenhum login configurado no painel.' });

  const { usuario, senha } = await lerCorpo(req);
  if (!conferir(usuario, senha)) {
    await new Promise((r) => setTimeout(r, 800)); // freia tentativas em sequência
    return res.status(401).json({ erro: 'Usuário ou senha incorretos.' });
  }
  res.setHeader('Set-Cookie', cookieSessao(criarSessao(String(usuario).trim()), DURACAO_S));
  return res.status(200).json({ ok: true });
};
