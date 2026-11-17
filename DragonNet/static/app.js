'use strict';

// CONFIGURATION SUPABASE

const SUPABASE_URL =
  'https://hkwnfxgrnyvyfprzvlyb.supabase.co';

const SUPABASE_KEY =
  'sb_publishable_hzBek5ZmTxpaNZcQiDPwgA_i4Lhv3o0';

const BUCKET = 'dragon-photos';

const $ = id => document.getElementById(id);

let publicArticles = [];
let moderationArticles = [];
let adminAuth = null;
let previewUrls = [];

const openComments = new Set();

const isAdmin = () => !!adminAuth?.accessToken;

function show(id, value) {
  $(id).classList.toggle('hidden', !value);
}

function node(tag, text, cls) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = String(text);
  if (cls) n.className = cls;
  return n;
}

function notice(message) {
  $('notice').textContent = String(message);
  $('notice').style.display = 'block';
}

function dateText(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date inconnue'
    : date.toLocaleString('fr-FR');
}

function secretTitle(value) {
  return String(value).normalize('NFC').trim() ===
    '©JJCookieLabs-Administration';
}

const PATH_RE =
  /^posts\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|gif)$/;

function cleanPaths(data) {
  return Array.isArray(data?.photos)
    ? data.photos.filter(p =>
        typeof p === 'string' && PATH_RE.test(p)
      ).slice(0, 3)
    : [];
}

function photoUrl(path) {
  return SUPABASE_URL +
    '/storage/v1/object/public/' +
    BUCKET + '/' + path;
}

// APPELS SUPABASE

async function api(path, {
  method = 'GET',
  body,
  token
} = {}) {
  const headers = {
    apikey: SUPABASE_KEY,
    Accept: 'application/json'
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  let response;

  try {
    response = await fetch(SUPABASE_URL + path, {
      method,
      headers,
      body: body === undefined
        ? undefined
        : JSON.stringify(body)
    });
  } catch (e) {
    throw Error('Supabase inaccessible : ' + e.message);
  }

  const raw = await response.text();
  let result;

  try {
    result = raw ? JSON.parse(raw) : null;
  } catch {
    result = raw;
  }

  if (!response.ok) {
    const error = Error(
      result?.message ||
      result?.msg ||
      result?.error_description ||
      result?.error ||
      'HTTP ' + response.status
    );

    error.status = response.status;
    error.code = result?.code;
    throw error;
  }

  return result;
}

function publicRpc(name, params) {
  return api('/rest/v1/rpc/' + name, {
    method: 'POST',
    body: params
  });
}

// AUTHENTIFICATION ADMIN

function setAdminAuth(tokens) {
  if (!tokens?.access_token) {
    throw Error('Jeton administrateur absent');
  }

  adminAuth = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() +
      (Number(tokens.expires_in) || 3600) * 1000
  };
}

function forgetAdmin() {
  adminAuth = null;
  moderationArticles = [];

  show('adminPanel', false);

  $('adminArticles').replaceChildren();
  $('adminComments').replaceChildren();
  $('password').value = '';
  $('status').textContent = 'Connecté · accès public';
}

async function refreshToken() {
  if (!adminAuth?.refreshToken) {
    throw Error('Session expirée');
  }

  const tokens = await api(
    '/auth/v1/token?grant_type=refresh_token',
    {
      method: 'POST',
      body: {
        refresh_token: adminAuth.refreshToken
      }
    }
  );

  setAdminAuth(tokens);
}

async function authorized(path, options = {}) {
  if (!adminAuth) {
    throw Error('Connexion administrateur nécessaire');
  }

  if (Date.now() >= adminAuth.expiresAt - 30000) {
    try {
      await refreshToken();
    } catch {
      forgetAdmin();
      throw Error('Session expirée. Reconnecte-toi.');
    }
  }

  try {
    return await api(path, {
      ...options,
      token: adminAuth.accessToken
    });
  } catch (e) {
    if (e.status === 401 && e.code !== '42501') {
      try {
        await refreshToken();

        return await api(path, {
          ...options,
          token: adminAuth.accessToken
        });
      } catch {
        forgetAdmin();
        throw Error('Session expirée. Reconnecte-toi.');
      }
    }

    throw e;
  }
}

