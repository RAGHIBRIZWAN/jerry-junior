// Simple admin panel. No build step. Runs only at http://localhost:5001
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

let currency = 'PKR';
const money = (n) => `${currency} ${Number(n || 0).toLocaleString('en-US')}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '');
// Photos live on Cloudinary; ask it for a smaller version to keep the panel fast.
const CLD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/;
const thumb = (src, w = 400) => {
  const m = CLD.exec(src || '');
  return m ? `${m[1]}c_limit,w_${w},f_auto,q_auto/${m[2]}` : src || '';
};
const safeUrl = (u) => (/^(https?:\/\/|blob:)/.test(u || '') ? u : '');

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function api(path, { method = 'GET', body, form } = {}) {
  const headers = { 'x-admin-ui': '1' };
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`/admin/api${path}`, { method, headers, body: payload, credentials: 'same-origin' });
  } catch {
    throw new ApiError('Cannot reach the server. Is the backend running?', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/login') {
    showLogin();
    throw new ApiError(data.error || 'Please log in', 401, data);
  }
  if (!res.ok) throw new ApiError(data.error || `Error ${res.status}`, res.status, data);
  return data;
}

let toastTimer;
function toast(msg, type = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), type === 'error' ? 7000 : 3500);
}

// ---------------- Auth ----------------
function showLogin() {
  $('#app-view').classList.add('hidden');
  $('#login-view').classList.remove('hidden');
}

async function showApp() {
  const me = await api('/me');
  currency = me.currency || 'PKR';
  $('#shop-name').textContent = me.shopName;
  document.title = `${me.shopName} Admin`;
  $$('.currency').forEach((el) => (el.textContent = currency));
  $('#login-view').classList.add('hidden');
  $('#app-view').classList.remove('hidden');
  loadOrders();
  loadProducts();
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  $('#login-error').textContent = '';
  try {
    await api('/login', { method: 'POST', body: { username: f.get('username'), password: f.get('password') } });
    e.target.reset();
    await showApp();
  } catch (err) {
    $('#login-error').textContent = err.message;
  }
});

$('#logout').addEventListener('click', async () => {
  await api('/logout', { method: 'POST' }).catch(() => {});
  showLogin();
});

// ---------------- Tabs ----------------
$$('.tab').forEach((btn) =>
  btn.addEventListener('click', () => {
    $$('.tab').forEach((b) => b.classList.toggle('active', b === btn));
    for (const name of ['orders', 'products', 'banners']) $(`#${name}-tab`).classList.toggle('hidden', btn.dataset.tab !== name);
    if (btn.dataset.tab === 'orders') loadOrders();
    if (btn.dataset.tab === 'banners') loadBanners();
  })
);

// ---------------- Orders ----------------
let orderFilter = '';
let orders = [];

$$('.chip[data-status]').forEach((chip) =>
  chip.addEventListener('click', () => {
    orderFilter = chip.dataset.status;
    $$('.chip[data-status]').forEach((c) => c.classList.toggle('active', c === chip));
    loadOrders();
  })
);
$('#refresh-orders').addEventListener('click', () => loadOrders());

async function loadOrders() {
  try {
    const data = await api(`/orders${orderFilter ? `?status=${orderFilter}` : ''}`);
    orders = data.orders;
    const counts = data.counts || {};
    const all = Object.values(counts).reduce((a, b) => a + b, 0);
    $('[data-count="all"]').textContent = all ? `(${all})` : '';
    for (const s of ['pending', 'confirmed', 'cancelled']) {
      $(`[data-count="${s}"]`).textContent = counts[s] ? `(${counts[s]})` : '';
    }
    const badge = $('#pending-badge');
    badge.textContent = counts.pending || '';
    badge.classList.toggle('hidden', !counts.pending);
    renderOrders();
  } catch (err) {
    if (err.status !== 401) toast(err.message, 'error');
  }
}

function renderOrders() {
  $('#orders-empty').classList.toggle('hidden', orders.length > 0);
  $('#orders-body').innerHTML = orders.map(orderRow).join('');
}

