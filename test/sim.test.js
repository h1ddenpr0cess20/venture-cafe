import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INGREDIENTS, INGREDIENT_BY_ID, createGameState, productNow, placeOrder, pullExpired, pantryQuantity, pantryHealth,
  borrowCredit, repayCredit, advanceGame, beginDay, startNextDay, adjustMenuPrice, saveGameState, loadGameState,
  maybeLeaveReview, customerArrivalInterval, trafficLabel, reviewSummary, openMenu, chooseDish, chooseResident,
  RESIDENTS, STAFF, ownerActionsFor, talkToGuest, guestMood, staffActionsFor, talkToStaff, crewStatus, staffQuality, getStoreLevel, getStoreLevelProgress, activeFrameDelta, expiredQuantity, qtyOf, isOpen,
} from '../src/sim.js';
import { CAFE_AREAS } from '../src/layout.js';
import { CAFE_MENU, CAFE_MENU_BY_ID } from '../src/menu.js';

function prepareState() {
  const state = createGameState(7);
  state.started = true;
  state.paused = false;
  return state;
}
/** Run the clock in the small steps a frame takes. */
function run(state, minutes, step = 0.1) {
  for (let t = 0; t < minutes; t += step) advanceGame(state, step);
}
/** A guest at the first table, already waiting for the waiter. */
function seatedGuest(state, extra = {}) {
  const customer = {
    id: 9001, residentId: 'ari', name: 'Ari', reviewName: 'A. Guest', menuChoiceId: 'scrambled-eggs', thrift: 0.5,
    seatId: 'table-a-west', arrivalDuration: 2.4, arrivalTimer: 0, serviceStatus: 'waiting',
    phase: 'browsing', phaseTotal: 12, phaseTimer: 12, result: null, bought: 0, spend: 0, ...extra,
  };
  state.customers.push(customer);
  return customer;
}

test('the shared frame delta respects pause state and selected game speed', () => {
  const state = createGameState();
  assert.equal(activeFrameDelta(state, 0.1), 0);
  state.started = true;
  state.paused = false;
  assert.equal(activeFrameDelta(state, 0.1), 0.1);
  state.speed = 0.5;
  assert.equal(activeFrameDelta(state, 0.1), 0.05);
  state.speed = 2;
  assert.equal(activeFrameDelta(state, 0.1), 0.2);
  state.paused = true;
  assert.equal(activeFrameDelta(state, 0.1), 0);
  state.paused = false;
  state.dayEnded = true;
  assert.equal(activeFrameDelta(state, 0.1), 0);
  state.dayEnded = false;
  state.gameOver = true;
  assert.equal(activeFrameDelta(state, 0.1), 0);
  assert.equal(activeFrameDelta(state, Number.NaN), 0);
});

test('the pantry holds only what a breakfast kitchen cooks with, with different expiry horizons', () => {
  assert.equal(INGREDIENTS.length, 9);
  const life = (id) => INGREDIENT_BY_ID[id].shelfLife;
  assert.ok(life('milk') < life('eggs') && life('bread') < life('eggs') && life('tomatoes') < life('potatoes'));
  assert.ok(life('coffee') > life('eggs'), 'coffee keeps longest');
  for (const ingredient of INGREDIENTS) assert.ok(ingredient.cost > 0 && ingredient.caseSize > 0 && ingredient.level >= 1);
  for (const item of CAFE_MENU) for (const id of Object.keys(item.ingredients)) assert.ok(INGREDIENT_BY_ID[id], `${item.id} → ${id}`);
});

test('ingredients and dishes open by cafe level, and a locked ingredient cannot be ordered', () => {
  const state = prepareState();
  assert.equal(getStoreLevel(state), 1);
  assert.ok(openMenu(state).every((item) => item.level === 1));
  assert.ok(!openMenu(state).some((item) => item.id === 'diner-omelette'));
  assert.equal(isOpen(state, 'cheese'), false);
  assert.deepEqual(placeOrder(state, 'cheese', 1), { ok: false, reason: 'not-stocked' });
  state.experience = 500;
  assert.equal(getStoreLevel(state), 3);
  assert.ok(openMenu(state).some((item) => item.id === 'diner-omelette') && openMenu(state).length === CAFE_MENU.length);
  assert.equal(isOpen(state, 'cheese'), true);
  assert.equal(placeOrder(state, 'cheese', 1).ok, true);
});