function adminRpc(name, params) {
  return authorized('/rest/v1/rpc/' + name, {
    method: 'POST',
    body: params
  });
}

async function loginAdmin() {
  const email = $('email').value.trim();
  const password = $('password').value;

  if (!email || !password) {
    throw Error('E-mail ou mot de passe manquant');
  }

  const tokens = await api(
    '/auth/v1/token?grant_type=password',
    {
      method: 'POST',
      body: { email, password }
    }
  );

  const allowed = await api(
    '/rest/v1/rpc/dragon_is_admin',
    {
      method: 'POST',
      body: {},
      token: tokens.access_token
    }
  );

  if (allowed !== true) {
    throw Error('Ce compte ne possède pas le rôle admin');
  }

  setAdminAuth(tokens);

  $('password').value = '';
  show('adminLogin', false);
  show('adminPanel', true);

  await Promise.all([
    loadArticles(),
    loadModeration()
  ]);

  $('status').textContent = 'Connecté · administrateur';
  notice('Administration activée !');

  $('adminPanel').scrollIntoView({
    behavior: 'smooth'
  });
}

// PHOTOS

function fileExt(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();

  const allowed = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/gif': ['gif']
  };

  return allowed[file.type]?.includes(ext) ? ext : null;
}

function validatePhotos(files) {
  if (files.length > 3) {
    throw Error('Maximum 3 photos');
  }

  for (const file of files) {
    if (!fileExt(file)) {
      throw Error('Format autorisé : JPG, JPEG, PNG ou GIF');
    }

    if (file.size > 3145728 || file.size === 0) {
      throw Error('Chaque photo doit faire entre 1 octet et 3 Mo');
    }
  }
}

function clearPreview() {
  for (const url of previewUrls) {
    URL.revokeObjectURL(url);
  }

  previewUrls = [];
  $('preview').replaceChildren();
}

$('photos').addEventListener('change', () => {
  clearPreview();

  const files = [...$('photos').files];

  try {
    validatePhotos(files);
  } catch (e) {
    $('photos').value = '';
    return notice(e.message);
  }

  for (const file of files) {
    const url = URL.createObjectURL(file);
    previewUrls.push(url);

    const img = node('img');
    img.src = url;
    img.alt = file.name;

    $('preview').append(img);
  }
});

async function uploadPhoto(file) {
  const path =
    'posts/' + crypto.randomUUID() + '.' + fileExt(file);

  const response = await fetch(
    SUPABASE_URL +
    '/storage/v1/object/' +
    BUCKET + '/' + path,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        'Content-Type': file.type,
        'x-upsert': 'false'
      },
      body: file
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw Error(data.message || 'Téléversement refusé');
  }

  return path;
}

function appendPhotos(parent, data) {
  const paths = cleanPaths(data);
  if (!paths.length) return;

  const gallery = node('div', undefined, 'photos');

  for (const path of paths) {
    const link = node('a');
    link.href = photoUrl(path);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    const img = node('img');
    img.src = photoUrl(path);
    img.loading = 'lazy';
    img.alt = 'Photo jointe';

    link.append(img);
    gallery.append(link);
  }

  parent.append(gallery);
}

// ARTICLES

async function loadArticles() {
  publicArticles = await api(
    '/rest/v1/dragon_documents' +
    '?select=id,data,created_at' +
    '&kind=eq.article' +
    '&order=created_at.desc' +
    '&limit=500'
  );

  renderArticles();

  $('status').textContent = isAdmin()
    ? 'Connecté · administrateur'
    : 'Connecté · accès public';
}

