import './style.css';
import { createAudio } from 'madness-engine/audio';
import {
  PRODUCTS, PRODUCT_BY_ID, STAFF, createGameState, money, productNow, activeFrameDelta,
  availableProducts, buyFixture, placeFixture, hirePurchasingManager, setAutomaticPurchasing,
  shelfQuantity, stockroomQuantity, expiredQuantity, oldestShelfBatch, isAvailable,
  restockProduct, restockAll, placeOrder, pullExpired, adjustPrice, borrowCredit,
  repayCredit, advanceGame, beginDay, togglePause, startNextDay, saveGameState, loadGameState,
  trafficLabel, reviewSummary,
} from './sim.js';
import '@fontsource/playfair-display/600.css';
import '@fontsource/playfair-display/700.css';
import '@fontsource/oswald/400.css';
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/600.css';
import '@fontsource/caveat/600.css';
import { createVentureCafeWorld } from './world.js';
import { CAFE_MENU } from './menu.js';
import { LOCAL_PRODUCTS, CAFE_TABLES, CAFE_BOOTHS, CAFE_BAR_STOOLS, CAFE_SEATS } from './layout.js';

const CAFE_INGREDIENT_IDS = [...new Set(CAFE_MENU.flatMap((item) => Object.keys(item.ingredients ?? {})))];

const $ = (selector) => document.querySelector(selector);
const panel = $('#panel-content');
const SAVE_KEY = 'venture-cafe.breakfast.save.v1';
let state;
try { state = loadGameState(window.localStorage.getItem(SAVE_KEY)); } catch { state = null; }
state ??= createGameState();
state.orderCases ??= Object.fromEntries(PRODUCTS.map((p) => [p.id, 1]));
window.__ventureCafeState = state;

let currentTab = 'overview';
let selectedProduct = 'eggs';
let selectedPiece = null;
let stockFilter = 'All';
let stockSearch = '';
let audioMuted = false;
let previousEventSequence = state.eventSequence;
let previousReviewSequence = state.reviewSequence;
let lastPanelRender = 0;
let lastHeaderRender = 0;
let realTime = 0;

function updateLoading(label, progress) {
  const status = $('#loading-status');
  const fill = $('#loading-progress-fill');
  const percent = $('#loading-percent');
  if (status) status.textContent = label;
  if (fill) fill.style.width = `${Math.max(0, Math.min(100, progress))}%`;
  if (percent) percent.textContent = `${Math.round(progress)}%`;
}

const audio = createAudio({ storageKey: 'venture-cafe.muted', glue: true });
audioMuted = audio.muted;
updateLoading('Warming the cafe and preparing the dining room', 0);
let world;
try {
  world = await createVentureCafeWorld($('#world'), updateLoading);
  world.setState(state);
  const WHY = {
    out: 'That is outside the shop, or too close to a wall.', wall: 'Shelves and bins need space round them to reach both sides. Only coolers go against a wall.',
    blocked: 'Something is in the way there.', 'needs-wall': 'A cooler has to stand flat against a wall.',
    door: 'That would shut off the door, the till or a shelf. Leave a way through.',
  };
  world.placement.onPlace = (pieceId, spot) => {
    const result = placeFixture(state, pieceId, spot);
    if (result.ok) { notify('Moved. Guests and staff will use the updated layout.', 'good'); renderPanel({ preserveScroll: true }); return true; }
    notify(WHY[result.reason] ?? 'It cannot go there.', 'danger');
    return false;
  };
  world.placement.onCancel = () => renderPanel({ preserveScroll: true });
  // Clicking a kitchen fixture selects it; clicking again or pressing M picks it up.
  world.selection.onSelect = (id) => {
    selectedPiece = id;
    if (id) {
      const matchingIngredient = LOCAL_PRODUCTS(id).find((productId) => CAFE_INGREDIENT_IDS.includes(productId));
      if (matchingIngredient) { selectedProduct = matchingIngredient; currentTab = 'shelves'; }
      else currentTab = 'floor';
    }
    renderPanel({ preserveScroll: !id });
  };
  world.selection.onPickUp = (id) => {
    if (world.placement.active) return;
    selectedPiece = id;
    world.placement.start(id, state);
    notify('Click the floor to place the fixture. R turns it, Esc cancels.', 'info');
    renderPanel({ preserveScroll: true });
  };
  updateLoading('Everything is ready. Welcome to the block.', 100);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  $('#loading-overlay')?.classList.add('loading-finished');
  await new Promise((resolve) => setTimeout(resolve, 260));
  $('#loading-overlay')?.classList.add('hidden');
} catch (error) {
  console.error('Venture Cafe failed to load:', error);
  const status = $('#loading-status');
  if (status) status.textContent = 'The cafe could not be opened. Check the connection and reload.';
  throw error;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function fmtClock(minute) {
  const hour24 = Math.floor(minute / 60) % 24;
  const mins = Math.floor(minute % 60).toString().padStart(2, '0');
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const hour = hour24 % 12 || 12;
  return `${hour}:${mins} ${suffix}`;
}

function expiryCopy(batch) {
  if (!batch) return 'NO BATCH ON SHELF';
  const left = batch.expiresAt - productNow(state);
  if (left <= 0) return 'EXPIRED · PULL NOW';
  if (left < 1) return `EXPIRES TODAY · ${Math.max(1, Math.ceil(left * 24))}H LEFT`;
  if (left < 3) return `EXPIRES IN ${Math.ceil(left)} DAYS`;
  return `${Math.floor(left)} DAYS LEFT`;
}

function expiryTone(batch) {
  if (!batch) return 'muted';
  const left = batch.expiresAt - productNow(state);
  return left <= 0 ? 'danger' : left < 2 ? 'warning' : 'good';
}

function notify(message, kind = 'info') {
  const stack = $('#toast-stack');
  const toast = document.createElement('div');
  toast.className = `toast toast-${kind}`;
  toast.innerHTML = `<span class="toast-icon">${kind === 'danger' ? '!' : kind === 'good' ? '✓' : '✳'}</span><span>${escapeHtml(message)}</span>`;
  stack.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 250);
  }, 3400);
}