test('diners only order dishes that are on the menu, and lean toward what they like', () => {
  const state = prepareState();
  const ari = RESIDENTS.find((resident) => resident.id === 'ari');
  const picks = { 'coffee': 0, 'scrambled-eggs': 0 };
  let other = 0;
  for (let i = 0; i < 600; i++) {
    const item = chooseDish(state, ari);
    assert.ok(openMenu(state).includes(item), `${item.id} is open at level 1`);
    if (item.id in picks) picks[item.id] += 1; else other += 1;
  }
  assert.ok(picks.coffee + picks['scrambled-eggs'] > other / 2, 'a regular orders their usual more than their share');
});

test('supplier deliveries go into the walk-in with a fixed expiry', () => {
  const state = prepareState();
  const before = pantryQuantity(state, 'eggs');
  const cash = state.cash;
  const result = placeOrder(state, 'eggs', 2);
  assert.equal(result.ok, true);
  assert.equal(result.qty, INGREDIENT_BY_ID.eggs.caseSize * 2);
  assert.equal(pantryQuantity(state, 'eggs'), before + result.qty);
  assert.equal(Math.round((cash - state.cash) * 100) / 100, result.total);
  assert.ok(Math.abs(result.expiresAt - (productNow(state) + 28)) < 1e-9);
  assert.equal(placeOrder(state, 'eggs', 0).reason, 'invalid-quantity');
  assert.equal(placeOrder(state, 'nope', 1).reason, 'invalid-quantity');
  state.cash = 1;
  assert.equal(placeOrder(state, 'eggs', 5).reason, 'insufficient-funds');
});

test('the kitchen cooks from the oldest valid lot first, and never from an expired one', () => {
  const state = prepareState();
  state.nextArrival = 100000;
  state.pantry.eggs = [
    { lotId: 1, qty: 3, receivedAt: 0.5, expiresAt: 1.2, unitCost: 0.32 },    // expired already (it is day 1 + 7 h)
    { lotId: 2, qty: 3, receivedAt: 0.9, expiresAt: 9, unitCost: 0.32 },
    { lotId: 3, qty: 3, receivedAt: 1.0, expiresAt: 30, unitCost: 0.32 },
  ];
  state.pantry.butter = [{ lotId: 4, qty: 10, receivedAt: 1, expiresAt: 30, unitCost: 0.22 }];
  seatedGuest(state);
  run(state, 5);
  const left = Object.fromEntries(state.pantry.eggs.map((lot) => [lot.lotId, lot.qty]));
  assert.equal(left[1], 3, 'the expired lot is left alone');
  assert.equal(left[2], undefined, 'the older valid lot went first');
  assert.equal(left[3], 3, 'the newer lot is untouched');
});

test('pulling expired stock clears the walk-in and books waste at wholesale cost', () => {
  const state = prepareState();
  state.pantry.milk = [
    { lotId: 91, qty: 5, receivedAt: 0, expiresAt: 0.5, unitCost: 0.25 },
    { lotId: 92, qty: 7, receivedAt: 1, expiresAt: 99, unitCost: 0.25 },
  ];
  assert.equal(expiredQuantity(state, 'milk'), 5);
  assert.equal(pantryHealth(state).expired, 5);
  const result = pullExpired(state, 'milk');
  assert.equal(result.removed, 5);
  assert.equal(result.loss, 1.25);
  assert.equal(state.dayStats.waste, 1.25);
  assert.equal(qtyOf(state.pantry.milk), 7);
  assert.equal(pullExpired(state).removed, 0);
});

test('menu prices stay between what a dish costs to make and a sensible cap', () => {
  const state = prepareState();
  const coffee = CAFE_MENU_BY_ID.coffee;
  assert.equal(state.menuPrices.coffee, coffee.price);
  adjustMenuPrice(state, 'coffee', 0.5);
  assert.equal(state.menuPrices.coffee, coffee.price + 0.5);
  adjustMenuPrice(state, 'coffee', -100);
  assert.ok(state.menuPrices.coffee > 0.3 + 0.25, 'never below cost');
  adjustMenuPrice(state, 'coffee', 100);
  assert.ok(state.menuPrices.coffee <= coffee.price * 1.6 + 1e-9);
  assert.equal(adjustMenuPrice(state, 'nope', 1), false);
});

