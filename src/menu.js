/** `level` is the cafe level that puts a dish on the menu; the ingredients it needs open at the same time. */
export const CAFE_MENU = Object.freeze([
  { id: 'potato-egg-scramble', level: 2, name: 'Potato & Egg Scramble', category: 'Skillet', price: 12.5, description: 'Golden russet dice folded through soft scrambled eggs, butter and black pepper.', prep: 'Dice · fry · scramble', ingredients: { eggs: 2, potatoes: 1, butter: 1 } },
  { id: 'scrambled-eggs', level: 1, name: 'Soft Scrambled Eggs', category: 'Eggs', price: 10.5, description: 'Three eggs, beaten smooth and stirred slowly in butter into tender curds.', prep: 'Whisk · butter · fold', ingredients: { eggs: 3, butter: 1, milk: 1 } },
  { id: 'sunny-side-up', level: 1, name: 'Sunny Side Up', category: 'Eggs', price: 9.5, description: 'Two eggs cooked gently until the whites set and the yolks stay bright.', prep: 'Crack · cover · set', ingredients: { eggs: 2, butter: 1 } },
  { id: 'over-easy', level: 1, name: 'Over Easy', category: 'Eggs', price: 9.75, description: 'Two eggs, turned once for a delicate white and a runny yolk.', prep: 'Crack · set · turn', ingredients: { eggs: 2, butter: 1 } },
  { id: 'french-omelette', level: 3, name: 'French Omelette', category: 'Omelette', price: 11.5, description: 'A pale, soft omelette rolled around a creamy center.', prep: 'Whisk · stir · roll', ingredients: { eggs: 3, butter: 1, milk: 1 } },
  { id: 'diner-omelette', level: 3, name: 'Diner Omelette', category: 'Omelette', price: 13.5, description: 'A golden folded omelette with cheddar, tomato, pepper or ham.', prep: 'Set · fill · fold', ingredients: { eggs: 3, cheese: 1, tomatoes: 1, butter: 1 } },
  { id: 'buttered-toast', level: 1, name: 'Buttered Toast', category: 'Bakery', price: 3.75, description: 'Thick-cut bread, toasted golden and finished with salted butter.', prep: 'Toast · butter', ingredients: { bread: 1, butter: 1 } },
  { id: 'coffee', level: 1, name: 'House Coffee', category: 'Drinks', price: 3.25, description: 'Fresh-brewed, strong and served hot. Free refills for regulars.', prep: 'Brew · pour', ingredients: { coffee: 1, milk: 1 } },
  { id: 'orange-juice', level: 2, name: 'Fresh Orange Juice', category: 'Drinks', price: 4.5, description: 'Cold orange juice, poured to order over ice.', prep: 'Chill · pour', ingredients: { orangejuice: 1 } },
]);
export const CAFE_MENU_BY_ID = Object.fromEntries(CAFE_MENU.map(item => [item.id, item]));