function recordNewEvents() {
  const latest = state.events.filter((event) => event.id > previousEventSequence).reverse();
  for (const event of latest) {
    if (event.type === 'danger') {
      notify(event.message, 'danger');
      if (!audioMuted) audio.tone({ freq: 240, to: 150, length: 0.22, gain: 0.18, type: 'triangle' });
    } else if (event.type === 'sale') {
      if (!audioMuted) audio.jingle([64, 69, 76], { type: 'triangle', gain: 0.055, length: 0.12 });
    } else if (event.type === 'order') notify(event.message, 'good');
    else if (event.type === 'staff' && (event.message.includes('served ') || event.message.includes('Rafael Ortiz ordered'))) notify(event.message, 'good');
    else if (event.type === 'cat') notify(event.message, event.detail?.includes('happier customer') ? 'good' : 'info');
    else if (event.type === 'review') {
      const rating = Number(event.message.match(/(\d)-star/)?.[1] ?? 3);
      notify(`New neighborhood review · ${rating} stars`, rating <= 2 ? 'danger' : rating === 5 ? 'good' : 'info');
      renderReviewFeed();
      if (currentTab === 'reviews') renderPanel({ preserveScroll: true });
    }
  }
  previousEventSequence = Math.max(previousEventSequence, state.eventSequence);
  previousReviewSequence = Math.max(previousReviewSequence, state.reviewSequence);
}

function updateHeader() {
  $('#cash-value').textContent = money(state.cash);
  $('#debt-value').textContent = money(state.debt);
  $('#revenue-value').textContent = money(state.dayStats.revenue);
  $('#rep-value').textContent = Math.round(state.reputation);
  $('#rep-meter').style.width = `${state.reputation}%`;
  $('#day-label').textContent = `DAY ${String(state.day).padStart(2, '0')}`;
  $('#clock-value').textContent = fmtClock(state.minute);
  const status = !state.started ? 'SHUTTERS DOWN' : state.dayEnded ? 'CLOSED FOR THE DAY' : state.paused ? 'PAUSED' : 'SHUTTERS UP';
  $('#shop-status').textContent = status;
  $('#open-pill').classList.toggle('is-open', state.started && !state.dayEnded);
  $('#open-pill').querySelector('span').textContent = state.dayEnded ? 'CLOSED' : state.paused ? (state.started ? 'PAUSED' : 'CLOSED') : 'OPEN';
  $('#pause-toggle').textContent = state.paused ? '▶' : 'Ⅱ';
  $('#pause-toggle').title = state.paused ? 'Resume simulation' : 'Pause simulation';
  $('#foot-customers').textContent = `${state.customers.length} DINERS IN THE CAFE`;
  $('#foot-traffic').textContent = `BREAKFAST TRAFFIC ${trafficLabel(state)}`;
  const waiterTask = state.waiterWork ?? { stage: 'idle' };
  const waitingTables = state.customers.filter((customer) => customer.serviceStatus !== 'served').length;
  const waiterLabel = waiterTask.stage === 'taking-order' ? 'WAITER TAKING AN ORDER'
    : waiterTask.stage === 'preparing-order' ? 'KITCHEN PREPARING A MEAL'
      : ['walking-to-delivery', 'presenting'].includes(waiterTask.stage) ? 'WAITER DELIVERING BREAKFAST'
        : ['walking-to-table', 'returning-to-kitchen'].includes(waiterTask.stage) ? 'WAITER ON THE FLOOR' : null;
  $('#foot-staff').textContent = waiterLabel ?? (waitingTables ? `${waitingTables} ORDERS IN SERVICE` : `${STAFF.length} CAFE CREW ON SHIFT`);
  const ingredientAlerts = CAFE_INGREDIENT_IDS.filter((id) => expiredQuantity(state, id) > 0 || shelfQuantity(state, id) === 0).length;
  const alertCount = ingredientAlerts;
  $('#shelf-alert-count').textContent = alertCount;
  $('#shelf-alert-count').classList.toggle('hidden', alertCount === 0);
  $('#bottom-message').textContent = state.dayStats.complaints
    ? `${state.dayStats.complaints} unhappy customer${state.dayStats.complaints === 1 ? '' : 's'} today. Check the dates.`
    : health.expired ? `${health.expired} expired units need to come off the shelf.`
      : 'Fresh breakfast. Good coffee. Good people.';
  $('#start-overlay').classList.toggle('hidden', state.started);
  $('#player-controls')?.classList.toggle('hidden', !state.started || state.paused || state.dayEnded || state.gameOver);
  $('#pause-toggle').disabled = !state.started || state.dayEnded;
  $('#sound-toggle').textContent = audioMuted ? '♫̸' : '♫';
  $('#sound-toggle').classList.toggle('muted', audioMuted);
  document.querySelectorAll('[data-speed]').forEach((button) => button.classList.toggle('active', Number(button.dataset.speed) === state.speed));
}