test('a guest who finds the dish too dear still pays, but marks the cafe down and writes a pricey review', () => {
  const state = prepareState();
  state.nextArrival = 100000;
  state.random = () => 0;
  state.menuPrices['scrambled-eggs'] = CAFE_MENU_BY_ID['scrambled-eggs'].price * 1.5;
  const guest = seatedGuest(state, { thrift: 0.2 });
  const reputation = state.reputation;
  run(state, 24);
  assert.equal(guest.result, 'pricey');
  assert.ok(state.dayStats.pricedOut === 1 && state.reputation < reputation + 0.1);
  assert.ok(state.events.some((event) => /pricey/.test(event.message)));
  assert.ok(state.cash > 1250 + 10, 'they still paid the higher price');
  const review = state.reviews[0];
  assert.equal(review.outcome, 'pricey');
  assert.ok(review.rating <= 3);
});

test('credit can be drawn and repaid, but never beyond the credit limit or cash balance', () => {
  const state = prepareState();
  assert.equal(borrowCredit(state, 0).reason, 'invalid-amount');
  assert.equal(borrowCredit(state, 5000).reason, 'credit-limit');
  assert.equal(borrowCredit(state, 400).ok, true);
  assert.equal(state.debt, 400);
  state.cash = 100;
  assert.equal(repayCredit(state, 250).amount, 100);
  assert.equal(state.debt, 300);
  assert.equal(repayCredit(state).reason, 'nothing-to-repay');
});

test('credit interest compounds into the balance and is not also taken from the till', () => {
  const state = prepareState();
  beginDay(state);
  borrowCredit(state, 200);
  const cash = state.cash;
  state.minute = 20 * 60 + 59;
  advanceGame(state, 2);
  assert.equal(state.debt, 202.5);
  const costs = state.dailyCosts;
  assert.equal(Math.round((cash - state.cash - 0) * 100) / 100 <= costs.rent + costs.payroll + costs.utilities, true);
});

test('day closure charges fixed operating costs; the next day resets the books', () => {
  const state = prepareState();
  beginDay(state);
  state.minute = 20 * 60 + 59;
  advanceGame(state, 2);
  assert.equal(state.dayEnded, true);
  assert.equal(state.paused, true);
  assert.equal(state.dailyCosts.payroll, STAFF.reduce((n, s) => n + s.wage, 0));
  const previousDay = state.day;
  assert.equal(startNextDay(state), true);
  assert.equal(state.day, previousDay + 1);
  assert.equal(state.minute, 7 * 60);
  assert.equal(state.dayStats.revenue, 0);
  assert.equal(state.paused, false);
});

test('a saved cafe resumes its exact ledger, pantry and menu prices after reload', () => {
  const state = prepareState();
  placeOrder(state, 'eggs', 2);
  borrowCredit(state, 125);
  adjustMenuPrice(state, 'coffee', 0.5);
  const copy = loadGameState(saveGameState(state));
  assert.ok(copy);
  assert.equal(copy.cash, state.cash);
  assert.equal(copy.debt, state.debt);
  assert.deepEqual(copy.pantry.eggs, state.pantry.eggs);
  assert.equal(copy.menuPrices.coffee, state.menuPrices.coffee);
  assert.equal(copy.paused, false);
  assert.equal(copy.random(), state.random());
  assert.equal(loadGameState('{broken'), null);
});

test('saves from the grocery days are not carried over', () => {
  assert.equal(loadGameState(JSON.stringify({ version: 1, day: 3, shelves: {}, stockroom: {} })), null);
});

test('a restored open cafe advances customers and the clock without pressing resume', () => {
  const state = prepareState();
  state.minute = 9 * 60;
  seatedGuest(state, { serviceStatus: 'served', orderedMenuId: 'coffee', phaseTotal: 30, phaseTimer: 30 });
  const restored = loadGameState(saveGameState(state));
  assert.ok(restored);
  const beforeMinute = restored.minute, beforeTimer = restored.customers[0].phaseTimer;
  advanceGame(restored, 0.5);
  assert.ok(restored.minute > beforeMinute);
  assert.ok(restored.customers[0].phaseTimer < beforeTimer);
});

