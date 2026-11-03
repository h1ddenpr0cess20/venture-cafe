export const CAFE_MENU=Object.freeze([
{id:'potato-egg-scramble',name:'Potato & Egg Scramble',category:'Skillet',price:12.5,description:'Golden russet dice folded through soft scrambled eggs, butter and black pepper.',prep:'Dice · fry · scramble'},
{id:'scrambled-eggs',name:'Soft Scrambled Eggs',category:'Eggs',price:10.5,description:'Three eggs, beaten smooth and stirred slowly in butter into tender curds.',prep:'Whisk · butter · fold'},
{id:'sunny-side-up',name:'Sunny Side Up',category:'Eggs',price:9.5,description:'Two eggs cooked gently until the whites set and the yolks stay bright.',prep:'Crack · cover · set'},
{id:'over-easy',name:'Over Easy',category:'Eggs',price:9.75,description:'Two eggs, turned once for a delicate white and a runny yolk.',prep:'Crack · set · turn'},
{id:'french-omelette',name:'French Omelette',category:'Omelette',price:11.5,description:'A pale, soft omelette rolled around a creamy centre.',prep:'Whisk · stir · roll'},
{id:'diner-omelette',name:'Diner Omelette',category:'Omelette',price:13.5,description:'A golden folded omelette with cheddar, tomato, pepper or ham.',prep:'Set · fill · fold'},
{id:'buttered-toast',name:'Buttered Toast',category:'Bakery',price:3.75,description:'Thick-cut bread, toasted golden and finished with salted butter.',prep:'Toast · butter'},
{id:'coffee',name:'House Coffee',category:'Drinks',price:3.25,description:'Fresh-brewed, strong and served hot. Free refills for regulars.',prep:'Brew · pour'},
{id:'orange-juice',name:'Fresh Orange Juice',category:'Drinks',price:4.5,description:'Cold orange juice, poured to order over ice.',prep:'Chill · pour'}
]);
export const CAFE_MENU_BY_ID=Object.fromEntries(CAFE_MENU.map(item=>[item.id,item]));