function renderArticles() {
  const search = $('search').value.trim().toLowerCase();
  const category = $('filter').value;

  const categories = [...new Set(
    publicArticles.map(a => a.data?.category).filter(Boolean)
  )].sort();

  $('filter').replaceChildren(
    new Option('Toutes', ''),
    ...categories.map(c => new Option(c, c))
  );

  $('filter').value = category;

  let articles = publicArticles.filter(a => {
    const d = a.data || {};

    return (!category || d.category === category)
      && (!search || [d.title, d.name, d.content].some(
        v => String(v || '').toLowerCase().includes(search)
      ));
  });

  if ($('order').value === 'old') {
    articles = [...articles].reverse();
  }

  $('count').textContent = articles.length + ' article(s)';
  $('articleGrid').replaceChildren();

  if (!articles.length) {
    $('articleGrid').append(node('p', 'Aucun article.'));
  }

  for (const article of articles) {
    const d = article.data || {};
    const card = node('article', undefined, 'article');

    const meta = node(
      'div',
      `${d.name || 'Anonyme'} · ${d.category || 'Général'} · ${dateText(article.created_at)}`,
      'meta'
    );

    if (d.author_admin === true) {
      meta.append(node('span', '✓ ADMIN', 'admin-badge'));
    }

    card.append(
      node('h3', d.title || 'Sans titre'),
      meta,
      node('p', d.content || '')
    );

    appendPhotos(card, d);
    appendComments(card, article);

    $('articleGrid').append(card);
  }
}

// COMMENTAIRES PUBLICS

function appendComments(card, article) {
  const comments = Array.isArray(article.data?.comments)
    ? article.data.comments
    : [];

  const details = node('details', undefined, 'comments');
  details.open = openComments.has(article.id);

  details.addEventListener('toggle', () => {
    if (details.open) openComments.add(article.id);
    else openComments.delete(article.id);
  });

  details.append(
    node('summary', `💬 Commentaires (${comments.length})`)
  );

  const list = node('div', undefined, 'comment-list');

  if (!comments.length) {
    list.append(node('small', 'Aucun commentaire.'));
  }

  for (const c of comments) {
    const item = node('div', undefined, 'comment');

    item.append(
      node('b', c.name || 'Anonyme'),
      node('span',
        c.created_at ? ' · ' + dateText(c.created_at) : '',
        'comment-date'
      ),
      node('p', c.content || '')
    );

    list.append(item);
  }

  details.append(list);

  const form = node('form', undefined, 'comment-form');

  const name = node('input');
  name.placeholder = 'Ton pseudonyme';
  name.maxLength = 60;
  name.value = $('author').value.trim() || 'Anonyme';

  const body = node('textarea');
  body.maxLength = 1500;
  body.placeholder = 'Écris un commentaire…';

  const send = node('button', 'Envoyer');
  send.type = 'submit';

  form.append(
    node('label', 'Pseudonyme'),
    name,
    node('label', 'Commentaire'),
    body,
    send
  );

  form.onsubmit = async event => {
    event.preventDefault();

    const content = body.value.trim();
    if (!content) return notice('Commentaire vide');

    send.disabled = true;

    try {
      await publicRpc('dragon_add_comment', {
        p_article_id: article.id,
        p_name: name.value.trim() || 'Anonyme',
        p_content: content
      });

      openComments.add(article.id);

      await loadArticles();

      if (isAdmin()) {
        await loadModeration();
      }

      notice('Commentaire publié !');
    } catch (e) {
      notice('Commentaire : ' + e.message);
    } finally {
      send.disabled = false;
    }
  };

  details.append(form);
  card.append(details);
}

// MODÉRATION DES ARTICLES

async function loadModeration() {
  if (!isAdmin()) return;

  moderationArticles = await authorized(
    '/rest/v1/dragon_documents' +
    '?select=id,data,created_at' +
    '&kind=eq.article' +
    '&order=created_at.desc' +
    '&limit=500'
  );

  renderModeration();
  renderAdminComments();
}

