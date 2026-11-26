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

  const corpo = await lerCorpo(req);
  const { usuario, senha } = corpo;
  console.log('[login] tentativa', JSON.stringify({ temUsuario: Boolean(usuario), temSenha: Boolean(senha), tipoCorpo: typeof req.body, contentType: req.headers['content-type'] || '' }));
  if (!conferir(usuario, senha)) {
    console.log('[login] recusado: usuário ou senha não conferem');
    await new Promise((r) => setTimeout(r, 800)); // freia tentativas em sequência
    return res.status(401).json({ erro: 'Usuário ou senha incorretos.' });
  }
  const token = criarSessao(String(usuario).trim());
  res.setHeader('Set-Cookie', cookieSessao(token, DURACAO_S));
  console.log('[login] aceito', JSON.stringify({ assinatura: token.split('.')[1].slice(0, 6) }));
  return res.status(200).json({ ok: true, token });
  return res.status(200).json({ ok: true });
};
