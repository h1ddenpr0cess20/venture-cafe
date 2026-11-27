import './style.css';
import { createAudio } from 'madness-engine/audio';
import {
  INGREDIENTS, INGREDIENT_BY_ID, STAFF, createGameState, money, productNow, activeFrameDelta,
  openIngredients, isOpen, getStoreLevel, getStoreLevelProgress, pantryQuantity, expiredQuantity, oldestLot, recipeCost,
  isExpired, qtyOf, pullExpired, adjustMenuPrice, placeOrder, borrowCredit, repayCredit, advanceGame, beginDay,
  togglePause, startNextDay, saveGameState, loadGameState, trafficLabel, reviewSummary, pantryHealth,
  ownerActionsFor, staffActionsFor, talkToGuest, talkToStaff, guestMood, crewStatus,
} from './sim.js';
import { createVentureCafeWorld } from './world.js';
import { CAFE_MENU } from './menu.js';
import { CAFE_TABLES, CAFE_BOOTHS, CAFE_BAR_STOOLS, CAFE_SEATS } from './layout.js';

const $ = (selector) => document.querySelector(selector);
const panel = $('#panel-content');
const SAVE_KEY = 'venture-cafe.save.v2';
let state;
try { state = loadGameState(window.localStorage.getItem(SAVE_KEY)); } catch { state = null; }
state ??= createGameState();
window.__ventureCafeState = state;

let currentTab = 'overview';
let selectedIngredient = 'eggs';
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
updateLoading('Starting up', 0);
let world;
try {
  world = await createVentureCafeWorld($('#world'), updateLoading);
  world.setState(state);
  updateLoading('Ready', 100);
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
  if (!batch) return 'NONE IN STOCK';
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
  toast.innerHTML = `<span class="toast-icon">${kind === 'danger' ? '!' : kind === 'good' ? '✓' : 'i'}</span><span>${escapeHtml(message)}</span>`;
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
    else if (event.type === 'staff' && (event.message.includes('served '))) notify(event.message, 'good');
    else if (event.type === 'review') {
      const rating = Number(event.message.match(/(\d)-star/)?.[1] ?? 3);
      notify(`New review · ${rating} stars`, rating <= 2 ? 'danger' : rating === 5 ? 'good' : 'info');
      renderReviewFeed();
      if (currentTab === 'reviews') renderPanel({ preserveScroll: true });
    }
  }
  previousEventSequence = Math.max(previousEventSequence, state.eventSequence);
  previousReviewSequence = Math.max(previousReviewSequence, state.reviewSequence);
}

/** The card that appears when the owner stands near a guest or a crew member: who they are, how they are, and what to say. */
let cardKey = '';
function updateInteractCard() {
  const card = $('#interact-card');
  if (!card) return;
  const near = state.started && !state.paused && !state.dayEnded ? world.nearby : null;
  let html = '', key = '';
  const buttons = (kind, id, actions) => actions.length
    ? `<div class="interact-actions">${actions.map((action, index) => `<button type="button" data-action="owner-talk" data-kind="${kind}" data-id="${id}" data-act="${action.id}"><kbd>${index + 1}</kbd><span>${escapeHtml(action.label)}<small>${escapeHtml(action.hint)}</small></span></button>`).join('')}</div>`
    : '<p class="interact-none">Nothing to say right now.</p>';
  if (near?.kind === 'guest') {
    const guest = state.customers.find((customer) => customer.id === near.id);
    if (guest) {
      const actions = ownerActionsFor(state, guest), mood = guestMood(state, guest);
      key = `g${guest.id}|${mood}|${actions.map((action) => action.id)}`;
      html = `<div class="interact-head"><strong>${escapeHtml(guest.name)}</strong><span>${escapeHtml(guest.tag)}${guest.partySize > 1 ? ` · party of ${guest.partySize}` : ''}</span></div>
        <div class="interact-mood">${escapeHtml(mood)}${guest.comped ? ' · on the house' : ''}</div>${buttons('guest', guest.id, actions)}`;
    }
  } else if (near?.kind === 'staff') {
    const person = crewStatus(state).find((candidate) => candidate.id === near.id);
    const actions = staffActionsFor(state, near.id);
    key = `s${person.id}|${person.morale}|${actions.map((action) => action.id)}`;
    html = `<div class="interact-head"><strong>${escapeHtml(person.name)}</strong><span>${escapeHtml(person.role)}</span></div>
      <div class="interact-mood">${person.mood} · morale ${person.morale}</div>
      <div class="debt-meter morale-meter"><i style="width:${person.morale}%"></i></div>${buttons('staff', person.id, actions)}`;
  }
  if (key === cardKey) return;
  cardKey = key;
  card.innerHTML = html;
  card.classList.toggle('hidden', !html);
}