function eventIcon(type) {
  return ({ sale: '↗', customer: '♙', danger: '!', warning: '△', order: '▣', stock: '↔', staff: '↻', level: '↑', waste: '×', finance: '$', close: '▣', good: '✓', note: '✳', review: '★', cat: '♥' })[type] ?? '·';
}
function renderActivity(limit = 6) {
  return `<div class="activity-list">${state.events.slice(0, limit).map((event) => `
    <div class="activity-row activity-${event.type}">
      <span class="activity-symbol">${eventIcon(event.type)}</span>
      <div class="activity-copy"><strong>${escapeHtml(event.message)}</strong><span>${escapeHtml(event.detail || '')}</span></div>
      <time>${event.day === state.day ? fmtClock(event.time) : `D${event.day}`}</time>
    </div>`).join('')}</div>`;
}

function reviewTimestamp(review) {
  if (!review.day) return 'BEFORE YOUR FIRST SHIFT';
  if (review.day === state.day) return `TODAY · ${fmtClock(review.minute)}`;
  return `DAY ${review.day} · ${fmtClock(review.minute)}`;
}

function reviewMarkup() {
  const summary = reviewSummary(state);
  const distribution = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: state.reviews.filter((review) => review.rating === rating).length,
  }));
  const total = Math.max(1, summary.count);
  const reviews = state.reviews.slice(0, 18);
  const recent = reviews[0];
  return `
    <div class="review-reputation">
      <div class="review-scoreline"><strong>${summary.rating.toFixed(1)}</strong><span class="review-stars">${'★'.repeat(Math.round(summary.rating))}<i>${'☆'.repeat(5 - Math.round(summary.rating))}</i></span></div>
      <div class="review-score-copy"><b>${summary.count} cafe reviews</b><span>${Math.round(state.reputation)} / 100 neighborhood trust</span></div>
      <div class="rating-distribution">${distribution.map((row) => `<div class="rating-bar"><span>${row.rating}</span><i><b style="width:${row.count / total * 100}%"></b></i><small>${row.count}</small></div>`).join('')}</div>
    </div>
    <div class="review-footfall"><span><i class="live-dot"></i> ESTIMATED DINER TRAFFIC</span><strong class="traffic-${trafficLabel(state).toLowerCase()}">${trafficLabel(state)}</strong><small>${state.reputation >= 86 ? 'The block is talking you up.' : state.reputation >= 68 ? 'Regular neighborhood traffic.' : state.reputation >= 45 ? 'Fewer walk-ins than usual.' : 'Word of mouth is keeping people away.'}</small></div>
    <div class="review-feed-heading"><span>RECENT DINER REVIEWS</span><small>NEWEST FIRST</small></div>
    <div class="review-stream">${reviews.map((review) => {
      const initials = review.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
      const isNew = recent && review.id === recent.id && review.id > previousReviewSequence;
      const tag = review.outcome === 'food-poor' ? 'FOOD QUALITY'
        : review.outcome === 'service-poor' ? 'TABLE SERVICE'
          : ['poor', 'mixed'].includes(review.outcome) ? 'DINING EXPERIENCE'
            : review.source.toUpperCase();
      return `<article class="review-card ${isNew ? 'review-new' : ''} ${review.rating <= 2 ? 'review-negative' : ''}">
        <div class="review-person"><span class="review-avatar">${escapeHtml(initials)}</span><span class="review-person-copy"><strong>${escapeHtml(review.name)}</strong><small>${escapeHtml(review.source)} · ${reviewTimestamp(review)}</small></span>${isNew ? '<em>JUST IN</em>' : ''}</div>
        <div class="review-card-stars"><span>${'★'.repeat(review.rating)}<i>${'☆'.repeat(5 - review.rating)}</i></span><small>${tag}</small></div>
        <p>${escapeHtml(review.text)}</p>
        ${Number.isFinite(review.foodQuality) && Number.isFinite(review.serviceQuality) ? `<div class="review-quality"><span>FOOD <b>${review.foodQuality}/100</b></span><span>SERVICE <b>${review.serviceQuality}/100</b></span></div>` : ''}
        ${review.outcome === 'food-poor' ? '<div class="review-response-note">Kitchen quality was the main issue on this visit.</div>' : review.outcome === 'service-poor' ? '<div class="review-response-note">Table service was the main issue on this visit.</div>' : ''}
      </article>`;
    }).join('') || '<div class="empty-state compact">No reviews yet. Serve a few breakfasts and see what the neighborhood thinks.</div>'}</div>
  `;
}



