# Venture Cafe

A neighborhood breakfast cafe management game built on Madness Engine. This repository reworks the Cafe management-game foundation around a real dine-in cafe: a service bar, tables, upholstered booths, a back-of-house breakfast kitchen, and a neighborhood breakfast menu.

## Cafe floor plan

- Long service bar and backbar, with four customer stools.
- Four freestanding tables and two wall-side upholstered booths.
- Guests walk in from the sidewalk and are assigned a table, booth or bar stool. The Madness Engine Waiter character carries breakfast on his built-in tray to each table or booth before the dining timer begins. Bar guests are served directly at the counter. Lou handles the counter; Bob (the engine barista character) works the coffee and kitchen station. The optional Emo character is not in the starting crew.
- The cast has no verified sitting clip in this build. Guests use the existing idle/look poses, lowered into the chair/booth line so furniture occludes their legs; no guessed animation is called.
- The former receiving room is a breakfast kitchen with a prep counter, Bob (using the Madness Engine male barista rig), ingredient props and the Madness Engine cast-iron pan. Lou hosts the counter; the engine's Waiter model handles table and booth service with its built-in tray.
- The entrance is framed by two static hero statues: the intact **Debater Egg** on one side of the door and **Tater** on the other.

## Breakfast menu

Six Short Order egg dishes: Potato & Egg Scramble, Soft Scrambled Eggs, Sunny Side Up, Over Easy, French Omelette and Diner Omelette. Also buttered toast, house coffee and orange juice.

Short Order egg, curd, potato and filling geometry sources are vendored under `src/short-order/`; plated egg displays use its cooked-egg solids. The engine pan and hero rigs are imported from the pinned Madness Engine dependency.

## Run

Requires Node.js 22.12 or newer.

```sh
npm install
npm run dev
npm test
npm run build
```

The Madness Engine dependency is pinned to the verified commit used by Bodega. Fonts follow Short Order's visual system: Playfair Display, Oswald and Caveat; the palette is bottle green, cream, walnut and warm brass.

## Asset provenance

- **Madness Engine:** renderer, cast, Debater Egg and Tater hero rigs, cast-iron frying pan, grocery ingredient props and scene textures.
- **Short Order:** `src/short-order/food/` and `src/short-order/geometry/` contain the egg, curd, potato, filling and triangulation sources used by plated breakfast food.
- **Bodega:** management simulation, neighborhood residents, finance, reviews, customer economy, staff and save/resume are the foundation.

## Development status

This is the first cafe conversion pass. The physical seating layout, mascot statues, breakfast kitchen props, pan and plated egg models are in place. The inherited retail inventory/economy panels remain the management foundation while recipe execution, order tickets and cafe-specific progression are developed.