function updateHeader() {
  $('#cash-value').textContent = money(state.cash);
  $('#debt-value').textContent = money(state.debt);
  $('#revenue-value').textContent = money(state.dayStats.revenue);
  $('#rep-value').textContent = Math.round(state.reputation);
  $('#rep-meter').style.width = `${state.reputation}%`;
  $('#day-label').textContent = `Day ${state.day}`;
  $('#clock-value').textContent = fmtClock(state.minute);
  const status = !state.started ? 'Closed' : state.dayEnded ? 'Closed for the day' : state.paused ? 'Paused' : 'Open';
  $('#shop-status').textContent = status;
  $('#open-pill').classList.toggle('is-open', state.started && !state.dayEnded);
  $('#open-pill').querySelector('span').textContent = state.dayEnded ? 'Closed' : state.paused ? (state.started ? 'Paused' : 'Closed') : 'Open';
  $('#pause-toggle').textContent = state.paused ? '▶' : 'Ⅱ';
  $('#pause-toggle').title = state.paused ? 'Resume' : 'Pause';
  $('#foot-customers').textContent = `${state.customers.length} ${state.customers.length === 1 ? 'diner' : 'diners'}`;
  $('#foot-traffic').textContent = `Traffic ${trafficLabel(state).toLowerCase()}`;
  const waiterTask = state.waiterWork ?? { stage: 'idle' };
  const waitingTables = state.customers.filter((customer) => customer.serviceStatus !== 'served').length;
  const waiterLabel = waiterTask.stage === 'taking-order' ? 'Waiter taking an order'
    : waiterTask.stage === 'preparing-order' ? 'Kitchen cooking'
      : ['walking-to-delivery', 'presenting'].includes(waiterTask.stage) ? 'Waiter serving'
        : ['walking-to-table', 'returning-to-kitchen'].includes(waiterTask.stage) ? 'Waiter on the floor' : null;
  $('#foot-staff').textContent = waiterLabel ?? (waitingTables ? `${waitingTables} ${waitingTables === 1 ? 'order' : 'orders'} in service` : `${STAFF.length} crew on shift`);
  const health = pantryHealth(state);
  const alertCount = health.expired ? health.empty + health.low + 1 : health.empty + health.low;
  const expiredUnits = health.expired;
  $('#shelf-alert-count').textContent = alertCount;
  $('#shelf-alert-count').classList.toggle('hidden', alertCount === 0);
  $('#start-overlay').classList.toggle('hidden', state.started);
  $('#player-controls')?.classList.toggle('hidden', !state.started || state.paused || state.dayEnded || state.gameOver);
  $('#pause-toggle').disabled = !state.started || state.dayEnded;
  $('#sound-toggle').textContent = audioMuted ? '♪̸' : '♪';
  $('#sound-toggle').classList.toggle('muted', audioMuted);
  document.querySelectorAll('[data-speed]').forEach((button) => button.classList.toggle('active', Number(button.dataset.speed) === state.speed));
}