function renderModeration() {
  if (!isAdmin()) return;

  const visibleCount = moderationArticles.filter(
    a => a.data?.hidden !== true
  ).length;

  $('statVisible').textContent = visibleCount;
  $('statHidden').textContent =
    moderationArticles.length - visibleCount;

  const search = $('adminSearch').value.trim().toLowerCase();
  const filter = $('adminFilter').value;

  const articles = moderationArticles.filter(a => {
    const d = a.data || {};
    const hidden = d.hidden === true;

    if (filter === 'hidden' && !hidden) return false;
    if (filter === 'visible' && hidden) return false;

    return !search || [d.title, d.name, d.content].some(
      v => String(v || '').toLowerCase().includes(search)
    );
  });

  $('adminArticles').replaceChildren();

  for (const article of articles) {
    const d = article.data || {};
    const hidden = d.hidden === true;

    const card = node('div', undefined, 'article');

    card.append(
      node('h3', d.title || 'Sans titre'),
      node('p', d.content || ''),
      node('span', hidden ? 'Masqué' : 'Visible', 'tag')
    );

    const actions = node('div', undefined, 'actions');

    const toggle = node(
      'button',
      hidden ? 'Réafficher' : 'Masquer',
      'secondary'
    );

    toggle.onclick = async () => {
      toggle.disabled = true;

      try {
        await adminRpc('dragon_set_hidden', {
          p_id: article.id,
          p_hidden: !hidden
        });

        await Promise.all([
          loadModeration(),
          loadArticles()
        ]);

        notice(hidden ? 'Article réaffiché' : 'Article masqué');
      } catch (e) {
        notice(e.message);
      } finally {
        toggle.disabled = false;
      }
    };

    const del = node('button', 'Supprimer', 'danger');

    del.onclick = async () => {
      if (!confirm('Supprimer définitivement cet article ?')) {
        return;
      }

      del.disabled = true;

      try {
        await adminRpc('dragon_delete_article', {
          p_id: article.id
        });

        await Promise.all([
          loadModeration(),
          loadArticles()
        ]);

        notice('Article supprimé');
      } catch (e) {
        notice(e.message);
      } finally {
        del.disabled = false;
      }
    };

    actions.append(toggle, del);
    card.append(actions);
    $('adminArticles').append(card);
  }

  if (!articles.length) {
    $('adminArticles').append(
      node('p', 'Aucun article dans ce filtre.')
    );
  }
}

// NOUVELLE MODÉRATION DES COMMENTAIRES

function renderAdminComments() {
  if (!isAdmin()) return;

  const articleSelect = $('adminCommentArticle');
  const previous = articleSelect.value;

  articleSelect.replaceChildren(
    new Option('Tous les articles', '')
  );

  const withComments = moderationArticles.filter(
    a => Array.isArray(a.data?.comments) && a.data.comments.length
  );

  for (const article of withComments) {
    articleSelect.append(
      new Option(article.data?.title || 'Sans titre', article.id)
    );
  }

  articleSelect.value =
    [...articleSelect.options].some(o => o.value === previous)
      ? previous
      : '';

  const chosen = articleSelect.value;
  const status = $('adminCommentStatus').value;
  const search = $('adminCommentSearch').value.trim().toLowerCase();
  const sort = $('adminCommentSort').value;

  const all = [];

  for (const article of moderationArticles) {
    const comments = Array.isArray(article.data?.comments)
      ? article.data.comments
      : [];

    for (const comment of comments) {
      all.push({ article, comment });
    }
  }

  const filtered = all.filter(({ article, comment }) => {
    if (chosen && article.id !== chosen) return false;

    const hidden = article.data?.hidden === true;

    if (status === 'hidden' && !hidden) return false;
    if (status === 'visible' && hidden) return false;

    const text = [
      comment.name,
      comment.content,
      article.data?.title
    ].join(' ').toLowerCase();

    return !search || text.includes(search);
  });

  filtered.sort((a, b) => {
    const x = Date.parse(a.comment.created_at) || 0;
    const y = Date.parse(b.comment.created_at) || 0;
    return sort === 'old' ? x - y : y - x;
  });

  $('adminCommentCount').textContent =
    `${filtered.length} commentaire(s) sur ${all.length}`;

  $('adminComments').replaceChildren();

  if (!filtered.length) {
    $('adminComments').append(
      node('p', 'Aucun commentaire dans ce filtre.')
    );
    return;
  }

  for (const { article, comment } of filtered.slice(0, 500)) {
    const card = node('div', undefined, 'comment-admin-card');

    card.append(
      node(
        'div',
        'Article : ' + (article.data?.title || 'Sans titre'),
        'comment-parent'
      ),
      node(
        'div',
        (comment.name || 'Anonyme') +
          ' · ' + dateText(comment.created_at),
        'meta'
      ),
      node('p', comment.content || '')
    );

    if (article.data?.hidden === true) {
      card.append(node('span', 'Article masqué', 'tag'));
    }

    const del = node(
      'button',
      'Supprimer ce commentaire',
      'danger'
    );

    if (!comment.id) {
      del.disabled = true;
      del.title =
        'Ancien commentaire sans identifiant individuel';
    } else {
      del.onclick = async () => {
        if (!confirm('Supprimer définitivement ce commentaire ?')) {
          return;
        }

        del.disabled = true;

        try {
          await adminRpc('dragon_delete_comment', {
            p_article_id: article.id,
            p_comment_id: comment.id
          });

          await Promise.all([
            loadModeration(),
            loadArticles()
          ]);

          notice('Commentaire supprimé !');
        } catch (e) {
          notice('Suppression : ' + e.message);
        } finally {
          del.disabled = false;
        }
      };
    }

    card.append(del);
    $('adminComments').append(card);
  }
}