function orderRow(o) {
  const c = o.customer;
  const items = o.items
    .map(
      (it) => `<li>
        ${safeUrl(thumb(it.image)) ? `<img src="${esc(safeUrl(thumb(it.image)))}" alt="" loading="lazy">` : ''}
        <span>${esc(it.title)}${it.size ? ` <b>(${esc(it.size)})</b>` : ''} &times; ${it.quantity}<br>
        <span class="muted small">${money(it.price * it.quantity)}</span></span>
      </li>`
    )
    .join('');

  let actions = '';
  if (o.status === 'pending') {
    actions = `
      <button class="btn btn-green" data-action="confirm" data-id="${o._id}">Confirm order</button>
      <button class="btn btn-red btn-sm" data-action="cancel" data-id="${o._id}">Cancel</button>`;
  } else if (o.status === 'confirmed') {
    actions = `<span class="sent">&#10003; Confirmed<br>${fmtDate(o.confirmedAt)}</span>
      <button class="btn btn-red btn-sm" data-action="cancel" data-id="${o._id}">Cancel order</button>`;
  }
  actions += `<a class="btn btn-wa btn-sm" href="${esc(o.buyerWhatsappUrl)}" target="_blank" rel="noopener">Open WhatsApp chat</a>`;

  return `<tr class="${o.status}">
    <td><b>${esc(o.orderNumber)}</b><br><span class="muted small">${fmtDate(o.createdAt)}</span></td>
    <td><b>${esc(c.name)}</b><br>${esc(c.phone)}</td>
    <td>${esc(c.address)}${c.city ? `<br>${esc(c.city)}` : ''}${c.notes ? `<br><span class="muted small">Note: ${esc(c.notes)}</span>` : ''}</td>
    <td><ul class="items">${items}</ul></td>
    <td><b>${money(o.total)}</b></td>
    <td><span class="status ${o.status}">${o.status}</span></td>
    <td><div class="actions">${actions}</div></td>
  </tr>`;
}

$('#orders-body').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const order = orders.find((o) => o._id === btn.dataset.id);
  if (!order) return;
  const { action } = btn.dataset;
  const question =
    action === 'confirm'
      ? `Mark order ${order.orderNumber} as confirmed?`
      : `Cancel order ${order.orderNumber}?`;
  if (!confirm(question)) return;

  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    await api(`/orders/${order._id}/${action}`, { method: 'POST' });
    toast(action === 'confirm' ? 'Order confirmed' : 'Order cancelled', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = label;
    loadOrders();
  }
});

// ---------------- Products ----------------
let products = [];
let productFilter = '';
let productSearch = '';
let editingId = null;
// Each entry: { kind: 'existing', src } or { kind: 'new', file, url }
let images = [];
let coverIndex = 0;

async function loadProducts() {
  try {
    products = await api('/products');
    renderProducts();
  } catch (err) {
    if (err.status !== 401) toast(err.message, 'error');
  }
}

$$('.chip[data-pfilter]').forEach((chip) =>
  chip.addEventListener('click', () => {
    productFilter = chip.dataset.pfilter;
    $$('.chip[data-pfilter]').forEach((c) => c.classList.toggle('active', c === chip));
    renderProducts();
  })
);
$('#product-search').addEventListener('input', (e) => {
  productSearch = e.target.value.trim().toLowerCase();
  renderProducts();
});

