/* Roteador por hash (#/rota) com guarda de acesso.
   access: 'private' (exige login) | 'guest' (só sem login) | 'public' (qualquer um)
   roles: ['gerente'] / ['doador'] (opcional). A mesma rota pode existir para perfis diferentes.
   view({params,user}) devolve { html, mount?(root) } ou { redirect: '/rota' }. */
(function (HC) {
  'use strict';
  const routes = [], root = () => document.getElementById('app');

  function add(path, def) {
    const keys = [], re = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$');
    routes.push({ ...def, re, keys });
  }
  const current = () => location.hash.slice(1).split('?')[0] || '/login';
  const go = (path) => { if (location.hash === '#' + path) render(); else location.hash = path; };

  /** Perfil -> tela inicial depois do login. */
  const home = (user) => (user && user.perfil === 'gerente' ? '/dashboard' : '/alertas');

  /** Acha a rota que casa com o endereço E é permitida ao perfil. {denied:true} = existe, mas não para este perfil. */
  function resolve(path, user) {
    const hits = [];
    for (const r of routes) {
      const m = path.match(r.re);
      if (m) hits.push({ r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) });
    }
    if (!hits.length) return null;
    return hits.find((x) => !x.r.roles || (user && x.r.roles.includes(user.perfil))) || { denied: true };
  }

  function render() {
    const user = HC.api.currentUser(), hit = resolve(current(), user);
    if (!hit) return go('/404');
    if (hit.denied) return go(user ? home(user) : '/login');
    if (hit.r.access === 'private' && !user) return go('/login');
    if (hit.r.access === 'guest' && user) return go(home(user));

    const out = hit.r.view({ params: hit.params, user });
    if (out.redirect) return go(out.redirect);

    root().innerHTML = String(out.html);
    document.title = `${hit.r.title} – Alerta Hemocentro`;
    out.mount?.(root());
    window.scrollTo(0, 0);
    const heading = root().querySelector('h1,h2'); // leitores de tela anunciam a nova tela
    if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
  }

  HC.router = { add, go, home, start() { window.addEventListener('hashchange', render); render(); } };
})(window.HC = window.HC || {});