test('diners still order when the kitchen is bare, and the missing ingredients cost them food quality', () => {
  const state = prepareState();
  for (const ingredient of INGREDIENTS) state.pantry[ingredient.id] = [];
  state.nextArrival = 100000;
  const guest = seatedGuest(state);
  run(state, 40);
  assert.ok(state.events.some((event) => event.type === 'warning' && /short on ingredients/.test(event.message)));
  assert.ok(guest.foodQuality < 70 || state.dayStats.foodQualityTotal / Math.max(1, state.dayStats.ordersServed) < 70);
  assert.equal(state.dayStats.stockouts, 1);
});

test('the waiter takes an order and waits for the kitchen before serving it', () => {
  const state = prepareState();
  state.nextArrival = 100000;
  const customer = seatedGuest(state);
  run(state, 1);
  assert.equal(customer.serviceStatus, 'serving');
  assert.ok(!customer.orderedMenuId, 'no food order exists before the waiter reaches the diner');
  run(state, 4);
  assert.equal(customer.serviceStatus, 'served');
  assert.equal(customer.orderedMenuId, 'scrambled-eggs');
  assert.ok(customer.foodQuality > 0 && customer.serviceQuality > 0);
  const messages = state.events.map((event) => event.message).reverse();
  const orderAt = messages.findIndex((message) => /took Ari's order/i.test(message));
  const servedAt = messages.findIndex((message) => /served Ari's Soft Scrambled Eggs/i.test(message));
  assert.ok(orderAt >= 0 && servedAt > orderAt, 'the order is taken and prepared before delivery');
});

test('new public reviews score the meal and the service separately', () => {
  const state = prepareState();
  state.random = () => 0;
  const strong = maybeLeaveReview(state, { id: 9902, name: 'Maya', orderedMenuId: 'sunny-side-up', foodQuality: 98, serviceQuality: 96 });
  assert.equal(strong.rating, 5);
  assert.equal(strong.outcome, 'excellent');
  const weak = maybeLeaveReview(state, { id: 9903, name: 'Rico', orderedMenuId: 'diner-omelette', foodQuality: 35, serviceQuality: 42 });
  assert.equal(weak.rating, 1);
  assert.equal(weak.outcome, 'poor');
  assert.equal(maybeLeaveReview(state, { id: 9904, name: 'Nobody' }), null, 'no review without a meal to judge');
});

test('neighborhood reputation changes customer arrival intervals and displayed footfall', () => {
  const busy = prepareState(), quiet = prepareState();
  busy.reputation = 95; quiet.reputation = 30;
  busy.random = quiet.random = () => 0.5;
  assert.ok(customerArrivalInterval(busy) < customerArrivalInterval(quiet));
  assert.equal(trafficLabel(busy), 'BUSY');
  assert.equal(trafficLabel(quiet), 'SLOW');
  assert.deepEqual(reviewSummary({ reviews: [{ rating: 5 }, { rating: 4 }] }), { rating: 4.5, count: 2 });
});

test('experience raises the cafe level and the level bar reports progress', () => {
  const state = prepareState();
  state.experience = 260;
  const progress = getStoreLevelProgress(state);
  assert.equal(progress.level, 2);
  assert.equal(progress.currentFloor, 250);
  assert.equal(progress.nextTarget, 500);
  assert.equal(progress.remaining, 240);
});

test('regulars: never two of them inside at once, and they come in when they usually do', () => {
  const state = prepareState();
  state.minute = 7 * 60 + 30;
  const dmitri = RESIDENTS.find((resident) => resident.id === 'dmitri');
  const seen = new Set();
  const counts = {};
  for (let i = 0; i < 800; i++) {
    state.random = Math.random;
    const resident = chooseResident(state);
    counts[resident.id] = (counts[resident.id] ?? 0) + 1;
    seen.add(resident.id);
  }
  assert.ok(seen.size >= RESIDENTS.length - 2, 'the whole neighborhood turns up');
  assert.ok(counts.dmitri > counts.camille, `Dmitri (peak ${dmitri.peak}) is in more at 7:30 than Camille`);
  state.customers = RESIDENTS.slice(1).map((resident, i) => ({ id: i, residentId: resident.id }));
  assert.equal(chooseResident(state).id, RESIDENTS[0].id, 'only the one who is not inside can come in');
});

test('guests inside at closing time are served and counted instead of vanishing', () => {
  const state = prepareState();
  beginDay(state);
  state.nextArrival = 100000;
  state.minute = 20 * 60 + 58;
  state.customers.push({ id: 6001, name: 'Kenji', menuChoiceId: 'scrambled-eggs', orderedMenuId: 'scrambled-eggs', thrift: 1, arrivedAt: state.minute, phase: 'browsing', phaseTotal: 20, phaseTimer: 15, result: null, bought: 0, spend: 0, foodQuality: 90, serviceQuality: 90 });
  advanceGame(state, 3);
  assert.equal(state.dayEnded, true);
  assert.equal(state.dayStats.unitsSold, 1);
  assert.ok(state.dayStats.revenue > 0);
  assert.equal(state.customers.length, 0);
});

test('nobody is let in after last call', () => {
  const state = prepareState();
  beginDay(state);
  state.minute = 20 * 60 + 40;
  state.nextArrival = state.minute + 0.01;
  advanceGame(state, 0.05);
  assert.equal(state.customers.length, 0);
});

test('every seat has a place setting in front of it: on its table, or on the bar in front of a stool', async () => {
  const { CAFE_SEATS, CAFE_TABLES, CAFE_PLACE_SETTINGS, COUNTER, TABLE_TOP } = await import('../src/layout.js');
  assert.equal(CAFE_PLACE_SETTINGS.length, CAFE_SEATS.length);
  const seen = new Set();
  for (const place of CAFE_PLACE_SETTINGS) {
    assert.ok(!seen.has(`${place.x},${place.z}`), `${place.seatId} has its own place`);
    seen.add(`${place.x},${place.z}`);
    const table = CAFE_TABLES.find((t) => t.id === place.tableId);
    if (table) {
      assert.ok(Math.abs(place.x - table.x) < table.w / 2 && Math.abs(place.z - table.z) < table.d / 2, `${place.seatId} is set on its table`);
      assert.ok(!(place.x === table.x && place.z === table.z), 'not in the middle of the table');
      assert.equal(place.y, TABLE_TOP);
    }
    if (place.tableId === 'bar') {
      assert.equal(place.y, COUNTER.top, 'bar meals go on the counter');
      assert.ok(Math.abs(place.z - COUNTER.z) < COUNTER.d / 2, 'on the counter, not in the air');
    }
  }
});

/** Run a whole day in frame-sized steps, calling `each` after every step. */
function runDay(state, each) {
  beginDay(state);
  for (let i = 0; i < 14 * 60 * 2 && !state.dayEnded; i += 1) { advanceGame(state, 0.5); each(state); }
}

test('guests come in as parties of one to four, and use the whole dining room, not the same two tables', () => {
  const state = prepareState();
  const seen = new Map();                       // customer id → { party, size, area }
  const areaUse = new Map();                    // area id → number of parties
  runDay(state, () => {
    for (const customer of state.customers) {
      if (seen.has(customer.id)) continue;
      const area = CAFE_AREAS.find((candidate) => candidate.seats.some((seat) => seat.id === customer.seatId));
      seen.set(customer.id, { party: customer.partyId, size: customer.partySize, area: area.id });
    }
  });
  const parties = new Map();
  for (const guest of seen.values()) parties.set(guest.party, guest);
  const sizes = [...parties.values()].map((party) => party.size);
  assert.ok(sizes.length >= 12, `a busy day has plenty of parties (${sizes.length})`);
  for (const size of [1, 2]) assert.ok(sizes.includes(size), `there are parties of ${size}`);
  assert.ok(sizes.some((size) => size >= 3), 'and bigger ones');
  assert.ok(sizes.every((size) => size >= 1 && size <= 4));
  for (const party of parties.values()) areaUse.set(party.area, (areaUse.get(party.area) ?? 0) + 1);
  assert.ok(areaUse.size >= 5, `parties spread over most of the seating areas (${[...areaUse.keys()].join(', ')})`);
  assert.ok(Math.max(...areaUse.values()) < parties.size * 0.4, 'no one table does most of the work');
  assert.ok(areaUse.has('bar'), 'someone sits at the bar');
});

test('a table or booth is never shared by strangers, no seat is double-booked, and a party sits together', () => {
  const state = prepareState();
  runDay(state, () => {
    const seats = state.customers.map((customer) => customer.seatId);
    assert.equal(new Set(seats).size, seats.length, 'one guest per seat');
    for (const area of CAFE_AREAS.filter((candidate) => candidate.kind !== 'bar')) {
      const guests = state.customers.filter((customer) => area.seats.some((seat) => seat.id === customer.seatId));
      assert.ok(new Set(guests.map((guest) => guest.partyId)).size <= 1, `${area.id} holds one party`);
    }
    for (const guest of state.customers) {
      const mates = state.customers.filter((other) => other.partyId === guest.partyId);
      if (guest.partySize <= 1 || guest.seatId.startsWith('bar')) continue;
      assert.ok(mates.every((mate) => CAFE_AREAS.find((a) => a.seats.some((s) => s.id === mate.seatId)) === CAFE_AREAS.find((a) => a.seats.some((s) => s.id === guest.seatId))), 'a party shares its table');
    }
    assert.ok(state.customers.length <= 14);
  });
});

test('a party is served in one visit: the waiter does not walk to the kitchen and back for every guest', () => {
  const solo = prepareState(), party = prepareState();
  solo.nextArrival = party.nextArrival = 100000;
  const mate = (state, id, index, seat) => seatedGuest(state, { id, partyId: 7, partySize: 4, partyIndex: index, seatId: seat, name: `G${id}`, orderedMenuId: undefined });
  mate(solo, 9101, 0, 'table-a-west');
  ['table-a-west', 'table-a-east', 'table-a-north', 'table-a-south'].forEach((seat, index) => mate(party, 9201 + index, index, seat));
  const finish = (state, guests) => { let t = 0; while (t < 60 && !guests.every((g) => g.serviceStatus === 'served')) { advanceGame(state, 0.1); t += 0.1; } return t; };
  const one = finish(solo, solo.customers), four = finish(party, party.customers);
  assert.ok(four < one * 3, `four guests (${four.toFixed(1)} min) take far less than four visits (${(one * 4).toFixed(1)} min)`);
  assert.ok(four < 12, 'and are all served within a reasonable wait');
});

test('the pantry health report counts what needs the owner\'s attention', () => {
  const state = prepareState();
  state.pantry.bread = [];
  state.pantry.coffee = [{ lotId: 77, qty: 3, receivedAt: 1, expiresAt: 99, unitCost: 0.3 }];
  const health = pantryHealth(state);
  assert.ok(health.empty >= 1 && health.low >= 1);
  assert.equal(INGREDIENTS.filter((i) => isOpen(state, i)).length > 0, true);
});

/** A guest who has been served, so the owner has the whole menu of things to do. */
function servedGuest(state, extra = {}) {
  return seatedGuest(state, { serviceStatus: 'served', orderedMenuId: 'scrambled-eggs', foodQuality: 90, serviceQuality: 90, servedAt: state.minute, ...extra });
}

test('the owner\'s options depend on where the guest is in their visit', () => {
  const state = prepareState();
  state.nextArrival = 100000;
  const waiting = seatedGuest(state, { id: 1, arrivedAt: state.minute });
  assert.deepEqual(ownerActionsFor(state, waiting).map((a) => a.id), ['greet'], 'a new arrival can be greeted');
  state.minute += 4;
  assert.deepEqual(ownerActionsFor(state, waiting).map((a) => a.id), ['greet', 'hurry'], 'a guest who has waited can be checked on');
  const eating = servedGuest(state, { id: 2 });
  assert.deepEqual(ownerActionsFor(state, eating).map((a) => a.id), ['checkin', 'refill', 'comp']);
  const leaving = servedGuest(state, { id: 3, phase: 'checkout' });
  assert.deepEqual(ownerActionsFor(state, leaving).map((a) => a.id), ['thank']);
  assert.deepEqual(ownerActionsFor(state, undefined), []);
  state.pantry.coffee = [];
  assert.ok(!ownerActionsFor(state, eating).some((a) => a.id === 'refill'), 'no refill without coffee');
});

test('each thing the owner says can be said once to a guest, and costs what it should', () => {
  const state = prepareState();
  state.nextArrival = 100000;
  const guest = servedGuest(state);
  const coffee = pantryQuantity(state, 'coffee');
  const first = talkToGuest(state, guest.id, 'refill');
  assert.equal(first.ok, true);
  assert.equal(pantryQuantity(state, 'coffee'), coffee - 1, 'a refill uses a portion of coffee');
  assert.ok(first.reply.length > 5);
  assert.equal(talkToGuest(state, guest.id, 'refill').reason, 'already');
  assert.equal(talkToGuest(state, guest.id, 'greet').reason, 'not-now', 'no hello once they have eaten');
  assert.equal(talkToGuest(state, 999, 'refill').reason, 'unknown');
  assert.equal(talkToGuest(state, guest.id, 'teleport').reason, 'unknown');
  assert.ok(guest.rapport >= 5);
  assert.ok(state.events.some((event) => event.type === 'owner'));
});

test('hearing out an unhappy guest builds more rapport than a polite word, and a wait check forgives some of the wait', () => {
  const state = prepareState();
  state.nextArrival = 100000;
  const happy = servedGuest(state, { id: 1 });
  const unhappy = servedGuest(state, { id: 2, foodQuality: 40, serviceQuality: 50, seatId: 'table-b-west' });
  talkToGuest(state, happy.id, 'checkin');
  talkToGuest(state, unhappy.id, 'checkin');
  assert.ok(unhappy.rapport > happy.rapport, 'listening to a complaint counts for more');
  assert.equal(guestMood(state, unhappy), 'Not happy with the meal');
  assert.equal(guestMood(state, happy), 'Enjoying breakfast');
  const late = seatedGuest(state, { id: 3, seatId: 'table-c-west', arrivedAt: state.minute - 6 });
  assert.equal(guestMood(state, late), 'Getting impatient');
  talkToGuest(state, late.id, 'hurry');
  assert.equal(late.waitCredit, 3);
});

test('taking a meal off the bill gives up the sale', () => {
  const state = prepareState();
  state.nextArrival = 100000;
  const guest = servedGuest(state, { foodCost: 1.5 });
  const cash = state.cash;
  assert.equal(talkToGuest(state, guest.id, 'comp').ok, true);
  assert.equal(guest.comped, true);
  run(state, 40);
  assert.equal(state.cash, cash, 'nothing was paid');
  assert.equal(guest.spend, 0);
  assert.equal(state.dayStats.revenue, 0);
});

test('a guest the owner looked after rates the visit higher and recovers from a bad meal', () => {
  const rate = (extra) => {
    const state = prepareState();
    state.random = () => 0;
    return maybeLeaveReview(state, { id: 1, name: 'Maya', orderedMenuId: 'coffee', foodQuality: 60, serviceQuality: 62, ...extra });
  };
  const ignored = rate({});
  const looked = rate({ rapport: 20 });
  assert.ok(looked.rating > ignored.rating, `rated ${looked.rating} vs ${ignored.rating}`);
  assert.equal(looked.outcome, 'recovered');
  assert.match(looked.text, /owner/i);
  assert.equal(looked.ownerVisited, true);
  assert.equal(ignored.ownerVisited, false);
  const warm = rate({ rapport: 10, foodQuality: 90, serviceQuality: 88 });
  assert.equal(warm.outcome, 'warm');
  assert.ok(warm.rating >= 4);
  // And they are likelier to write one at all.
  const writes = (rapport) => { let n = 0; for (let i = 0; i < 400; i++) { const s = prepareState(); s.random = () => i / 400; if (maybeLeaveReview(s, { id: i, name: 'A', orderedMenuId: 'coffee', foodQuality: 80, serviceQuality: 80, rapport })) n += 1; } return n; };
  assert.ok(writes(15) > writes(0) + 30, 'a warmed-up guest writes more often');
});

test('talking to the crew lifts morale, which moves the quality of their work', () => {
  const state = prepareState();
  state.nextArrival = 100000;
  const before = crewStatus(state).find((person) => person.id === 'bob');
  assert.equal(before.morale, 70);
  assert.equal(before.quality, before.baseQuality);
  assert.deepEqual(staffActionsFor(state, 'bob').map((a) => a.id), ['chat', 'praise', 'bonus']);
  const cash = state.cash;
  const bonus = talkToStaff(state, 'bob', 'bonus');
  assert.equal(bonus.ok, true);
  assert.equal(state.cash, cash - 20);
  assert.equal(state.dayStats.bonuses, 20);
  assert.equal(talkToStaff(state, 'bob', 'bonus').reason, 'not-now', 'one bonus a day');
  assert.ok(staffQuality(state, 'bob') > before.quality, 'a happier cook cooks better');
  assert.equal(crewStatus(state).find((person) => person.id === 'bob').mood, 'Energized');
  const worn = prepareState();
  worn.staffMorale.bob = 10;
  assert.ok(staffQuality(worn, 'bob') < before.quality - 15, 'a fed-up cook cooks worse');
  assert.equal(talkToStaff(state, 'nobody', 'chat').reason, 'unknown');
});

test('praise is hollow when the work has not been good, and chats have a cooldown', () => {
  const state = prepareState();
  state.dayStats.ordersServed = 5; state.dayStats.foodQualityTotal = 5 * 50; state.dayStats.serviceQualityTotal = 5 * 90;
  const hollow = talkToStaff(state, 'bob', 'praise');
  const earned = talkToStaff(state, 'waiter', 'praise');
  assert.ok(earned.gained > hollow.gained, `${earned.gained} vs ${hollow.gained}`);
  assert.ok(talkToStaff(state, 'lou', 'chat').ok);
  assert.equal(talkToStaff(state, 'lou', 'chat').reason, 'not-now', 'not twice in a row');
  state.minute += 100;
  assert.equal(talkToStaff(state, 'lou', 'chat').ok, true, 'but again after a while');
  state.cash = 5;
  assert.ok(!staffActionsFor(state, 'lou').some((a) => a.id === 'bonus'), 'no bonus without the cash');
});

test('left alone, a crew\'s morale settles lower over the day', () => {
  const state = prepareState();
  beginDay(state);
  state.nextArrival = 100000;
  const start = state.staffMorale.bob;
  run(state, 600, 1);
  assert.ok(state.staffMorale.bob < start - 3 && state.staffMorale.bob > 50, `settled at ${state.staffMorale.bob.toFixed(1)}`);
});

test('a busy day with nobody looking after the crew wears the cook down, and the owner is told once', () => {
  const state = prepareState();
  const events = [];
  runDay(state, () => {});
  assert.ok(state.dayStats.ordersServed >= 20, 'a real service');
  assert.ok(state.staffMorale.bob < 60, `the cook is tired (${state.staffMorale.bob.toFixed(1)})`);
  assert.ok(state.staffMorale.bob < state.staffMorale.lou, 'the cook works harder than the host');
  const worn = prepareState();
  worn.nextArrival = 100000;
  worn.staffMorale.bob = 40.2;
  seatedGuest(worn);
  run(worn, 10);
  assert.equal(worn.events.filter((event) => /Bob is worn down/.test(event.message)).length, 1);
  assert.equal(loadGameState(saveGameState(worn)).staffMorale.bob, worn.staffMorale.bob, 'morale survives a save');
  void events;
});

test('looking after the crew through a busy day keeps the cook cooking well', () => {
  const alone = prepareState(), looked = prepareState();
  runDay(alone, () => {});
  let last = -1e9;
  runDay(looked, (state) => {
    if (state.minute - last >= 100) {
      last = state.minute;
      for (const id of ['bob', 'waiter', 'lou']) { talkToStaff(state, id, 'chat'); talkToStaff(state, id, 'praise'); }
    }
  });
  assert.ok(looked.staffMorale.bob > alone.staffMorale.bob + 10, `${looked.staffMorale.bob.toFixed(0)} vs ${alone.staffMorale.bob.toFixed(0)}`);
  assert.ok(staffQuality(looked, 'bob') > staffQuality(alone, 'bob') + 4);
});