function renderReviewFeed({ preserveScroll = true } = {}) {
  const target = $('#review-feed-content');
  if (!target) return;
  const oldScroll = target.scrollTop;
  target.innerHTML = reviewMarkup();
  if (preserveScroll) target.scrollTop = oldScroll;
}

function reviewsPanel() {
  return `<div class="review-mobile-page">${reviewMarkup()}</div>`;
}

function productFlag(product) {
  const batch = oldestShelfBatch(state, product.id);
  const left = batch ? batch.expiresAt - productNow(state) : Infinity;
  if (expiredQuantity(state, product.id)) return '<span class="tag tag-danger">EXPIRED</span>';
  if (shelfQuantity(state, product.id) === 0) return '<span class="tag tag-muted">EMPTY</span>';
  if (left < 2) return '<span class="tag tag-warning">DATE CHECK</span>';
  if (shelfQuantity(state, product.id) <= 2) return '<span class="tag tag-warning">LOW</span>';
  return '<span class="tag tag-good">IN KITCHEN</span>';
}

function overviewPanel() {
  const ingredients = CAFE_INGREDIENT_IDS.map((id) => PRODUCT_BY_ID[id]).filter(Boolean);
  const urgent = ingredients.filter((product) => expiredQuantity(state, product.id) || shelfQuantity(state, product.id) <= 1).slice(0, 5);
  const active = state.customers.length;
  const ordersWaiting = state.customers.filter((customer) => customer.serviceStatus !== 'served').length;
  const served = state.dayStats.ordersServed ?? 0;
  const foodQuality = served ? Math.round(state.dayStats.foodQualityTotal / served) : 0;
  const serviceQuality = served ? Math.round(state.dayStats.serviceQualityTotal / served) : 0;
  const grossMargin = state.dayStats.revenue > 0 ? Math.round((state.dayStats.grossProfit / state.dayStats.revenue) * 100) : 0;
  return `
    <div class="panel-section">
      <div class="section-heading"><div><div class="eyebrow">THE DAILY CAFE REPORT</div><h3>Today's service</h3></div><span class="subtle">DAY ${state.day}</span></div>
      <div class="metric-grid">
        <div class="metric-card"><span>SALES</span><strong>${money(state.dayStats.revenue)}</strong><small>${served} meals served · ${grossMargin}% gross margin</small></div>
        <div class="metric-card"><span>DINER COVERS</span><strong>${state.dayStats.customers}</strong><small>${active} currently in the dining room</small></div>
        <div class="metric-card"><span>FOOD QUALITY</span><strong>${served ? foodQuality + '/100' : '—'}</strong><small>Kitchen execution and ingredient freshness</small></div>
        <div class="metric-card"><span>SERVICE QUALITY</span><strong>${served ? serviceQuality + '/100' : '—'}</strong><small>Order-taking, wait time and table service</small></div>
      </div>
      <div class="service-queue"><span>${ordersWaiting} ORDERS IN SERVICE</span><small>Guests are seated first, then the waiter takes the order and sends it to the kitchen.</small></div>
    </div>
    <div class="panel-section">
      <div class="section-heading"><div><div class="eyebrow">KITCHEN CHECK</div><h3>Ingredients to watch</h3></div><span class="subtle">${urgent.length} NEED ATTENTION</span></div>
      ${urgent.length ? `<div class="attention-list">${urgent.map((product) => {
        const expired = expiredQuantity(state, product.id);
        return `<button class="attention-row" data-action="select-product" data-product="${product.id}"><span class="attention-mark ${expired ? 'mark-danger' : 'mark-warning'}">${expired ? '!' : '◷'}</span><span><strong>${escapeHtml(product.short)}</strong><small>${expired ? 'Expired stock · pull before prep' : `${shelfQuantity(state, product.id)} units on hand`}</small></span><b>→</b></button>`;
      }).join('')}</div>` : '<div class="empty-state compact"><span class="empty-mark">✓</span><strong>Kitchen stock is in good shape.</strong><p>Keep rotating the oldest fresh ingredients first.</p></div>'}
      <div class="action-pair"><button class="secondary-button" data-action="pull-expired">PULL EXPIRED</button><button class="secondary-button" data-action="restock-all">RESTOCK KITCHEN</button></div>
    </div>
    <div class="panel-section">
      <div class="section-heading"><div><div class="eyebrow">THE BLOCK IS TALKING</div><h3>Latest activity</h3></div><span class="subtle">LIVE</span></div>
      ${renderActivity(5)}
    </div>`;
}



const FILTERS = ['All', 'Eggs', 'Produce', 'Dairy', 'Bakery', 'Dry goods', 'Drinks'];

