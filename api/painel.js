// Dados do painel: junta Zernio (Instagram) e Vercel (biosite). Só responde para quem está logado.
const { sessao } = require('./_auth');

const CFG = {
  inicio: '2026-11-26',
  zernioPerfil: '6b088328d419694bb7f9df7a',
  zernioConta: '6b0883a1f9e8dc59c64c817a',
  vercelProjeto: 'prj_YxW8sDsyJe36RnebjV7Er8YITn7X',
  vercelTime: 'team_LVHhiU9XR81HL6wOWjpbc4iH'
};
const CACHE_MS = 3 * 60 * 1000;
let cache = { em: 0, dados: null };

// Tira aspas, espaços e um "Bearer" colado junto por engano.
const limpar = (t) => String(t || '').replace(/["'“”‘’`\s]/g, '').replace(/^Bearer/i, '');

async function pegar(url, token, nome) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 12000);
  let r;
  try { r = await fetch(url, { headers: { Authorization: 'Bearer ' + limpar(token) }, signal: ctl.signal }); }
  catch (e) { throw new Error(nome + ': sem resposta (' + (e.name === 'AbortError' ? 'demorou demais' : e.message) + ')'); }
  finally { clearTimeout(t); }
  const texto = await r.text();
  let json;
  try { json = JSON.parse(texto); } catch { json = null; }
  if (!r.ok) {
    const msg = (json && (json.error && (json.error.message || json.error))) || (json && json.message) || ('HTTP ' + r.status);
    throw new Error(nome + ': ' + msg);
  }
  return json;
}

const ymd = (d) => d.toISOString().slice(0, 10);

async function vercel(params) {
  const q = new URLSearchParams({ projectId: CFG.vercelProjeto, teamId: CFG.vercelTime });
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((x) => q.append(k, x)); else q.set(k, v);
  }
  const j = await pegar('https://api.vercel.com/v1/query/web-analytics/visits/aggregate?' + q, process.env.VERCEL_TOKEN, 'Vercel');
  return (j && j.data) || [];
}

async function zernio(caminho) {
  return pegar('https://zernio.com/api/v1' + caminho, process.env.ZERNIO_API_KEY, 'Zernio');
}