function renderProducts() {
  const drafts = products.filter((p) => p.published === false).length;
  $('#product-count').textContent = `(${products.length})`;
  $('#draft-count').textContent = drafts ? `(${drafts})` : '';
  const cats = [...new Set(products.map((p) => p.category).filter(Boolean))];
  $('#category-list').innerHTML = cats.map((c) => `<option value="${esc(c)}">`).join('');

  const list = products.filter((p) => {
    if (productFilter === 'live' && p.published === false) return false;
    if (productFilter === 'draft' && p.published !== false) return false;
    if (productSearch && !`${p.title} ${p.category} ${p.caption}`.toLowerCase().includes(productSearch)) return false;
    return true;
  });

  $('#product-list').innerHTML =
    list
      .map((p) => {
        const draft = p.published === false;
        const cover = safeUrl(thumb(p.images[0]));
        return `<div class="product-card ${draft ? 'draft' : ''}">
      ${cover ? `<img src="${esc(cover)}" alt="" loading="lazy">` : '<img alt="">'}
      <div class="body">
        ${draft ? '<span class="draft-tag">DRAFT: hidden from website</span>' : ''}
        ${p.newArrival ? '<span class="new-tag">NEW ARRIVAL</span>' : ''}
        <div class="title">${esc(p.title)}</div>
        <div>${p.price ? money(p.price) : '<b style="color:#dc2626">No price</b>'} ${p.category ? `· <span class="muted">${esc(p.category)}</span>` : ''}</div>
        <div class="muted small">${p.images.length} photo(s)${p.sizes.length ? ` · ${esc(p.sizes.join(', '))}` : ''}</div>
        ${p.inStock ? '' : '<div class="oos">SOLD OUT</div>'}
      </div>
      <div class="btns">
        <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${p._id}">Edit</button>
        <button class="btn ${draft ? 'btn-green' : 'btn-ghost'} btn-sm" data-action="publish" data-id="${p._id}">${draft ? 'Publish' : 'Hide'}</button>
        <button class="btn btn-ghost btn-sm" data-action="new" data-id="${p._id}">${p.newArrival ? 'Remove from New' : 'Mark as New'}</button>
        <button class="btn btn-ghost btn-sm" data-action="stock" data-id="${p._id}">${p.inStock ? 'Mark sold out' : 'Mark in stock'}</button>
        <button class="btn btn-red btn-sm" data-action="delete" data-id="${p._id}">Delete</button>
      </div>
    </div>`;
      })
      .join('') || '<p class="muted">No products here.</p>';
}

function renderPreviews() {
  if (coverIndex >= images.length) coverIndex = 0;
  $('#image-previews').innerHTML = images
    .map((img, i) => {
      const src = img.kind === 'new' ? img.url : thumb(img.src);
      return `<div class="preview ${i === coverIndex ? 'cover' : ''}" data-index="${i}" title="Click to make this the cover">
        <img src="${esc(safeUrl(src))}" alt="">
        ${i === coverIndex ? '<span class="cover-tag">COVER</span>' : ''}
        <button type="button" class="remove" data-remove="${i}" title="Remove">&times;</button>
      </div>`;
    })
    .join('');
}

$('#image-input').addEventListener('change', (e) => {
  for (const file of e.target.files) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast(`${file.name}: only JPG, PNG or WEBP`, 'error');
      continue;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast(`${file.name} is bigger than 5MB`, 'error');
      continue;
    }
    images.push({ kind: 'new', file, url: URL.createObjectURL(file) });
  }
  e.target.value = '';
  renderPreviews();
});

$('#image-previews').addEventListener('click', (e) => {
  const remove = e.target.closest('[data-remove]');
  if (remove) {
    const i = Number(remove.dataset.remove);
    const [img] = images.splice(i, 1);
    if (img.kind === 'new') URL.revokeObjectURL(img.url);
    if (i < coverIndex) coverIndex--;
    else if (i === coverIndex) coverIndex = 0;
    renderPreviews();
    return;
  }
  const preview = e.target.closest('.preview');
  if (preview) {
    coverIndex = Number(preview.dataset.index);
    renderPreviews();
  }
});

function resetForm() {
  editingId = null;
  images.forEach((m) => m.kind === 'new' && URL.revokeObjectURL(m.url));
  images = [];
  coverIndex = 0;
  const form = $('#product-form');
  form.reset();
  form.elements.inStock.checked = true;
  form.elements.published.checked = true;
  form.elements.newArrival.checked = false;
  $('#form-title').textContent = 'Add product';
  $('#save-product').textContent = 'Save product';
  $('#cancel-edit').classList.add('hidden');
  $('#product-error').textContent = '';
  renderPreviews();
}