function menuPanel() {
  const groups = ['Skillet', 'Eggs', 'Omelette', 'Bakery', 'Drinks'];
  return groups.map((category) => {
    const items = CAFE_MENU.filter((item) => item.category === category);
    if (!items.length) return '';
    return `<div class="panel-section">
      <div class="section-heading"><div><div class="eyebrow">BREAKFAST MENU</div><h3>${category}</h3></div><span class="subtle">${items.filter((item) => Object.keys(item.ingredients).every((id) => isAvailable(state, id))).length} AVAILABLE · ${items.length} ITEMS</span></div>
      <div class="menu-list">${items.map((item) => {
        const unlocked = Object.keys(item.ingredients).every((id) => isAvailable(state, id));
        return `<article class="menu-item ${unlocked ? '' : 'menu-item-locked'}">
          <div class="menu-item-copy"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description)}</small><span>${escapeHtml(item.prep)} · ${unlocked ? 'AVAILABLE' : 'UNLOCKS WITH INGREDIENT RANGE'}</span></div>
          <b>${money(item.price)}</b>
        </article>`;
      }).join('')}</div>
    </div>`;
  }).join('');
}

function shelfPanel() {
  const visible = availableProducts(state).filter((product) => CAFE_INGREDIENT_IDS.includes(product.id) && (stockFilter === 'All' || product.category === stockFilter)
    && `${product.name} ${product.category}`.toLowerCase().includes(stockSearch.toLowerCase()));
  const rows = visible.map((product) => {
    const front = oldestShelfBatch(state, product.id);
    const shelf = shelfQuantity(state, product.id);
    const back = stockroomQuantity(state, product.id);
    const expiry = expiryCopy(front);
    return `<button class="stock-row ${product.id === selectedProduct ? 'selected' : ''}" data-action="select-product" data-product="${product.id}">
      <span class="product-swatch" style="--swatch:${product.color}"></span>
      <span class="stock-main"><strong>${escapeHtml(product.short)}</strong><small>${escapeHtml(product.category)} · ${expiry}</small></span>
      <span class="stock-count"><b>${shelf}</b><small>KITCHEN</small></span>
      <span class="stock-back"><b>${back}</b><small>DRY STORE</small></span>
      <span class="stock-chevron">›</span>
    </button>`;
  }).join('');
  const product = PRODUCT_BY_ID[selectedProduct];
  const shelfBatches = [...state.shelves[selectedProduct]].sort((a, b) => a.expiresAt - b.expiresAt);
  const backBatches = [...state.stockroom[selectedProduct]].sort((a, b) => a.expiresAt - b.expiresAt);
  const front = shelfBatches[0];
  const totalExpired = expiredQuantity(state, selectedProduct);
  return `
    <div class="panel-section inventory-toolbar">
      <div class="section-heading"><div><div class="eyebrow">KITCHEN + DRY STORE</div><h3>Ingredient stock</h3></div><span class="subtle">${availableProducts(state).length} LINES</span></div>
      <label class="search-box"><span>⌕</span><input id="stock-search" type="search" placeholder="Find an ingredient…" value="${escapeHtml(stockSearch)}" /></label>
      <div class="filter-row">${FILTERS.map((filter) => `<button class="filter-chip ${stockFilter === filter ? 'active' : ''}" data-action="filter-stock" data-filter="${filter}">${filter}</button>`).join('')}</div>
      <div class="stock-list">${rows || '<div class="empty-state compact">No products match that search.</div>'}</div>
    </div>
    <div class="panel-section product-detail">
      <div class="section-heading"><div><div class="eyebrow">SELECTED LINE</div><h3>${escapeHtml(product.name)}</h3></div>${productFlag(product)}</div>
      <p class="product-description">${escapeHtml(product.description)}</p>
      <div class="detail-quantities"><div><span>IN KITCHEN</span><strong>${shelfQuantity(state, selectedProduct)}</strong></div><div><span>DRY STORE</span><strong>${stockroomQuantity(state, selectedProduct)}</strong></div><div><span>EXPIRED</span><strong class="${totalExpired ? 'text-danger' : ''}">${totalExpired}</strong></div></div>
      <div class="fifo-heading"><span>USE-BY DATE ROTATION</span><span>OLDEST → KITCHEN</span></div>
      <div class="batch-list">${[...shelfBatches, ...backBatches].slice(0, 5).map((batch, index) => {
        const location = index < shelfBatches.length ? 'KITCHEN' : 'DRY STORE';
        const isFront = location === 'SHELF' && index === 0;
        return `<div class="batch-row"><span class="batch-position ${isFront ? 'front' : ''}">${isFront ? '01' : String(index + 1).padStart(2, '0')}</span><span class="batch-label"><strong>${isFront ? 'FRONT OF SHELF' : location}</strong><small>${batch.qty} units · received Day ${Math.max(1, Math.floor(batch.receivedAt))}</small></span><span class="batch-expiry ${expiryTone(batch)}">${expiryCopy(batch)}</span></div>`;
      }).join('') || '<div class="empty-state compact">No lots available. Place a supplier order.</div>'}</div>
      <div class="price-editor"><div><span>SUPPLIER COST</span><strong>${money(product.cost)} / UNIT</strong><small>Case of ${product.caseSize} · ${money(product.cost * product.caseSize)} per case</small></div></div>
      <div class="action-pair"><button class="primary-button" data-action="restock" data-product="${selectedProduct}">RESTOCK KITCHEN ↗</button><button class="secondary-button ${totalExpired ? 'danger-button' : ''}" data-action="pull-product-expired" data-product="${selectedProduct}">PULL EXPIRED</button></div>
      ${front ? `<div class="rotation-note"><span>↻</span> ${expiryCopy(front)} · New deliveries stay behind older stock until dates are checked.</div>` : ''}
    </div>`;
}

