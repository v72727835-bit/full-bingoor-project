/**
 * Picks the artwork for a product.
 *
 * The child category already has an icon, but leaning on it alone puts the
 * same broccoli on the onion, the potato and the tomato - which is the exact
 * "nobody looked at this" feeling we are trying to avoid. So each product gets
 * matched against the keyword table first and only falls back to its aisle.
 *
 * Longer keys are tried before shorter ones, so "green chilli" beats "chilli"
 * and "coconut oil" beats "oil".
 */
const KEYWORDS: Record<string, string> = {
  /* vegetables */
  onion: 'onion', potato: 'potato', tomato: 'tomato', cauliflower: 'broccoli',
  capsicum: 'bell-pepper', 'lady finger': 'cucumber', brinjal: 'eggplant',
  'bottle gourd': 'cucumber', cucumber: 'cucumber', broccoli: 'broccoli',
  zucchini: 'cucumber', spinach: 'leafy-green', lettuce: 'leafy-green',
  'mixed vegetables': 'green-salad', sprouts: 'green-salad', avocado: 'avocado',
  /* fruits */
  banana: 'banana', apple: 'red-apple', orange: 'tangerine', pomegranate: 'red-apple',
  papaya: 'mango', 'sweet lime': 'lemon', mango: 'mango', coconut: 'coconut',
  /* herbs and aromatics */
  coriander: 'herb', mint: 'herb', 'curry leaves': 'herb', 'green chilli': 'hot-pepper',
  ginger: 'garlic', garlic: 'garlic',
  /* staples */
  atta: 'flatbread', besan: 'flatbread', maida: 'flatbread', ragi: 'flatbread',
  basmati: 'cooked-rice', rice: 'cooked-rice', murmura: 'rice-ball', rava: 'rice-ball',
  dal: 'beans', chana: 'beans', rajma: 'beans', poha: 'ear-of-corn',
  daliya: 'ear-of-corn', bajra: 'ear-of-corn', sooji: 'ear-of-corn',
  /* oils and spices */
  ghee: 'butter', vanaspati: 'butter', oil: 'olive', chilli: 'hot-pepper',
  mirch: 'hot-pepper', turmeric: 'salt', masala: 'hot-pepper', jeera: 'salt',
  cumin: 'salt', pepper: 'salt', mustard: 'salt', cardamom: 'salt', 'bay leaf': 'herb',
  salt: 'salt', sugar: 'salt', jaggery: 'salt',
  /* dairy and bakery */
  milk: 'glass-of-milk', bread: 'bread', pav: 'bread', egg: 'egg',
  paneer: 'cheese-wedge', tofu: 'cheese-wedge', dahi: 'shaved-ice', yogurt: 'shaved-ice',
  lassi: 'cup-with-straw', buttermilk: 'cup-with-straw', butter: 'butter', cheese: 'cheese-wedge',
  /* biscuits and bakery */
  oreo: 'cookie', biscuit: 'cookie', cookie: 'cookie', 'dark fantasy': 'cookie',
  bourbon: 'cookie', marie: 'pretzel', monaco: 'pretzel', rusk: 'baguette-bread',
  khari: 'baguette-bread', cake: 'cupcake', muffin: 'cupcake', 'swiss roll': 'cupcake',
  /* dry fruits */
  almond: 'chestnut', cashew: 'chestnut', walnut: 'chestnut', raisin: 'chestnut',
  pistachio: 'peanuts', 'corn flakes': 'bento-box', chocos: 'bento-box',
  oats: 'steaming-bowl', muesli: 'steaming-bowl', seeds: 'peanuts',
  /* meat */
  chicken: 'poultry-leg', mutton: 'cut-of-meat', keema: 'cut-of-meat',
  fish: 'fish', prawns: 'shrimp', surmai: 'fish', nuggets: 'french-fries',
  kebab: 'cut-of-meat', sausage: 'cut-of-meat',
  /* snacks */
  chips: 'french-fries', crisps: 'french-fries', bhujia: 'peanuts', namkeen: 'peanuts',
  'moong dal': 'peanuts', doritos: 'taco', kurkure: 'french-fries', nachos: 'taco',
  popcorn: 'popcorn', puffcorn: 'popcorn',
  /* sweets */
  chocolate: 'chocolate-bar', 'dairy milk': 'chocolate-bar', kitkat: 'chocolate-bar',
  ferrero: 'chocolate-bar', 'soan papdi': 'moon-cake', 'kaju katli': 'moon-cake',
  'gulab jamun': 'moon-cake', candy: 'candy', mentos: 'candy', alpenliebe: 'candy',
  /* drinks */
  'coca-cola': 'cup-with-straw', 'thums up': 'cup-with-straw', sprite: 'cup-with-straw',
  pepsi: 'cup-with-straw', juice: 'beverage-box', nectar: 'beverage-box',
  'paper boat': 'beverage-box', 'red bull': 'bottle-with-popping-cork',
  gatorade: 'bottle-with-popping-cork', ors: 'potable-water', water: 'potable-water',
  soda: 'potable-water', tea: 'teacup-without-handle', coffee: 'hot-beverage',
  horlicks: 'baby-bottle', bournvita: 'baby-bottle', kool: 'cup-with-straw',
  /* instant */
  noodles: 'steaming-bowl', maggi: 'steaming-bowl', pasta: 'spaghetti', soup: 'steaming-bowl',
  'ready to eat': 'curry-rice', 'dal makhani': 'curry-rice', 'rajma masala': 'curry-rice',
  'french fries': 'french-fries', smiles: 'french-fries', parota: 'flatbread',
  /* spreads */
  ketchup: 'canned-food', sauce: 'canned-food', chutney: 'canned-food',
  jam: 'honey-pot', honey: 'honey-pot', nutella: 'chocolate-bar',
  'peanut butter': 'peanuts', mayonnaise: 'canned-food', mayo: 'canned-food',
  /* paan and dessert */
  pulse: 'candy', rajnigandha: 'fallen-leaf', mukhwas: 'fallen-leaf',
  gulkand: 'honey-pot', saunf: 'fallen-leaf',
  'ice cream': 'ice-cream', cornetto: 'soft-ice-cream', magnum: 'soft-ice-cream',
  kulfi: 'soft-ice-cream', vanilla: 'ice-cream', butterscotch: 'ice-cream',
  /* personal care */
  soap: 'soap', 'body wash': 'soap', lotion: 'lotion-bottle', deodorant: 'sponge',
  talc: 'sponge', fogg: 'sponge', shampoo: 'lotion-bottle', conditioner: 'lotion-bottle',
  'hair mask': 'lotion-bottle', 'hair oil': 'olive', 'hair colour': 'nail-polish',
  'face wash': 'droplet', cleanser: 'droplet', serum: 'lotion-bottle',
  moisturiser: 'lotion-bottle', sunscreen: 'sunglasses', 'lip balm': 'lipstick',
  lipstick: 'lipstick', 'matte ink': 'lipstick', 'lip crayon': 'lipstick',
  compact: 'nail-polish', primer: 'nail-polish', kajal: 'ring', liner: 'ring',
  'nail lacquer': 'nail-polish',
  /* hygiene, baby, health */
  whisper: 'cherry-blossom', stayfree: 'cherry-blossom', sofy: 'cherry-blossom',
  everteen: 'droplet', 'menstrual cup': 'droplet', 'seat sanitizer': 'toilet',
  pampers: 'baby-symbol', huggies: 'baby-symbol', wipes: 'roll-of-paper',
  cerelac: 'baby-bottle', 'nan pro': 'baby-bottle', dosa: 'flatbread',
  'baby shampoo': 'baby', 'baby lotion': 'baby', 'cleansing bar': 'baby',
  omega: 'pill', ashwagandha: 'pill', multivitamin: 'pill',
  whey: 'flexed-biceps', creatine: 'flexed-biceps', protein: 'flexed-biceps',
  'band-aid': 'adhesive-bandage', volini: 'adhesive-bandage', dettol: 'droplet',
  toothpaste: 'toothbrush', sensodyne: 'toothbrush', toothbrush: 'toothbrush',
  mouthwash: 'droplet',
  /* household */
  detergent: 'bucket', 'surf excel': 'bucket', ariel: 'bucket', rin: 'bucket',
  comfort: 'bucket', dishwash: 'sponge', 'scrub pad': 'sponge',
  lizol: 'bucket', harpic: 'toilet', colin: 'sponge',
  'good knight': 'butterfly', 'all out': 'butterfly', odonil: 'candle',
  'kitchen towel': 'roll-of-paper', 'toilet paper': 'roll-of-paper', 'garbage bags': 'broom',
  bedsheet: 'bed', pillow: 'bed', towel: 'bed',
  'money plant': 'potted-plant', candle: 'candle', 'photo frame': 'bed',
  agarbatti: 'candle', diya: 'candle', wicks: 'candle',
  earbuds: 'headphone', earphones: 'headphone', speaker: 'headphone',
  'power bank': 'battery', charger: 'electric-plug', cable: 'electric-plug',
  'smart watch': 'watch', 'led bulb': 'light-bulb', bulb: 'light-bulb', batten: 'light-bulb',
  notebook: 'notebook', paper: 'notebook', 'sticky notes': 'notebook',
  'ball pen': 'pencil', pencil: 'pencil', crayons: 'pencil',
  uno: 'game-die', chess: 'game-die', ludo: 'game-die',
  pedigree: 'dog', drools: 'dog', dentastix: 'dog',
  whiskas: 'cat', sheba: 'cat', 'cat litter': 'cat',
  'pet shampoo': 'paw-prints', 'grooming brush': 'paw-prints',
  /* kitchenware */
  tawa: 'shallow-pan-of-food', cooker: 'shallow-pan-of-food', kadai: 'shallow-pan-of-food',
  casserole: 'takeout-box', container: 'takeout-box', 'storage set': 'takeout-box',
  mixer: 'electric-plug', kettle: 'electric-plug', toaster: 'electric-plug',
  chopper: 'kitchen-knife', knife: 'kitchen-knife', spatula: 'fork-and-knife-with-plate',
};

const ORDERED = Object.keys(KEYWORDS).sort((a, b) => b.length - a.length);

export function artFor(name: string, brand: string, fallback: string): string {
  const hay = `${name} ${brand}`.toLowerCase();
  for (const key of ORDERED) if (hay.includes(key)) return KEYWORDS[key];
  return fallback;
}

/** Every icon the table can return - used to check the app ships them all. */
export const ART_KEYS = [...new Set(Object.values(KEYWORDS))];