function eventIcon(type) {
  return ({ owner: '“', sale: '+', customer: '•', danger: '!', warning: '!', order: '•', stock: '•', staff: '•', level: '↑', waste: '×', finance: '$', close: '•', good: '✓', note: '•', review: '★' })[type] ?? '•';
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
      <div class="review-score-copy"><b>${summary.count} cafe reviews</b><span>${Math.round(state.reputation)} / 100 reputation</span></div>
      <div class="rating-distribution">${distribution.map((row) => `<div class="rating-bar"><span>${row.rating}</span><i><b style="width:${row.count / total * 100}%"></b></i><small>${row.count}</small></div>`).join('')}</div>
    </div>
    <div class="review-footfall"><span><i class="live-dot"></i> Foot traffic</span><strong class="traffic-${trafficLabel(state).toLowerCase()}">${trafficLabel(state)}</strong><small>${state.reputation >= 86 ? 'Guests are recommending the cafe.' : state.reputation >= 68 ? 'A normal number of walk-ins.' : state.reputation >= 45 ? 'Fewer walk-ins than usual.' : 'Word of mouth is keeping people away.'}</small></div>
    <div class="review-feed-heading"><span>Recent reviews</span><small>Newest first</small></div>
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
        ${review.ownerVisited ? '<div class="review-owner-note">The owner stopped by their table.</div>' : ''}
        ${Number.isFinite(review.foodQuality) && Number.isFinite(review.serviceQuality) ? `<div class="review-quality"><span>FOOD <b>${review.foodQuality}/100</b></span><span>SERVICE <b>${review.serviceQuality}/100</b></span></div>` : ''}
        ${review.outcome === 'food-poor' ? '<div class="review-response-note">Kitchen quality was the main issue on this visit.</div>' : review.outcome === 'service-poor' ? '<div class="review-response-note">Table service was the main issue on this visit.</div>' : ''}
      </article>`;
    }).join('') || '<div class="empty-state compact">No reviews yet. They appear after guests are served.</div>'}</div>
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

function ingredientFlag(ingredient) {
  const lot = oldestLot(state, ingredient.id);
  const left = lot ? lot.expiresAt - productNow(state) : Infinity;
  const good = pantryQuantity(state, ingredient.id) - expiredQuantity(state, ingredient.id);
  if (expiredQuantity(state, ingredient.id)) return '<span class="tag tag-danger">EXPIRED</span>';
  if (good <= 0) return '<span class="tag tag-muted">OUT</span>';
  if (left < 2) return '<span class="tag tag-warning">DATE CHECK</span>';
  if (good < ingredient.caseSize * 0.25) return '<span class="tag tag-warning">LOW</span>';
  return '<span class="tag tag-good">STOCKED</span>';
}

/** How many dishes of this kind the walk-in could still cook, given the ingredient that runs out first. */
function dishesLeft(item) {
  const now = productNow(state);
  return Math.min(...Object.entries(item.ingredients).map(([id, need]) => Math.floor(qtyOf(state.pantry[id].filter((lot) => !isExpired(lot, now))) / need)));
}

function levelCard() {
  const progress = getStoreLevelProgress(state);
  const next = CAFE_MENU.filter((item) => item.level === progress.level + 1).map((item) => item.name);
  return `<div class="level-card">
    <div class="level-card-top"><span>CAFE LEVEL</span><strong>${progress.level}</strong></div>
    <div class="debt-meter level-meter"><i style="width:${progress.progress}%"></i></div>
    <small>${progress.remaining} XP to level ${progress.level + 1}${next.length ? ` · adds ${escapeHtml(next.join(' and '))}` : ''}</small>
  </div>`;
}

function overviewPanel() {
  const ingredients = openIngredients(state);
  const urgent = ingredients.filter((ingredient) => expiredQuantity(state, ingredient.id) || pantryQuantity(state, ingredient.id) < ingredient.caseSize * 0.25).slice(0, 5);
  const active = state.customers.length;
  const ordersWaiting = state.customers.filter((customer) => customer.serviceStatus !== 'served').length;
  const served = state.dayStats.ordersServed ?? 0;
  const foodQuality = served ? Math.round(state.dayStats.foodQualityTotal / served) : 0;
  const serviceQuality = served ? Math.round(state.dayStats.serviceQualityTotal / served) : 0;
  const grossMargin = state.dayStats.revenue > 0 ? Math.round((state.dayStats.grossProfit / state.dayStats.revenue) * 100) : 0;
  return `
    <div class="panel-section">
      <div class="section-heading"><div><div class="eyebrow">Today</div><h3>Today's service</h3></div><span class="subtle">DAY ${state.day}</span></div>
      <div class="metric-grid">
        <div class="metric-card"><span>SALES</span><strong>${money(state.dayStats.revenue)}</strong><small>${served} meals served · ${grossMargin}% gross margin</small></div>
        <div class="metric-card"><span>DINER COVERS</span><strong>${state.dayStats.customers}</strong><small>${active} currently in the dining room</small></div>
        <div class="metric-card"><span>FOOD QUALITY</span><strong>${served ? foodQuality + '/100' : '—'}</strong><small>Kitchen execution and ingredient freshness</small></div>
        <div class="metric-card"><span>SERVICE QUALITY</span><strong>${served ? serviceQuality + '/100' : '—'}</strong><small>Order-taking, wait time and table service</small></div>
      </div>
      <div class="service-queue"><span>${ordersWaiting} ORDERS IN SERVICE</span><small>Guests are seated first, then the waiter takes the order and sends it to the kitchen.</small></div>
      ${levelCard()}
    </div>
    <div class="panel-section">
      <div class="section-heading"><div><div class="eyebrow">KITCHEN CHECK</div><h3>Ingredients to watch</h3></div><span class="subtle">${urgent.length} NEED ATTENTION</span></div>
      ${urgent.length ? `<div class="attention-list">${urgent.map((ingredient) => {
        const expired = expiredQuantity(state, ingredient.id);
        return `<button class="attention-row" data-action="select-ingredient" data-ingredient="${ingredient.id}"><span class="attention-mark ${expired ? 'mark-danger' : 'mark-warning'}">${expired ? '!' : '◷'}</span><span><strong>${escapeHtml(ingredient.short)}</strong><small>${expired ? `${expired} expired portions` : `${pantryQuantity(state, ingredient.id)} portions left`}</small></span><span class="attention-go">›</span></button>`;
      }).join('')}</div>` : '<div class="empty-state compact"><strong>The walk-in is in good shape.</strong><p>Keep rotating the oldest fresh ingredients first.</p></div>'}
      <div class="action-pair"><button class="secondary-button" data-action="pull-expired">PULL EXPIRED</button><button class="secondary-button" data-action="reorder-low">REORDER LOW STOCK</button></div>
    </div>
    <div class="panel-section">
      <div class="section-heading"><div><div class="eyebrow">Live</div><h3>Latest activity</h3></div><span class="subtle">LIVE</span></div>
      ${renderActivity(5)}
    </div>`;
}

const FILTERS = ['All', 'Eggs', 'Dairy', 'Bakery', 'Produce', 'Drinks'];

/** The menu, and the lever on each dish: its price. */
function menuPanel() {
  const groups = ['Skillet', 'Eggs', 'Omelette', 'Bakery', 'Drinks'];
  const level = getStoreLevel(state);
  return groups.map((category) => {
    const items = CAFE_MENU.filter((item) => item.category === category);
    if (!items.length) return '';
    return `<div class="panel-section">
      <div class="section-heading"><div><div class="eyebrow">BREAKFAST MENU</div><h3>${category}</h3></div><span class="subtle">${items.filter((item) => item.level <= level).length} ON THE MENU · ${items.length} ITEMS</span></div>
      <div class="menu-list">${items.map((item) => {
        const open = item.level <= level;
        const price = state.menuPrices[item.id] ?? item.price;
        const margin = Math.round((1 - recipeCost(item) / price) * 100);
        const left = open ? dishesLeft(item) : 0;
        return `<article class="menu-item ${open ? '' : 'menu-item-locked'}">
          <div class="menu-item-copy"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description)}</small>
            <span>${escapeHtml(item.prep)} · ${open ? `${margin}% MARGIN · ${left} CAN BE COOKED` : `OPENS AT CAFE LEVEL ${item.level}`}</span></div>
          ${open ? `<span class="price-stepper"><button data-action="price-down" data-dish="${item.id}" aria-label="Lower the price of ${escapeHtml(item.name)}">−</button><b class="${price > item.price ? 'text-warning' : ''}">${money(price)}</b><button data-action="price-up" data-dish="${item.id}" aria-label="Raise the price of ${escapeHtml(item.name)}">+</button></span>` : `<b>${money(item.price)}</b>`}
        </article>`;
      }).join('')}</div>
    </div>`;
  }).join('') + '<div class="panel-section supplier-tip"><span><strong>Pricing.</strong><small>Regulars forgive a little. Past what a guest thinks a dish is worth, they pay, call the cafe pricey, and tell their neighbors.</small></span></div>';
}

function ingredientPanel() {
  const visible = openIngredients(state).filter((ingredient) => (stockFilter === 'All' || ingredient.category === stockFilter)
    && `${ingredient.name} ${ingredient.category}`.toLowerCase().includes(stockSearch.toLowerCase()));
  const rows = visible.map((ingredient) => {
    const front = oldestLot(state, ingredient.id);
    return `<button class="stock-row ${ingredient.id === selectedIngredient ? 'selected' : ''}" data-action="select-ingredient" data-ingredient="${ingredient.id}">
      <span class="product-swatch" style="--swatch:${ingredient.color}"></span>
      <span class="stock-main"><strong>${escapeHtml(ingredient.short)}</strong><small>${escapeHtml(ingredient.category)} · ${expiryCopy(front)}</small></span>
      <span class="stock-count"><b>${pantryQuantity(state, ingredient.id)}</b><small>PORTIONS</small></span>
      <span class="stock-chevron">›</span>
    </button>`;
  }).join('');
  if (!isOpen(state, selectedIngredient)) selectedIngredient = 'eggs';
  const ingredient = INGREDIENT_BY_ID[selectedIngredient];
  const lots = [...state.pantry[selectedIngredient]].sort((a, b) => a.expiresAt - b.expiresAt);
  const totalExpired = expiredQuantity(state, selectedIngredient);
  const usedIn = CAFE_MENU.filter((item) => selectedIngredient in item.ingredients).map((item) => item.name);
  return `
    <div class="panel-section inventory-toolbar">
      <div class="section-heading"><div><div class="eyebrow">THE WALK-IN</div><h3>Ingredient stock</h3></div><span class="subtle">${openIngredients(state).length} INGREDIENTS</span></div>
      <label class="search-box"><span>⌕</span><input id="stock-search" type="search" placeholder="Find an ingredient…" value="${escapeHtml(stockSearch)}" /></label>
      <div class="filter-row">${FILTERS.map((filter) => `<button class="filter-chip ${stockFilter === filter ? 'active' : ''}" data-action="filter-stock" data-filter="${filter}">${filter}</button>`).join('')}</div>
      <div class="stock-list">${rows || '<div class="empty-state compact">No ingredients match that search.</div>'}</div>
    </div>
    <div class="panel-section product-detail">
      <div class="section-heading"><div><div class="eyebrow">SELECTED INGREDIENT</div><h3>${escapeHtml(ingredient.name)}</h3></div>${ingredientFlag(ingredient)}</div>
      <p class="product-description">${escapeHtml(ingredient.description)}</p>
      <div class="detail-quantities"><div><span>IN THE WALK-IN</span><strong>${pantryQuantity(state, selectedIngredient)}</strong></div><div><span>EXPIRED</span><strong class="${totalExpired ? 'text-danger' : ''}">${totalExpired}</strong></div><div><span>SHELF LIFE</span><strong>${ingredient.shelfLife} d</strong></div></div>
      <div class="fifo-heading"><span>USE-BY DATE ROTATION</span><span>OLDEST COOKED FIRST</span></div>
      <div class="batch-list">${lots.slice(0, 5).map((lot, index) => {
        const left = lot.expiresAt - productNow(state);
        return `<div class="batch-row"><span class="batch-position ${index === 0 ? 'front' : ''}">${String(index + 1).padStart(2, '0')}</span><span class="batch-label"><strong>${index === 0 ? 'Next in the pan' : 'Behind it'}</strong><small>${lot.qty} portions · ${left <= 0 ? 'expired' : `${Math.max(1, Math.ceil(left))} days left`}</small></span><span class="tag tag-${expiryTone(lot)}">${left <= 0 ? 'EXPIRED' : left < 2 ? 'SOON' : 'FRESH'}</span></div>`;
      }).join('') || '<div class="empty-state compact">None in the walk-in. Place a supplier order.</div>'}</div>
      <div class="price-editor"><div><span>SUPPLIER COST</span><strong>${money(ingredient.cost)} / PORTION</strong><small>Case of ${ingredient.caseSize} · ${money(ingredient.cost * ingredient.caseSize)} · used in ${escapeHtml(usedIn.join(', '))}</small></div></div>
      <div class="action-pair"><button class="primary-button" data-action="place-order" data-ingredient="${selectedIngredient}">Order a case</button><button class="secondary-button ${totalExpired ? 'danger-button' : ''}" data-action="pull-ingredient-expired" data-ingredient="${selectedIngredient}">PULL EXPIRED</button></div>
    </div>`;
}

/** The dining room: how many seats are taken, and the cafe's furniture. */
function diningPanel() {
  const occupied = new Set(state.customers.map((customer) => customer.seatId).filter(Boolean));
  const seatingRow = (label, seats) => {
    const taken = seats.filter((seat) => occupied.has(seat.id)).length;
    return `<div class="order-row">
      <span class="product-swatch" style="--swatch:#8a5a35"></span>
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
        <div class="metric-card"><span>TABLES</span><strong>${CAFE_TABLES.length}</strong><small>Square walnut four-tops</small></div>
        <div class="metric-card"><span>BOOTHS</span><strong>${CAFE_BOOTHS.length}</strong><small>A bench on each side</small></div>
        <div class="metric-card"><span>OCCUPIED</span><strong>${occupiedCount}</strong><small>${diningSeats.length - occupiedCount} seats available</small></div>
        <div class="metric-card"><span>COUNTER STOOLS</span><strong>${CAFE_BAR_STOOLS.length}</strong><small>Perch seating along the service bar</small></div>
      </div>
    </div>
    <div class="panel-section">
      <div class="section-heading"><div><div class="eyebrow">TABLE SERVICE</div><h3>Seating by area</h3></div></div>
      <div class="order-category"><div class="order-category-title">TABLES<span>${CAFE_TABLES.length} AREAS</span></div>${tableRows}</div>
      <div class="order-category"><div class="order-category-title">BOOTHS<span>${CAFE_BOOTHS.length} AREAS</span></div>${boothRows}</div>
    </div>
    <div class="panel-section supplier-tip"><span><strong>How service works.</strong><small>Guests are seated first. The waiter takes the order, Bob prepares the meal, and the waiter brings it to the table.</small></span></div>`;
}

function ordersPanel() {
  const open = openIngredients(state);
  const locked = INGREDIENTS.filter((ingredient) => !isOpen(state, ingredient));
  const categories = [...new Set(open.map((ingredient) => ingredient.category))];
  const grouped = categories.map((category) => {
    const lines = open.filter((ingredient) => ingredient.category === category);
    return `<div class="order-category"><div class="order-category-title">${escapeHtml(category)}<span>${lines.length} ${lines.length === 1 ? 'INGREDIENT' : 'INGREDIENTS'}</span></div>${lines.map((ingredient) => {
      const cases = state.orderCases[ingredient.id] || 1;
      const total = ingredient.cost * ingredient.caseSize * cases;
      return `<div class="order-row">
        <span class="product-swatch" style="--swatch:${ingredient.color}"></span>
        <span class="order-product"><strong>${escapeHtml(ingredient.short)}</strong><small>${ingredient.caseSize} per case · ${money(ingredient.cost)} each</small><small>${pantryQuantity(state, ingredient.id)} in the walk-in</small></span>
        <span class="order-controls"><span class="case-stepper"><button data-action="case-down" data-ingredient="${ingredient.id}" aria-label="Fewer cases of ${escapeHtml(ingredient.short)}">−</button><b>${cases}</b><button data-action="case-up" data-ingredient="${ingredient.id}" aria-label="More cases of ${escapeHtml(ingredient.short)}">+</button></span><strong>${money(total)}</strong><button class="mini-order-button" data-action="place-order" data-ingredient="${ingredient.id}">ORDER</button></span>
      </div>`;
    }).join('')}</div>`;
  }).join('');
  return `
    <div class="panel-section order-intro">
      <div class="section-heading"><div><div class="eyebrow">Supplier</div><h3>Place an order</h3></div><span class="tag tag-muted">SAME-DAY DROP</span></div>
      <p class="product-description">Cases go straight into the walk-in. The kitchen always cooks from the shortest-dated lot first.</p>
      <div class="supplier-credit"><span>AVAILABLE CASH</span><strong>${money(state.cash)}</strong><small>Credit is separate. Draw it on the Books tab before ordering.</small></div>
    </div>
    <div class="order-catalog">${grouped}</div>
    ${locked.length ? `<div class="panel-section"><div class="section-heading"><div><div class="eyebrow">NOT YET ON THE MENU</div><h3>Opens with new dishes</h3></div></div><div class="locked-list">${locked.map((ingredient) => `<span><b>${escapeHtml(ingredient.short)}</b> · cafe level ${ingredient.level}</span>`).join('')}</div></div>` : ''}
    <div class="panel-section supplier-tip"><span><strong>Watch the dates.</strong><small>Milk, bread and tomatoes turn within days. Eggs, butter and coffee keep far longer.</small></span></div>`;
}

function financePanel() {
  const available = Math.max(0, state.creditLimit - state.debt);
  const debtRatio = Math.min(100, state.debt / state.creditLimit * 100);
  const interest = state.debt * state.creditRate;
  return `
    <div class="panel-section">
      <div class="section-heading"><div><div class="eyebrow">Money</div><h3>Books & borrowing</h3></div><span class="tag ${state.debt ? 'tag-warning' : 'tag-good'}">${state.debt ? 'CREDIT ACTIVE' : 'DEBT FREE'}</span></div>
      <div class="finance-card"><div class="finance-card-top"><span>OUTSTANDING BALANCE</span><strong>${money(state.debt)}</strong></div><div class="debt-meter"><i style="width:${debtRatio}%"></i></div><div class="finance-card-foot"><span>${money(available)} available</span><span>${money(state.creditLimit)} limit</span></div></div>
      <div class="loan-terms"><div><span>DAILY INTEREST</span><strong>1.25%</strong></div><div><span>INTEREST AT CURRENT BALANCE</span><strong>${money(interest)} / day</strong></div><div><span>PAYMENT DUE</span><strong>End of each day</strong></div></div>
    </div>
    <div class="panel-section">
      <div class="section-heading"><div><div class="eyebrow">SHORT-TERM CREDIT</div><h3>Draw funds</h3></div></div>
      <p class="product-description">Use credit to cover a supplier order or a rough day. Interest compounds into the balance at close. Borrow only what you can repay.</p>
      <div class="borrow-form"><label for="borrow-amount">AMOUNT TO DRAW</label><div class="borrow-input"><span>$</span><input id="borrow-amount" type="number" min="25" max="${available}" step="25" value="250" /></div><button class="primary-button" data-action="borrow-custom">DRAW CREDIT</button></div>
      <div class="quick-amounts">${[100, 250, 500].map((amount) => `<button class="secondary-button" data-action="borrow" data-amount="${amount}" ${available < amount ? 'disabled' : ''}>+${money(amount)}</button>`).join('')}</div>
    </div>
    <div class="panel-section">
      <div class="section-heading"><div><div class="eyebrow">Credit</div><h3>Repayment</h3></div></div>
      <div class="repay-card"><div><strong>${money(state.debt)}</strong><small>Current principal + interest</small></div><button class="primary-button" data-action="repay-all" ${state.debt <= 0 || state.cash <= 0 ? 'disabled' : ''}>PAY IN FULL</button></div>
      <div class="quick-amounts">${[100, 250, 500].map((amount) => `<button class="secondary-button" data-action="repay" data-amount="${amount}" ${state.debt <= 0 || state.cash <= 0 ? 'disabled' : ''}>PAY ${money(amount)}</button>`).join('')}</div>
      <div class="fine-print">Repayments are taken from the register immediately. You cannot repay more cash than you have.</div>
    </div>
    <div class="panel-section">
      <div class="section-heading"><div><div class="eyebrow">Running costs</div><h3>Daily overhead</h3></div></div>
      <div class="cost-list"><div><span>Rent</span><b>${money(state.dailyCosts.rent)}</b></div><div><span>Payroll · ${STAFF.length} staff</span><b>${money(state.dailyCosts.payroll)}</b></div><div><span>Utilities & refrigeration</span><b>${money(state.dailyCosts.utilities)}</b></div><div><span>Interest (added to balance)</span><b>${money(interest)}</b></div><div class="cost-total"><span>Expected daily overhead</span><b>${money(state.dailyCosts.rent + state.dailyCosts.payroll + state.dailyCosts.utilities + interest)}</b></div></div>
    </div>`;
}

function staffPanel() {
  const initials = (person) => person.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const waiterStage = state.waiterWork?.stage ?? 'idle';
  const waiterStatus = waiterStage === 'idle' ? 'On standby' : waiterStage === 'taking-order' ? 'Taking an order' : waiterStage === 'preparing-order' ? 'Waiting on the kitchen' : ['walking-to-delivery', 'presenting'].includes(waiterStage) ? 'Serving breakfast' : 'On the floor';
  const crew = crewStatus(state);
  const tone = (morale) => (morale >= 60 ? 'good' : morale >= 40 ? 'warning' : 'danger');
  return `
    <div class="panel-section">
      <div class="section-heading"><div><div class="eyebrow">Your crew</div><h3>Morale and work</h3></div><span class="tag tag-good">${STAFF.length} on shift</span></div>
      <p class="product-description">Walk up to someone and press a number to talk. Morale moves how well they work: a tired cook turns out worse plates, a worn-down host seats people slower. The work itself wears it down, and a good word, praise or a bonus brings it back.</p>
      <div class="staff-list">${crew.map((person, index) => `<div class="staff-card staff-card-wide">
        <div class="staff-avatar staff-avatar-${index}">${initials(person)}</div>
        <div class="staff-copy"><strong>${escapeHtml(person.name)}</strong><span>${escapeHtml(person.role)}</span><small>${money(STAFF[index].wage)} / day</small></div>
        <div class="staff-morale"><span class="tag tag-${tone(person.morale)}">${person.mood}</span><div class="debt-meter morale-meter"><i style="width:${person.morale}%"></i></div><small>Morale ${person.morale} · work quality ${person.quality}${person.quality !== person.baseQuality ? ` (usually ${person.baseQuality})` : ''}</small></div>
      </div>`).join('')}</div>
      <div class="staff-task-card">
        <div class="staff-task-heading"><strong>Table service</strong><span>${waiterStatus}</span></div>
        <p>The waiter takes each table's orders, Bob cooks them, and the waiter brings them out together.</p>
      </div>
    </div>
    <div class="panel-section">
      <div class="section-heading"><div><div class="eyebrow">Housekeeping</div><h3>Kitchen standards</h3></div></div>
      <div class="standards-list"><div><span>✓</span> Rotate stock by expiry date, not delivery date.</div><div><span>✓</span> Keep milk, eggs and butter cold.</div><div><span>✓</span> Pull expired ingredients from the walk-in.</div><div><span>✓</span> Keep enough cash in the register for wages and bonuses.</div></div>
    </div>`;
}

function renderPanel({ preserveScroll = false } = {}) {
  const oldScroll = panel.scrollTop;
  if (currentTab === 'overview') panel.innerHTML = overviewPanel();
  else if (currentTab === 'shelves') panel.innerHTML = ingredientPanel();
  else if (currentTab === 'menu') panel.innerHTML = menuPanel();
  else if (currentTab === 'orders') panel.innerHTML = ordersPanel();
  else if (currentTab === 'floor') panel.innerHTML = diningPanel();
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
      <div class="summary-eyebrow">Day ${summary.day} closed</div>
      <h2>${state.gameOver ? 'The cafe has closed for good.' : 'Day done.'}</h2>
      <p>${state.gameOver ? 'The cafe ran out of money or reputation.' : 'Count the till, check the walk-in, and get ready for tomorrow.'}</p>
      <div class="summary-metrics"><div><span>SALES</span><b>${money(summary.revenue)}</b></div><div><span>GROSS PROFIT</span><b>${money(summary.grossProfit)}</b></div><div><span>DINERS</span><b>${summary.customers}</b></div><div><span>FOOD / SERVICE</span><b>${summary.averageFoodQuality ?? 0} / ${summary.averageServiceQuality ?? 0}</b></div></div>
      <div class="summary-costs"><div><span>Rent</span><b>${money(summary.expenses.rent)}</b></div><div><span>Payroll</span><b>${money(summary.expenses.payroll)}</b></div><div><span>Utilities</span><b>${money(summary.expenses.utilities)}</b></div>${summary.expenses.bonuses ? `<div><span>Bonuses</span><b>${money(summary.expenses.bonuses)}</b></div>` : ''}<div><span>Credit interest</span><b>${money(summary.expenses.interest)}</b></div><div><span>Inventory purchased</span><b>${money(summary.purchases)}</b></div><div><span>Expired stock written off</span><b>${money(summary.waste)}</b></div></div>
      <div class="summary-net ${isOver ? 'negative' : 'positive'}"><span>Result after running costs</span><strong>${summary.net >= 0 ? '+' : '−'}${money(Math.abs(summary.net))}</strong></div>
      <div class="summary-balance"><span>REGISTER ${money(summary.cash)}</span><span>CREDIT ${money(summary.debt)}</span></div>
      ${state.gameOver ? '<button class="primary-button summary-next" data-action="restart">Start a new cafe</button>' : '<button class="primary-button summary-next" data-action="next-day">Open tomorrow</button>'}
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
  const ingredientId = button.dataset.ingredient;
  const amount = Number(button.dataset.amount);
  if (action === 'select-ingredient') { selectedIngredient = ingredientId; currentTab = 'shelves'; renderPanel(); return; }
  if (action === 'filter-stock') { stockFilter = button.dataset.filter; renderPanel(); return; }
  if (action === 'pull-expired') {
    const result = pullExpired(state);
    notify(result.removed ? `${result.removed} expired portions pulled · ${money(result.loss)} written off.` : 'No expired stock found.', result.removed ? 'good' : 'info');
  }
  if (action === 'pull-ingredient-expired') {
    const ingredient = INGREDIENT_BY_ID[ingredientId];
    const result = pullExpired(state, ingredientId);
    notify(result.removed ? `${result.removed} ${ingredient.short.toLowerCase()} removed.` : `No expired ${ingredient.short.toLowerCase()} found.`, result.removed ? 'good' : 'info');
  }
  if (action === 'reorder-low') {
    let ordered = 0, spent = 0;
    for (const ingredient of openIngredients(state)) {
      const good = pantryQuantity(state, ingredient.id) - expiredQuantity(state, ingredient.id);
      if (good >= ingredient.caseSize * 0.25) continue;
      const result = placeOrder(state, ingredient.id, 1);
      if (result.ok) { ordered += 1; spent += result.total; }
    }
    notify(ordered ? `${ordered} low ingredient${ordered === 1 ? '' : 's'} reordered · ${money(spent)}.` : 'Nothing is running low, or there is not enough cash.', ordered ? 'good' : 'info');
  }
  if (action === 'price-up' || action === 'price-down') adjustMenuPrice(state, button.dataset.dish, action === 'price-up' ? 0.25 : -0.25);
  if (action === 'case-up') { state.orderCases[ingredientId] = Math.min(20, (state.orderCases[ingredientId] || 1) + 1); }
  if (action === 'case-down') { state.orderCases[ingredientId] = Math.max(1, (state.orderCases[ingredientId] || 1) - 1); }
  if (action === 'place-order') {
    const cases = currentTab === 'shelves' ? 1 : state.orderCases[ingredientId] || 1;
    const result = placeOrder(state, ingredientId, cases);
    if (result.ok) {
      notify(`${result.qty} ${INGREDIENT_BY_ID[ingredientId].short.toLowerCase()} delivered to the walk-in.`, 'good');
      state.orderCases[ingredientId] = 1;
    } else notify(result.reason === 'insufficient-funds' ? `Short ${money(result.shortfall)}. Use the credit line or choose fewer cases.` : 'That order could not be placed.', 'danger');
  }
  if (action === 'owner-talk') {
    const kind = button.dataset.kind, act = button.dataset.act;
    const id = kind === 'guest' ? Number(button.dataset.id) : button.dataset.id;
    const result = kind === 'guest' ? talkToGuest(state, id, act) : talkToStaff(state, id, act);
    if (result.ok) {
      const name = kind === 'guest' ? state.customers.find((customer) => customer.id === id)?.name : crewStatus(state).find((person) => person.id === id).name.split(' ')[0];
      const extra = kind === 'staff' ? ` (morale ${result.gained >= 0 ? '+' : ''}${Math.round(result.gained)})` : result.detail ? ` ${result.detail}` : '';
      notify(`${name}: “${result.reply}”${extra}`, 'good');
      world.speak(kind, id);
      if (!audioMuted) audio.tone({ freq: 520, to: 600, length: 0.08, gain: 0.05, type: 'triangle' });
    } else notify('That does not suit them right now.', 'info');
    cardKey = '';
    updateInteractCard();
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
    notify(`Day ${state.day} is open.`, 'good');
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

window.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || !/^[1-9]$/.test(event.key)) return;
  const focused = document.activeElement;
  if (focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA' || focused.isContentEditable)) return;
  const options = document.querySelectorAll('#interact-card button[data-action="owner-talk"]');
  const option = options[Number(event.key) - 1];
  if (option) { option.click(); event.preventDefault(); }
});

/** The office panel can be hidden so the scene has the whole window. */
const PANEL_KEY = 'venture-cafe.office-hidden';
function setPanelHidden(hidden) {
  $('#workspace').classList.toggle('panel-collapsed', hidden);
  $('#panel-toggle').textContent = hidden ? 'Show office' : 'Hide office';
  $('#panel-toggle').setAttribute('aria-expanded', String(!hidden));
  try { window.localStorage.setItem(PANEL_KEY, hidden ? '1' : '0'); } catch { /* Storage can be unavailable. */ }
  window.dispatchEvent(new Event('resize'));                 // the scene refits to the room it now has
}
const togglePanel = () => setPanelHidden(!$('#workspace').classList.contains('panel-collapsed'));
$('#panel-toggle').addEventListener('click', togglePanel);
$('#panel-close').addEventListener('click', togglePanel);
window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() !== 'o' || event.ctrlKey || event.metaKey || event.altKey) return;
  const focused = document.activeElement;
  if (focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA' || focused.isContentEditable)) return;
  togglePanel();
});
try { if (window.localStorage.getItem(PANEL_KEY) === '1') setPanelHidden(true); } catch { /* Start with the office showing. */ }

$('#open-store').addEventListener('click', () => {
  withAudioWake();
  beginDay(state);
  world.setOpen(true);
  refresh();
  notify('The cafe is open.', 'good');
});

$('#pause-toggle').addEventListener('click', () => {
  togglePause(state);
  updateHeader();
});

const WALL_LABEL = { auto: 'Auto', solid: 'Solid', ghost: 'See-through' };
$('#wall-toggle').addEventListener('click', () => {
  $('#wall-toggle').textContent = `Walls: ${WALL_LABEL[world.cycleWallMode()]}`;
});

$('#sound-toggle').addEventListener('click', () => {
  audioMuted = !audioMuted;
  audio.setMuted(audioMuted);
  if (!audioMuted) audio.wake();
  $('#sound-toggle').textContent = audioMuted ? '♪̸' : '♪';
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
  if (now - lastHeaderRender > 160) { updateHeader(); updateInteractCard(); lastHeaderRender = now; }
  if (now - lastPanelRender > 900) {
    if (currentTab === 'overview' || currentTab === 'staff' || currentTab === 'finance' || currentTab === 'orders' || currentTab === 'floor' || (currentTab === 'shelves' && !$('#stock-search')?.matches(':focus')) || currentTab === 'menu') renderPanel({ preserveScroll: true });
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