/** The range: which tiers the store's level has opened and the shelves, bins and coolers to buy for their lines. */
function expansionPanel() {
  const occupied = new Set(state.customers.map((customer) => customer.seatId).filter(Boolean));
  const seatingRow = (label, seats) => {
    const taken = seats.filter((seat) => occupied.has(seat.id)).length;
    return `<div class="order-row">
      <span class="product-swatch" style="--swatch:#63816c"></span>
      <span class="order-product"><strong>${escapeHtml(label)}</strong><small>${seats.length - taken} available · ${taken} occupied</small></span>
      <span class="order-controls"><strong>${taken}/${seats.length}</strong></span>
    </div>`;
  };
  const tableRows = CAFE_TABLES.map((table) => seatingRow(table.id.replace('table-', 'Table ').toUpperCase(),
    CAFE_SEATS.filter((seat) => seat.tableId === table.id))).join('');
  const boothRows = CAFE_BOOTHS.map((booth) => seatingRow(booth.id.replace('booth-', 'Booth ').toUpperCase(),
    CAFE_SEATS.filter((seat) => seat.tableId === booth.id))).join('');
  const diningSeats = CAFE_SEATS.filter((seat) => seat.style !== 'stool');
  const occupiedCount = diningSeats.filter((seat) => occupied.has(seat.id)).length;
  return `
    <div class="panel-section">
      <div class="section-heading"><div><div class="eyebrow">DINING ROOM</div><h3>Guest seating</h3></div><span class="subtle">${diningSeats.length} SEATS</span></div>
      <div class="metric-grid">
        <div class="metric-card"><span>TABLES</span><strong>${CAFE_TABLES.length}</strong><small>Four two-person tables</small></div>
        <div class="metric-card"><span>BOOTH BENCHES</span><strong>${CAFE_BOOTHS.length}</strong><small>Two upholstered booths</small></div>
        <div class="metric-card"><span>OCCUPIED</span><strong>${occupiedCount}</strong><small>${diningSeats.length - occupiedCount} seats available</small></div>
        <div class="metric-card"><span>COUNTER STOOLS</span><strong>${CAFE_BAR_STOOLS.length}</strong><small>Perch seating along the service bar</small></div>
      </div>
    </div>
    <div class="panel-section">
      <div class="section-heading"><div><div class="eyebrow">TABLE SERVICE</div><h3>Seating by area</h3></div></div>
      <div class="order-category"><div class="order-category-title">TABLES<span>${CAFE_TABLES.length} AREAS</span></div>${tableRows}</div>
      <div class="order-category"><div class="order-category-title">BOOTH BENCHES<span>${CAFE_BOOTHS.length} AREAS</span></div>${boothRows}</div>
    </div>
    <div class="panel-section supplier-tip"><span class="tip-mark">✳</span><span><strong>THE SERVICE SEQUENCE.</strong><small>Guests are seated first. The waiter takes the order, Bob prepares the meal, and the waiter brings it to the table.</small></span></div>`;
}



function renderPanel({ preserveScroll = false } = {}) {
  const oldScroll = panel.scrollTop;
  if (currentTab === 'overview') panel.innerHTML = overviewPanel();
  else if (currentTab === 'shelves') panel.innerHTML = shelfPanel();
  else if (currentTab === 'menu') panel.innerHTML = menuPanel();
  else if (currentTab === 'orders') panel.innerHTML = ordersPanel();
  else if (currentTab === 'floor') panel.innerHTML = expansionPanel();
  else if (currentTab === 'finance') panel.innerHTML = financePanel();
  else if (currentTab === 'staff') panel.innerHTML = staffPanel();
  else if (currentTab === 'reviews') panel.innerHTML = reviewsPanel();
  document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === currentTab));
  panel.scrollTop = preserveScroll ? oldScroll : 0;
}