// PUBLICATION

$('publishForm').onsubmit = async event => {
  event.preventDefault();

  const title = $('title').value.trim();

  if (secretTitle(title)) {
    show('adminLogin', true);
    $('adminLogin').scrollIntoView({
      behavior: 'smooth'
    });
    return;
  }

  const name = $('author').value.trim() || 'Anonyme';
  const category = $('category').value.trim();
  const content = $('content').value.trim();
  const files = [...$('photos').files];

  if (!title || !category || !content) {
    return notice('Remplis le titre, la catégorie et le contenu');
  }

  try {
    validatePhotos(files);
  } catch (e) {
    return notice(e.message);
  }

  const button = $('publishButton');
  button.disabled = true;

  try {
    const paths = [];

    for (const file of files) {
      paths.push(await uploadPhoto(file));
    }

    const params = {
      p_name: name,
      p_title: title,
      p_content: content,
      p_category: category,
      p_photo_paths: paths
    };

    if (isAdmin()) {
      await authorized(
        '/rest/v1/rpc/dragon_publish_with_photos',
        {
          method: 'POST',
          body: params
        }
      );
    } else {
      await publicRpc('dragon_publish_with_photos', params);
    }

    $('title').value = '';
    $('content').value = '';
    $('photos').value = '';

    clearPreview();

    await loadArticles();
    if (isAdmin()) await loadModeration();

    notice('Article publié !');
    location.hash = 'articles';
  } catch (e) {
    notice('Publication : ' + e.message);
  } finally {
    button.disabled = false;
  }
};

// BOUTONS

$('login').onclick = async () => {
  $('login').disabled = true;

  try {
    await loginAdmin();
  } catch (e) {
    notice('Connexion : ' + e.message);
  } finally {
    $('login').disabled = false;
  }
};

$('logout').onclick = async () => {
  forgetAdmin();
  await loadArticles();
  notice('Déconnecté');
};

$('closeLogin').onclick = () => show('adminLogin', false);

$('reload').onclick = () =>
  loadArticles().catch(e => notice(e.message));

$('refreshAdmin').onclick = () =>
  loadModeration().catch(e => notice(e.message));

$('refreshComments').onclick = () =>
  loadModeration().catch(e => notice(e.message));

for (const id of ['search', 'filter', 'order']) {
  $(id).addEventListener(
    id === 'search' ? 'input' : 'change',
    renderArticles
  );
}

for (const id of ['adminSearch', 'adminFilter']) {
  $(id).addEventListener(
    id === 'adminSearch' ? 'input' : 'change',
    renderModeration
  );
}

for (const id of [
  'adminCommentSearch',
  'adminCommentArticle',
  'adminCommentStatus',
  'adminCommentSort'
]) {
  $(id).addEventListener(
    id === 'adminCommentSearch' ? 'input' : 'change',
    renderAdminComments
  );
}

// NAVIGATION

function activeLink() {
  const current = location.hash || '#articles';

  document.querySelectorAll('nav a[href^="#"]').forEach(link => {
    link.classList.toggle('active', link.hash === current);
  });
}

window.addEventListener('hashchange', activeLink);
activeLink();

// DÉMARRAGE

loadArticles().catch(e => {
  $('status').textContent = 'Connexion indisponible';
  notice('Chargement : ' + e.message);
});
