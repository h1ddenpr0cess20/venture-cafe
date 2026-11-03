# Venture Cafe

A neighborhood breakfast cafe management game built on Madness Engine. Venture Cafe grows out of the Bodega management-game foundation, with Short Order's breakfast cooking vocabulary and a distinct cafe floor plan.

## First playable foundation

- A neighborhood cafe with a long service bar, window stools, two- and four-top tables, and upholstered wall booths.
- Guests enter, take an available seat, order breakfast and drinks, dine, and leave. Seat reservations are part of the simulation rather than decorative props.
- The breakfast menu starts with the Short Order egg dishes, plus toast, coffee, and orange juice.
- The kitchen uses Madness Engine's cast-iron pan and egg mascot assets. Short Order's speckled egg and cooked-egg geometry are vendored under `src/short-order/` for food presentation and further cooking interactions.
- The same Bodega manager/player character is reused as the kitchen lead. No unverified sitting animation is assumed; seated guests are staged behind booth backs and table edges using the existing idle/look poses.
- The outside entry gets a freestanding Venture Cafe egg mascot statue on a small plinth.

## Run

Requires Node.js 22.12 or newer.

```sh
npm install
npm run dev
npm test
npm run build
```

The Madness Engine dependency is pinned to the same verified commit used by Bodega so character, prop, renderer, and animation APIs remain reproducible.

## Current development scope

This repository is the first Venture Cafe conversion pass: the Bodega business-management foundation is retained, the world is being refitted around dine-in seating and a breakfast service bar, and the food/mascot assets are explicitly sourced from Short Order and Madness Engine respectively. Deeper pan interaction, plating, recipe execution, table-service animations, and cafe-specific progression can be developed on this foundation.

## Asset provenance

- **Madness Engine:** renderer, character models, egg mascot, cast-iron frying pan, grocery ingredient props, street furniture, textures, and room/sky painters.
- **Short Order:** `src/short-order/food/` and `src/short-order/geometry/` are copied from the Short Order repository for reuse of its egg, curd, potato, and filling geometry.
- **Bodega:** the management simulation, resident cast, customer economy/reviews, UI shell, navigation, save/resume, and business-management systems are the starting point.