function renderDaySummary() {
  const summary = state.lastDaySummary;
  const modal = $('#day-summary');
  if (!state.dayEnded || !summary) { modal.classList.add('hidden'); return; }
  modal.classList.remove('hidden');
  const isOver = summary.net < 0;
  modal.innerHTML = `
    <div class="summary-card">
      <div class="summary-eyebrow">THE BOOKS ARE CLOSED · DAY ${summary.day}</div>
      <div class="summary-icon">${state.gameOver ? '×' : '✳'}</div>
      <h2>${state.gameOver ? 'The shutters stay down.' : 'Another day on the block.'}</h2>
      <p>${state.gameOver ? 'Cafe finances or neighborhood reputation ran out of runway. The doors have closed.' : 'Count the till, check the shelves, and get ready for tomorrow.'}</p>
      <div class="summary-metrics"><div><span>SALES</span><b>${money(summary.revenue)}</b></div><div><span>GROSS PROFIT</span><b>${money(summary.grossProfit)}</b></div><div><span>DINERS</span><b>${summary.customers}</b></div><div><span>FOOD / SERVICE</span><b>${summary.averageFoodQuality ?? 0} / ${summary.averageServiceQuality ?? 0}</b></div></div>
      <div class="summary-cat-line"><span>CAT ENCOUNTERS</span><b>♥ ${summary.catLoved ?? 0} charmed</b><b>! ${summary.catAnnoyed ?? 0} annoyed</b></div>
      <div class="summary-costs"><div><span>Rent</span><b>${money(summary.expenses.rent)}</b></div><div><span>Payroll</span><b>${money(summary.expenses.payroll)}</b></div><div><span>Utilities</span><b>${money(summary.expenses.utilities)}</b></div><div><span>Credit interest</span><b>${money(summary.expenses.interest)}</b></div><div><span>Inventory purchased</span><b>${money(summary.purchases)}</b></div><div><span>Expired stock written off</span><b>${money(summary.waste)}</b></div></div>
      <div class="summary-net ${isOver ? 'negative' : 'positive'}"><span>TRADING RESULT AFTER OVERHEAD</span><strong>${summary.net >= 0 ? '+' : '−'}${money(Math.abs(summary.net))}</strong></div>
      <div class="summary-balance"><span>REGISTER ${money(summary.cash)}</span><span>CREDIT ${money(summary.debt)}</span></div>
      ${state.gameOver ? '<button class="primary-button summary-next" data-action="restart">TRY A NEW STORE ↗</button>' : '<button class="primary-button summary-next" data-action="next-day">OPEN TOMORROW ↗</button>'}
    </div>`;
}

function refresh() {
  updateHeader();
  renderPanel();
  renderReviewFeed({ preserveScroll: false });
  renderDaySummary();
}

function setTab(tab) {
  currentTab = tab;
  renderPanel();
}

function withAudioWake() {
  if (!audioMuted) audio.wake();
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  withAudioWake();
  if (button.dataset.tab) { setTab(button.dataset.tab); return; }
  const action = button.dataset.action;
  const productId = button.dataset.product;
  const amount = Number(button.dataset.amount);
  if (action === 'select-product') { selectedProduct = productId; currentTab = 'shelves'; renderPanel(); return; }
  if (action === 'filter-stock') { stockFilter = button.dataset.filter; renderPanel(); return; }
  if (action === 'restock') {
    const result = restockProduct(state, productId);
    notify(result.moved ? `${result.moved} ${PRODUCT_BY_ID[productId].short.toLowerCase()} moved to the floor.` : result.reason === 'shelf-full' ? 'That shelf is already full.' : 'No backroom stock to move.', result.moved ? 'good' : 'info');
  }
  if (action === 'restock-all') {
    const moved = restockAll(state);
    notify(moved ? `${moved} units moved from the stockroom. Oldest dates went to the front.` : 'The shelves are already full or the stockroom is empty.', moved ? 'good' : 'info');
  }
  if (action === 'pull-expired') {
    const result = pullExpired(state);
    notify(result.removed ? `${result.removed} expired units pulled · ${money(result.loss)} written off.` : 'No expired stock found.', result.removed ? 'good' : 'info');
  }
  if (action === 'pull-product-expired') {
    const product = PRODUCT_BY_ID[productId];
    const result = pullExpired(state, productId);
    notify(result.removed ? `${result.removed} ${product.short.toLowerCase()} removed.` : `No expired ${product.short.toLowerCase()} found.`, result.removed ? 'good' : 'info');
  }
  if (action === 'price-up') { adjustPrice(state, productId, 0.25); }
  if (action === 'price-down') { adjustPrice(state, productId, -0.25); }
  if (action === 'case-up') { state.orderCases[productId] = Math.min(20, (state.orderCases[productId] || 1) + 1); }
  if (action === 'case-down') { state.orderCases[productId] = Math.max(1, (state.orderCases[productId] || 1) - 1); }
  if (action === 'buy-fixture') {
    const result = buyFixture(state, button.dataset.fixture);
    if (result.ok) notify('New fixture installed. Order stock for it on this tab.', 'good');
    else notify(result.reason === 'insufficient-funds' ? `Short ${money(result.shortfall)} for that fixture.` : result.reason === 'level-too-low' ? `Opens at store level ${result.level}.` : 'That fixture could not be bought.', 'danger');
  }
  if (action === 'move-fixture') {
    selectedPiece = button.dataset.piece;
    world.selection.select(selectedPiece);
    world.placement.start(button.dataset.piece, state);
    notify('Click the floor to place the fixture. R turns it, Esc cancels.', 'info');
    renderPanel({ preserveScroll: true });
  }
  if (action === 'rotate-fixture') world.placement.rotate();
  if (action === 'cancel-fixture') { world.placement.cancel(); renderPanel({ preserveScroll: true }); }
  if (action === 'place-order') {
    const result = placeOrder(state, productId, state.orderCases[productId] || 1);
    if (result.ok) {
      notify(`${result.qty} ${PRODUCT_BY_ID[productId].short.toLowerCase()} delivered to backroom.`, 'good');
      state.orderCases[productId] = 1;
    } else notify(result.reason === 'insufficient-funds' ? `Short ${money(result.shortfall)}. Use the credit line or choose fewer cases.` : 'That order could not be placed.', 'danger');
  }
  if (action === 'hire-purchasing-manager') {
    const result = hirePurchasingManager(state);
    notify(result.ok ? 'Rafael joined the team. Automatic purchasing is now active.' : result.reason === 'level-required' ? `Reach store level ${result.requiredLevel} to unlock Rafael.` : result.reason === 'insufficient-funds' ? `You need ${money(result.required)} in register cash to hire Rafael.` : 'Rafael is already on the team.', result.ok ? 'good' : 'info');
  }
  if (action === 'toggle-auto-purchase') {
    const enabled = !state.automaticPurchasingEnabled;
    setAutomaticPurchasing(state, enabled);
    notify(enabled ? 'Rafael will resume checking stock needs.' : 'Automatic supplier orders paused.', 'info');
  }

  if (action === 'borrow') {
    const result = borrowCredit(state, amount);
    notify(result.ok ? `${money(amount)} added to the register.` : `Only ${money(result.available || 0)} credit is available.`, result.ok ? 'good' : 'danger');
  }
  if (action === 'borrow-custom') {
    const value = Number($('#borrow-amount')?.value);
    const result = borrowCredit(state, value);
    notify(result.ok ? `${money(value)} added to the register.` : result.reason === 'credit-limit' ? `Only ${money(result.available)} credit is available.` : 'Enter a positive amount.', result.ok ? 'good' : 'danger');
  }
  if (action === 'repay') {
    const result = repayCredit(state, amount);
    notify(result.ok ? `${money(result.amount)} repaid.` : 'There is no available cash to repay.', result.ok ? 'good' : 'info');
  }
  if (action === 'repay-all') {
    const result = repayCredit(state);
    notify(result.ok ? `${money(result.amount)} repaid. Outstanding balance: ${money(state.debt)}.` : 'There is no available cash to repay.', result.ok ? 'good' : 'info');
  }
  if (action === 'next-day') {
    startNextDay(state);
    $('#day-summary').classList.add('hidden');
    notify(`Day ${state.day} is open. Make it count.`, 'good');
  }
  if (action === 'restart') {
    window.location.reload();
    return;
  }
  // Buying, ordering and the like happen in place: keep the list where it is rather than jumping back to the top.
  if (action && action !== 'next-day' && action !== 'restart') renderPanel({ preserveScroll: true });
  updateHeader();
  world.setState(state);
});

