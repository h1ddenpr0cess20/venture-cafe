# Venture Cafe

A neighborhood breakfast-cafe management game built on [Madness Engine](https://github.com/h1ddenpr0cess20/madness-engine). It began as a rework of the corner-store game Bodega and has since been rebuilt around the cafe: one walk-in pantry, a nine-dish menu that grows with the cafe's level, and a dining room of real wood furniture with real people in it.

## The cafe

- **A dining room in walnut.** Four two-top tables with turned legs, eight dining chairs, two booths with cushioned benches, four counter stools, a paneled service bar with a brass foot rail, and a backbar of three tall bookcases holding cups, jars and tins. Tables, chairs and stools are the engine's `props/wood-table` and `props/wood-chair`; the bar, benches and backbar use the same lacquered walnut (`props/wood-board`, `props/bookcase`).
- **Real people.** The crew, the owner you walk around as, and fifteen regulars are all built with the engine's `createHuman`: MakeHuman-based bodies in their own build, height, skin, hair, eyes and clothes. Guests sit down with the engine's `sit` clip onto the wood chairs. The crew and the first four regulars are built behind the loading screen; the rest are built while the cafe is open, and only the ones who are ready come in.
- **A kitchen on the line.** Bob cooks at a marble-topped prep counter with a cast-iron pan and a cutting board; the pass has an open shelf above it.

## How a morning works

1. A regular walks in off the sidewalk and sits at the quietest table.
2. The waiter takes the order and sends it to Bob's kitchen.
3. Bob cooks it from the walk-in, **oldest valid lot first**. A lot's expiry is fixed when it is delivered. Expired stock is never cooked.
4. The waiter serves it. The guest pays at the menu price and leaves a review.

**Food quality** comes from kitchen skill, ingredient freshness and how much of the recipe was in stock. **Service quality** comes from the host and waiter and a wait-time penalty. Reviews score the two separately, and reputation sets how often people walk in.

## The menu

Nine dishes: potato and egg scramble, soft scrambled eggs, sunny-side-up eggs, over-easy eggs, French omelette, diner omelette, buttered toast, house coffee and fresh orange juice.

- **Levels.** Serving guests earns experience. Level 1 opens the basics; level 2 adds the potato scramble and orange juice; level 3 adds both omelettes. The ingredients a dish needs (potatoes, orange juice, cheddar, tomatoes) open with it.
- **Prices.** Every dish has a price you can raise or lower, down to 20% over what it costs to make and up to 60% over its base price. Each regular has a `thrift`: past it they still pay, but they mark the cafe down and write a "pricey" review.
- **Likes.** Regulars order the dishes they like three times as often as the rest, and come in at their usual hours.

## Running the business

Nine ingredients (eggs, butter, milk, bread, coffee, potatoes, orange juice, cheddar, tomatoes), each with its own shelf life from three days to six months. Order cases from the supplier into the walk-in, pull expired stock (written off at cost), draw on a revolving credit line (1.25% a day, compounding into the balance) and watch rent, wages and utilities come out at close. Progress is saved to the browser; no time passes while the page is closed.

## Controls

WASD or the arrow keys walk the owner (hold Shift to hurry; on touch there is a directional pad). Middle-drag, or drag with a finger, orbits the camera; the wheel zooms. The WALLS button chooses whether near walls fade (Auto), stay solid or are always ghosted. 1×/2×/3× set the speed.

## Run

Requires Node.js 22.12 or newer.

```sh
npm install
npm run dev
npm test
npm run build
```

Madness Engine is pinned to a commit in `package.json` so the people, furniture and renderer APIs stay reproducible. Add `?renderer=webgl` to force the WebGL 2 renderer.

## Layout

```text
src/
  sim.js         the cafe's rules: ingredients, the pantry and its dated lots, level-gated menu, orders, prices, service flow, reviews, credit, save/load
  residents.js   the regulars: who they are, how they look, what they like, when they come in
  people.js      the crew and owner, and how any person is built with createHuman
  menu.js        the nine dishes, their recipes and the level that opens each
  layout.js      the floor plan: shell, kitchen, furniture, seats and the waypoint pathfinder (no rendering)
  cafe.js        the wood furniture, bar, backbar and kitchen
  world.js       the scene: shell, street, furniture, people, doors and fading walls
  main.js        the interface, owner controls, loading gate, day clock, save and resume
test/            business rules, layout and reachability, the cast and the furniture scale
```

## Asset provenance

- **Madness Engine:** renderer, `createHuman` people and the `sit`/`walk`/`idle`/`talk` clips, wood tables, chairs, boards and bookcases and the lacquered walnut texture, the cast-iron pan, street scenery and room textures.
- **Short Order:** `src/short-order/food/` and `src/short-order/geometry/` provide the cooked egg, curd, potato, filling and triangulation sources used by plated breakfast food.
