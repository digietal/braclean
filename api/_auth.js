// Login do painel: os pares usuario:senha ficam na variável PAINEL_LOGINS (Vercel → Settings → Environment Variables).
const crypto = require('crypto');

const COOKIE = 'painel_sessao';
const DURACAO_S = 7 * 24 * 3600; // sessão vale 7 dias

function logins() {
  // Aceita o valor colado com aspas, espaços ou quebras de linha por engano.
  return String(process.env.PAINEL_LOGINS || '')
    .replace(/["'“”‘’`]/g, '')
    .split(/[,;\n]/)
    .map((par) => par.trim())
    .filter(Boolean)
    .map((par) => {
      const i = par.indexOf(':');
      return i > 0 ? { usuario: par.slice(0, i).trim(), senha: par.slice(i + 1).trim() } : null;
    })
    .filter(Boolean);
}

// Chave de assinatura derivada das variáveis secretas: trocar uma senha derruba as sessões abertas.
function segredo() {
  return crypto.createHash('sha256')
    .update('painel|' + (process.env.PAINEL_LOGINS || '') + '|' + (process.env.VERCEL_TOKEN || ''))
    .digest();
}

function assinar(texto) {
  return crypto.createHmac('sha256', segredo()).update(texto).digest('base64url');
}

function iguais(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function conferir(usuario, senha) {
  return logins().some((l) => iguais(l.usuario.toLowerCase(), String(usuario || '').trim().toLowerCase()) && iguais(l.senha, String(senha || '').trim()));
}

function criarSessao(usuario) {
  const exp = Math.floor(Date.now() / 1000) + DURACAO_S;
  const corpo = Buffer.from(JSON.stringify({ u: usuario, exp })).toString('base64url');
  return corpo + '.' + assinar(corpo);
}

function lerCookie(req) {
  const linha = req.headers.cookie || '';
  const m = linha.split(/;\s*/).find((c) => c.startsWith(COOKIE + '='));
  return m ? decodeURIComponent(m.slice(COOKIE.length + 1)) : '';
}

// Devolve o usuário logado, ou null. A sessão cai se o usuário sair do PAINEL_LOGINS.
function sessao(req) {
  const valor = lerCookie(req);
  const [corpo, ass] = valor.split('.');
  if (!corpo || !ass || !iguais(assinar(corpo), ass)) return null;
  try {
    const { u, exp } = JSON.parse(Buffer.from(corpo, 'base64url').toString());
    if (!u || !exp || exp < Date.now() / 1000) return null;
    if (!logins().some((l) => l.usuario.toLowerCase() === String(u).toLowerCase())) return null;
    return u;
  } catch {
    return null;
  }
}

function cookieSessao(valor, maxAge) {
  return `${COOKIE}=${encodeURIComponent(valor)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

module.exports = { conferir, criarSessao, sessao, cookieSessao, DURACAO_S };