function startEdit(p) {
  resetForm();
  editingId = p._id;
  const form = $('#product-form');
  form.elements.title.value = p.title;
  form.elements.caption.value = p.caption || '';
  form.elements.price.value = p.price || '';
  form.elements.category.value = p.category || '';
  form.elements.sizes.value = (p.sizes || []).join(', ');
  form.elements.inStock.checked = p.inStock;
  form.elements.newArrival.checked = Boolean(p.newArrival);
  // Drafts without a price: tick "show on website" once a price is typed in.
  form.elements.published.checked = p.published !== false || !p.price;
  images = p.images.map((src) => ({ kind: 'existing', src }));
  $('#form-title').textContent = `Edit: ${p.title}`;
  $('#save-product').textContent = 'Update product';
  $('#cancel-edit').classList.remove('hidden');
  renderPreviews();
  form.scrollIntoView({ behavior: 'smooth' });
}

$('#cancel-edit').addEventListener('click', resetForm);

$('#product-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  $('#product-error').textContent = '';
  if (!images.length && !confirm('This product has no photos. Save anyway?')) return;
  if (Number(form.elements.price.value) <= 0 && form.elements.published.checked) {
    $('#product-error').textContent = 'Please enter a price before showing the product on the website.';
    return;
  }

  const fd = new FormData();
  for (const name of ['title', 'caption', 'price', 'category', 'sizes']) fd.append(name, form.elements[name].value);
  fd.append('inStock', form.elements.inStock.checked ? 'true' : 'false');
  fd.append('published', form.elements.published.checked ? 'true' : 'false');
  fd.append('newArrival', form.elements.newArrival.checked ? 'true' : 'false');

  fd.append('existingImages', JSON.stringify(images.filter((i) => i.kind === 'existing').map((i) => i.src)));
  const newOnes = images.filter((i) => i.kind === 'new');
  newOnes.forEach((i) => fd.append('images', i.file, i.file.name));
  const cover = images[coverIndex];
  if (cover) fd.append('cover', cover.kind === 'existing' ? `existing:${cover.src}` : `new:${newOnes.indexOf(cover)}`);

  const btn = $('#save-product');
  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    if (editingId) await api(`/products/${editingId}`, { method: 'PUT', form: fd });
    else await api('/products', { method: 'POST', form: fd });
    toast(editingId ? 'Product updated' : 'Product added', 'success');
    resetForm();
    loadProducts();
  } catch (err) {
    $('#product-error').textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = editingId ? 'Update product' : 'Save product';
  }
});

$('#product-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const p = products.find((x) => x._id === btn.dataset.id);
  if (!p) return;
  try {
    if (btn.dataset.action === 'edit') return startEdit(p);
    if (btn.dataset.action === 'stock') {
      await api(`/products/${p._id}`, { method: 'PATCH', body: { inStock: !p.inStock } });
      toast(p.inStock ? 'Marked sold out' : 'Marked in stock', 'success');
    }
    if (btn.dataset.action === 'new') {
      await api(`/products/${p._id}`, { method: 'PATCH', body: { newArrival: !p.newArrival } });
      toast(p.newArrival ? 'Removed from New Arrivals' : 'Added to New Arrivals', 'success');
    }
    if (btn.dataset.action === 'publish') {
      const publish = p.published === false;
      if (publish && !p.price) return startEdit(p) || toast('Add a price, then save to publish.', 'error');
      await api(`/products/${p._id}`, { method: 'PATCH', body: { published: publish } });
      toast(publish ? 'Now visible on the website' : 'Hidden from the website', 'success');
    }
    if (btn.dataset.action === 'delete') {
      if (!confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
      await api(`/products/${p._id}`, { method: 'DELETE' });
      if (editingId === p._id) resetForm();
      toast('Product deleted', 'success');
    }
    loadProducts();
  } catch (err) {
    toast(err.message, 'error');
  }
});

// ---------------- Banners ----------------
let banners = [];

async function loadBanners() {
  try {
    banners = await api('/banners');
    renderBanners();
  } catch (err) {
    if (err.status !== 401) toast(err.message, 'error');
  }
}