async function montar() {
  const desde = CFG.inicio + 'T00:00:00-03:00';
  const ate = new Date(Date.now() + 365 * 864e5).toISOString();
  const hoje = new Date();
  let ini30 = new Date(hoje.getTime() - 29 * 864e5);
  if (ymd(ini30) < CFG.inicio) ini30 = new Date(CFG.inicio + 'T03:00:00Z');

  const tarefas = {
    paginas: vercel({ by: ['requestPath'], since: desde, until: ate, limit: '50' }),
    diaVisitas: vercel({ by: ['day'], filter: "requestPath eq '/'", since: ymd(ini30) + 'T00:00:00-03:00', until: hoje.toISOString(), limit: '100' }),
    diaCliques: vercel({ by: ['day'], filter: "startswith(requestPath, '/ir/') and requestPath ne '/ir/site_oficial'", since: ymd(ini30) + 'T00:00:00-03:00', until: hoje.toISOString(), limit: '100' }),
    aparelhos: vercel({ by: ['deviceType'], filter: "requestPath eq '/'", since: desde, until: ate, limit: '10' }),
    automacoes: zernio('/comment-automations?profileId=' + CFG.zernioPerfil),
    posts: zernio('/analytics?profileId=' + CFG.zernioPerfil + '&fromDate=' + CFG.inicio + '&source=late&limit=40'),
    seguidores: zernio('/accounts/follower-stats?accountIds=' + CFG.zernioConta + '&fromDate=' + CFG.inicio)
  };
  const nomes = Object.keys(tarefas);
  const res = await Promise.allSettled(Object.values(tarefas));
  const r = {}; const erros = {};
  res.forEach((x, i) => { if (x.status === 'fulfilled') r[nomes[i]] = x.value; else erros[nomes[i]] = String(x.reason && x.reason.message || x.reason); });

  const num = (v) => (v == null || v === '') ? 0 : (+v || 0);

  const paginas = (r.paginas || []).map((p) => ({ pagina: p.requestPath, visitantes: num(p.visitors) }));
  const home = paginas.find((p) => p.pagina === '/');
  const botoes = paginas.filter((p) => /^\/ir\/[^/]+/.test(p.pagina))
    .map((p) => ({ botao: p.pagina.split('/')[2], cliques: p.visitantes }))
    .sort((a, b) => b.cliques - a.cliques);
  const lojas = botoes.filter((b) => b.botao !== 'site_oficial').reduce((s, b) => s + b.cliques, 0);

  const autos = ((r.automacoes && r.automacoes.automations) || []).map((a) => {
    const s = a.stats || {};
    return { nome: a.name, comentarios: num(s.triggered), gateEnviado: num(s.followGateSent), gateLiberado: num(s.followGatePassed), links: num(s.dmsSent), cliquesUnicos: num(s.uniqueClicks) };
  });
  const soma = (k) => autos.reduce((t, a) => t + a[k], 0);

  const posts = ((r.posts && r.posts.posts) || []).map((p) => {
    const a = p.analytics || {};
    return {
      titulo: String(p.content || '').split('\n')[0].slice(0, 70),
      publicado: String(p.publishedAt || '').slice(0, 10),
      url: /^https:\/\//.test(p.platformPostUrl || '') ? p.platformPostUrl : '',
      views: num(a.views != null ? a.views : (a.plays != null ? a.plays : a.impressions)),
      curtidas: num(a.likes), comentarios: num(a.comments), compartilhamentos: num(a.shares), salvos: num(a.saves)
    };
  });

  const conta = ((r.seguidores && r.seguidores.accounts) || [])[0] || null;

  const cl = new Map((r.diaCliques || []).map((d) => [String(d.timestamp).slice(0, 10), num(d.pageviews)]));
  const dias = (r.diaVisitas || []).map((d) => {
    const dia = String(d.timestamp).slice(0, 10);
    return { dia, visitantes: num(d.visitors), cliques: cl.get(dia) || 0 };
  }).filter((d) => d.dia <= ymd(hoje));

  const funil = [
    { etapa: 'Views dos vídeos', valor: posts.reduce((t, p) => t + p.views, 0) },
    { etapa: 'Comentaram ADITIVO', valor: soma('comentarios') },
    { etapa: 'Receberam o link no direct', valor: soma('links') },
    { etapa: 'Clicaram no link do direct', valor: soma('cliquesUnicos') },
    { etapa: 'Visitantes no biosite', valor: home ? home.visitantes : 0 },
    { etapa: 'Cliques pra comprar', valor: lojas }
  ];

  return {
    atualizadoEm: new Date().toISOString(),
    inicio: CFG.inicio,
    funil,
    seguidores: conta ? { atual: num(conta.currentFollowers), crescimento: num(conta.growth) } : null,
    gate: { enviado: soma('gateEnviado'), liberado: soma('gateLiberado') },
    botoes,
    aparelhos: (r.aparelhos || []).map((d) => ({ aparelho: d.deviceType || 'desconhecido', visitantes: num(d.visitors) })),
    dias,
    automacoes: autos,
    posts,
    erros
  };
}

module.exports.montar = montar;
module.exports.pegar = pegar;
module.exports.handler = async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  const usuario = sessao(req);
  if (!usuario) return res.status(401).json({ erro: 'Faça login.' });
  const faltando = ['ZERNIO_API_KEY', 'VERCEL_TOKEN'].filter((k) => !process.env[k]);
  if (faltando.length) return res.status(500).json({ erro: 'Faltam variáveis na Vercel: ' + faltando.join(', ') });
  try {
    if (!cache.dados || Date.now() - cache.em > CACHE_MS) cache = { em: Date.now(), dados: await montar() };
    return res.status(200).json({ usuario, ...cache.dados });
  } catch (e) {
    return res.status(502).json({ erro: String(e.message || e) });
  }
};

module.exports = Object.assign(module.exports.handler, { montar, pegar });
