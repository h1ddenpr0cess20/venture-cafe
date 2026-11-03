# Venture Cafe

A neighborhood breakfast-cafe management game built on Madness Engine.

## Cafe floor plan

- A long service bar with a tidy backbar and four counter stools.
- Four freestanding dining tables, two upholstered booths and correctly oriented engine-native dining chairs.
- Guests enter, take a seat, wait for the waiter to take their order, and only then is the order sent to Bob's kitchen. The waiter returns with the prepared meal.
- The owner starts in the staff aisle behind the service bar, facing the dining room.
- The breakfast prep kitchen sits behind the dining room, with a cast-iron pan, ingredient props and a clear pass.

## Breakfast menu

Nine breakfast items: potato and egg scramble, soft scrambled eggs, sunny-side-up eggs, over-easy eggs, French omelette, diner omelette, buttered toast, house coffee and fresh orange juice. Each item defines its recipe ingredients.

## Service and reviews

The diner journey is explicit: enter and sit, have the order taken, send it to the kitchen, prepare the meal, deliver it, then pay and leave a review.

Food quality is derived from kitchen staff quality, head-chef standards and recipe ingredient freshness/availability. Service quality is derived from the host and waiter quality, with a wait-time penalty. Public reviews and reputation changes use those two scores.

## Run

Requires Node.js 22.12 or newer.

```sh
npm install
npm run dev
npm test
npm run build
```

Madness Engine is pinned to `54d53ca6d9c660fc40e59aac6eaab78dd1c52569`, which includes the humanoid `sit` clip and native wooden chair prop.

## Asset provenance

- **Madness Engine:** renderer, staff and resident character rigs, sitting animation, chair prop, cast-iron pan, ingredient props and scene textures.
- **Short Order:** `src/short-order/food/` and `src/short-order/geometry/` provide the cooked egg, curd, potato, filling and triangulation sources used by plated breakfast food.