function renderBanners() {
  $('#banner-count').textContent = `(${banners.length})`;
  $('#banner-list').innerHTML =
    banners
      .map(
        (b, i) => `<div class="banner-item ${b.active ? '' : 'off'}">
      <img src="${esc(safeUrl(thumb(b.image, 1000)))}" alt="Banner ${i + 1}" loading="lazy">
      <div class="meta">
        <span class="grow">${b.link ? `Links to: ${esc(b.link)}` : 'No link'}${b.active ? '' : ' · HIDDEN'}</span>
        <button class="btn btn-ghost btn-sm" data-baction="up" data-id="${b._id}" ${i === 0 ? 'disabled' : ''} title="Move up">&uarr;</button>
        <button class="btn btn-ghost btn-sm" data-baction="down" data-id="${b._id}" ${i === banners.length - 1 ? 'disabled' : ''} title="Move down">&darr;</button>
        <button class="btn btn-ghost btn-sm" data-baction="link" data-id="${b._id}">Change link</button>
        <button class="btn btn-ghost btn-sm" data-baction="toggle" data-id="${b._id}">${b.active ? 'Hide' : 'Show'}</button>
        <button class="btn btn-red btn-sm" data-baction="delete" data-id="${b._id}">Delete</button>
      </div>
    </div>`
      )
      .join('') || '<p class="muted">No banners yet. The website shows its default banner until you add one.</p>';
}

$('#banner-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  const box = $('#banner-preview');
  if (!file) return box.classList.add('hidden');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
    e.target.value = '';
    box.classList.add('hidden');
    return toast('Banner must be a JPG, PNG or WEBP image up to 8MB', 'error');
  }
  box.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="Preview">`;
  box.classList.remove('hidden');
});

$('#banner-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const file = $('#banner-file').files[0];
  $('#banner-error').textContent = '';
  if (!file) return ($('#banner-error').textContent = 'Please choose a picture');
  const fd = new FormData();
  fd.append('image', file, file.name);
  fd.append('link', form.elements.link.value);
  fd.append('active', form.elements.active.checked ? 'true' : 'false');
  const btn = $('#save-banner');
  btn.disabled = true;
  btn.textContent = 'Uploading…';
  try {
    await api('/banners', { method: 'POST', form: fd });
    toast('Banner added', 'success');
    form.reset();
    $('#banner-preview').classList.add('hidden');
    loadBanners();
  } catch (err) {
    $('#banner-error').textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Add banner';
  }
});

$('#banner-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-baction]');
  if (!btn) return;
  const i = banners.findIndex((b) => b._id === btn.dataset.id);
  if (i < 0) return;
  const b = banners[i];
  try {
    switch (btn.dataset.baction) {
      case 'up':
      case 'down': {
        const j = btn.dataset.baction === 'up' ? i - 1 : i + 1;
        const ids = banners.map((x) => x._id);
        [ids[i], ids[j]] = [ids[j], ids[i]];
        await api('/banners/reorder', { method: 'POST', body: { ids } });
        break;
      }
      case 'toggle': {
        const fd = new FormData();
        fd.append('active', b.active ? 'false' : 'true');
        await api(`/banners/${b._id}`, { method: 'PUT', form: fd });
        break;
      }
      case 'link': {
        const link = prompt('Where should this banner go when clicked?\nExamples: /shop?new=1   /shop?category=Boys   https://...\nLeave empty for no link.', b.link || '');
        if (link === null) return;
        const fd = new FormData();
        fd.append('link', link);
        await api(`/banners/${b._id}`, { method: 'PUT', form: fd });
        break;
      }
      case 'delete':
        if (!confirm('Delete this banner?')) return;
        await api(`/banners/${b._id}`, { method: 'DELETE' });
        break;
    }
    loadBanners();
  } catch (err) {
    toast(err.message, 'error');
  }
});

// Refresh orders every minute so new ones show up without clicking.
setInterval(() => {
  if (!$('#app-view').classList.contains('hidden') && !$('#orders-tab').classList.contains('hidden')) loadOrders();
}, 60000);

// ---------------- Start ----------------
showApp().catch(showLogin);