// The search input is replaced as the panel is re-rendered; delegate its listener.
panel.addEventListener('input', (event) => {
  if (event.target.id === 'stock-search') {
    const cursor = event.target.selectionStart;
    stockSearch = event.target.value;
    const y = panel.scrollTop;
    renderPanel();
    const next = $('#stock-search');
    next?.focus(); next?.setSelectionRange(cursor, cursor);
    panel.scrollTop = y;
  }
});

$('#open-store').addEventListener('click', () => {
  withAudioWake();
  beginDay(state);
  world.setOpen(true);
  refresh();
  notify('The shutters are up. Here comes the neighborhood.', 'good');
});

$('#pause-toggle').addEventListener('click', () => {
  togglePause(state);
  updateHeader();
});

const WALL_LABEL = { auto: 'AUTO', solid: 'SOLID', ghost: 'GHOST' };
$('#wall-toggle').addEventListener('click', () => {
  $('#wall-toggle').textContent = `WALLS · ${WALL_LABEL[world.cycleWallMode()]}`;
});

$('#sound-toggle').addEventListener('click', () => {
  audioMuted = !audioMuted;
  audio.setMuted(audioMuted);
  if (!audioMuted) audio.wake();
  $('#sound-toggle').textContent = audioMuted ? '♫̸' : '♫';
  $('#sound-toggle').classList.toggle('muted', audioMuted);
});

document.querySelectorAll('[data-speed]').forEach((button) => button.addEventListener('click', () => {
  state.speed = Number(button.dataset.speed);
  document.querySelectorAll('[data-speed]').forEach((control) => control.classList.toggle('active', control === button));
}));

// The world owns the render loop; this loop owns the business clock and UI.
let last = performance.now();
let lastSave = last;
function frame(now) {
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  realTime += dt;
  advanceGame(state, activeFrameDelta(state, dt) * 1.65);
  recordNewEvents();
  if (now - lastHeaderRender > 160) { updateHeader(); lastHeaderRender = now; }
  if (now - lastPanelRender > 900) {
    if (currentTab === 'overview' || currentTab === 'staff' || currentTab === 'finance' || currentTab === 'orders' || currentTab === 'floor' || (currentTab === 'shelves' && !$('#stock-search')?.matches(':focus'))) renderPanel({ preserveScroll: true });
    renderDaySummary();
    lastPanelRender = now;
  }
  world.setState(state);
  if (now - lastSave > 4000) {
    try { window.localStorage.setItem(SAVE_KEY, saveGameState(state)); } catch { /* Storage can be disabled or full. */ }
    lastSave = now;
  }
  requestAnimationFrame(frame);
}

refresh();
world.setOpen(state.started && !state.dayEnded);
window.addEventListener('beforeunload', () => { try { window.localStorage.setItem(SAVE_KEY, saveGameState(state)); } catch { /* Ignore unavailable storage. */ } });
requestAnimationFrame(frame);
