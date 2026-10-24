/**
 * The whole shop catalogue in one place.
 *
 * Three levels, the way a customer thinks about them:
 *   group      "Grocery & Kitchen"      - a heading on the Categories page
 *     category "Vegetables & Fruits"    - a tile the customer taps
 *       child  "Fresh Vegetables"       - the rail on the left of the listing page
 *
 * `icon` is a Fluent Emoji Flat name; the app ships a PNG for each one, so the
 * tiles are real artwork instead of stock photos that never match the product.
 */

/** name, brand, price, mrp, unit, food type, attribute chips */
export type SeedProduct = [string, string, number, number, string, 'veg' | 'nonveg' | '', string[]?];

export interface SeedChild {
  name: string;
  icon: string;
  products: SeedProduct[];
}
export interface SeedCategory {
  name: string;
  icon: string;
  tint: string;
  children: SeedChild[];
}
export interface SeedGroup {
  name: string;
  icon: string;
  categories: SeedCategory[];
}

export const CATALOG: SeedGroup[] = [
  {
    name: 'Grocery & Kitchen',
    icon: 'shopping-cart',
    categories: [
      {
        name: 'Vegetables & Fruits',
        icon: 'carrot',
        tint: '#E8F6EC',
        children: [
          {
            name: 'Fresh Vegetables',
            icon: 'broccoli',
            products: [
              ['Onion', 'Local Farm', 32, 42, '1 kg', 'veg', ['Loose']],
              ['Potato', 'Local Farm', 28, 36, '1 kg', 'veg', ['Loose']],
              ['Tomato Hybrid', 'Local Farm', 38, 48, '500 g', 'veg', ['Hybrid']],
              ['Cauliflower', 'Local Farm', 34, 45, '1 pc', 'veg', ['Medium']],
              ['Green Capsicum', 'Local Farm', 26, 34, '250 g', 'veg'],
              ['Lady Finger (Bhindi)', 'Local Farm', 30, 40, '500 g', 'veg', ['Tender']],
              ['Brinjal Long', 'Local Farm', 24, 32, '500 g', 'veg'],
              ['Bottle Gourd (Lauki)', 'Local Farm', 27, 35, '1 pc', 'veg'],
            ],
          },
          {
            name: 'Fresh Fruits',
            icon: 'red-apple',
            products: [
              ['Banana Robusta', 'Local Farm', 48, 60, '6 pcs', 'veg', ['Ripe']],
              ['Shimla Apple', 'Local Farm', 165, 210, '1 kg', 'veg', ['Grade A']],
              ['Nagpur Orange', 'Local Farm', 89, 120, '1 kg', 'veg', ['Juicy']],
              ['Pomegranate', 'Local Farm', 142, 180, '500 g', 'veg'],
              ['Papaya Semi Ripe', 'Local Farm', 56, 75, '1 pc', 'veg'],
              ['Sweet Lime (Mosambi)', 'Local Farm', 78, 99, '1 kg', 'veg'],
            ],
          },
          {
            name: 'Herbs & Seasonings',
            icon: 'herb',
            products: [
              ['Coriander Leaves', 'Local Farm', 12, 18, '100 g', 'veg', ['Fresh']],
              ['Mint Leaves (Pudina)', 'Local Farm', 14, 20, '100 g', 'veg'],
              ['Curry Leaves', 'Local Farm', 10, 15, '50 g', 'veg'],
              ['Green Chilli', 'Local Farm', 18, 25, '100 g', 'veg', ['Spicy']],
              ['Ginger', 'Local Farm', 36, 48, '250 g', 'veg'],
              ['Garlic Peeled', 'Local Farm', 62, 80, '200 g', 'veg', ['Peeled']],
            ],
          },
          {
            name: 'Exotics & Organics',
            icon: 'avocado',
            products: [
              ['Hass Avocado', 'Imported', 189, 249, '1 pc', 'veg', ['Imported']],
              ['Broccoli', 'Local Farm', 72, 95, '250 g', 'veg', ['Exotic']],
              ['Zucchini Green', 'Local Farm', 68, 89, '250 g', 'veg', ['Exotic']],
              ['Organic Spinach', 'Organic Farm', 44, 58, '250 g', 'veg', ['Organic']],
              ['Iceberg Lettuce', 'Local Farm', 79, 99, '1 pc', 'veg', ['Exotic']],
            ],
          },
          {
            name: 'Cuts & Sprouts',
            icon: 'green-salad',
            products: [
              ['Cut Mixed Vegetables', 'Bingoor Fresh', 68, 85, '500 g', 'veg', ['Ready to Cook']],
              ['Moong Sprouts', 'Bingoor Fresh', 38, 49, '200 g', 'veg', ['Protein Rich']],
              ['Grated Coconut', 'Bingoor Fresh', 45, 60, '200 g', 'veg'],
            ],
          },
        ],
      },
      {
        name: 'Atta, Rice & Dal',
        icon: 'cooked-rice',
        tint: '#FFF3E0',
        children: [
          {
            name: 'Atta & Flours',
            icon: 'flatbread',
            products: [
              ['Aashirvaad Shudh Chakki Atta', 'Aashirvaad', 285, 335, '5 kg', 'veg', ['Whole Wheat']],
              ['Fortune Chakki Fresh Atta', 'Fortune', 262, 310, '5 kg', 'veg', ['Whole Wheat']],
              ['Pillsbury Multigrain Atta', 'Pillsbury', 318, 375, '5 kg', 'veg', ['Multigrain']],
              ['Rajdhani Besan', 'Rajdhani', 82, 99, '500 g', 'veg', ['Gram Flour']],
              ['24 Mantra Organic Maida', '24 Mantra', 74, 92, '500 g', 'veg', ['Organic']],
              ['Aashirvaad Ragi Flour', 'Aashirvaad', 96, 115, '500 g', 'veg', ['Millet']],
            ],
          },
          {
            name: 'Rice & Rice Products',
            icon: 'rice-ball',
            products: [
              ['India Gate Basmati Classic', 'India Gate', 398, 465, '1 kg', 'veg', ['Long Grain']],
              ['Daawat Rozana Super Basmati', 'Daawat', 132, 168, '1 kg', 'veg', ['Long Grain']],
              ['Fortune Sona Masoori Rice', 'Fortune', 356, 420, '5 kg', 'veg', ['Short Grain']],
              ['Rajdhani Puffed Rice (Murmura)', 'Rajdhani', 38, 47, '200 g', 'veg'],
              ['MTR Rice Idli Rava', 'MTR', 68, 82, '500 g', 'veg'],
            ],
          },
          {
            name: 'Dals & Pulses',
            icon: 'beans',
            products: [
              ['Tata Sampann Toor Dal', 'Tata Sampann', 178, 215, '1 kg', 'veg', ['Unpolished']],
              ['Tata Sampann Moong Dal', 'Tata Sampann', 162, 195, '1 kg', 'veg', ['Unpolished']],
              ['Rajdhani Chana Dal', 'Rajdhani', 94, 118, '1 kg', 'veg'],
              ['Rajdhani Urad Dal Whole', 'Rajdhani', 148, 180, '1 kg', 'veg'],
              ['Tata Sampann Kabuli Chana', 'Tata Sampann', 132, 160, '1 kg', 'veg'],
              ['Rajma Chitra', 'Rajdhani', 156, 189, '1 kg', 'veg'],
            ],
          },
          {
            name: 'Poha, Daliya & Grains',
            icon: 'ear-of-corn',
            products: [
              ['Rajdhani Thick Poha', 'Rajdhani', 52, 65, '500 g', 'veg'],
              ['Rajdhani Broken Wheat Daliya', 'Rajdhani', 58, 72, '500 g', 'veg', ['High Fibre']],
              ['24 Mantra Organic Bajra', '24 Mantra', 88, 108, '500 g', 'veg', ['Organic']],
              ['Sooji / Rava', 'Rajdhani', 44, 55, '500 g', 'veg'],
            ],
          },
        ],
      },
      {
        name: 'Oil, Ghee & Masala',
        icon: 'olive',
        tint: '#FFF8E1',
        children: [
          {
            name: 'Edible Oils',
            icon: 'olive',
            products: [
              ['Fortune Sunlite Refined Sunflower Oil', 'Fortune', 168, 199, '1 L', 'veg', ['Refined']],
              ['Saffola Gold Refined Oil', 'Saffola', 198, 235, '1 L', 'veg', ['Heart Care']],
              ['Dhara Kachi Ghani Mustard Oil', 'Dhara', 182, 215, '1 L', 'veg', ['Cold Pressed']],
              ['Figaro Olive Oil', 'Figaro', 549, 699, '500 ml', 'veg', ['Olive']],
              ['Parachute Coconut Oil', 'Parachute', 186, 220, '500 ml', 'veg'],
            ],
          },
          {
            name: 'Ghee & Vanaspati',
            icon: 'butter',
            products: [
              ['Amul Pure Ghee', 'Amul', 638, 720, '1 L', 'veg', ['Cow Ghee']],
              ['Patanjali Cow Ghee', 'Patanjali', 592, 675, '1 L', 'veg', ['Cow Ghee']],
              ['Mother Dairy Cow Ghee', 'Mother Dairy', 352, 410, '500 ml', 'veg'],
              ['Dalda Vanaspati', 'Dalda', 168, 199, '1 L', 'veg'],
            ],
          },
          {
            name: 'Powdered Spices',
            icon: 'hot-pepper',
            products: [
              ['Everest Tikhalal Chilli Powder', 'Everest', 82, 98, '200 g', 'veg', ['Spicy']],
              ['MDH Deggi Mirch', 'MDH', 96, 115, '100 g', 'veg', ['Mild']],
              ['Everest Turmeric Powder', 'Everest', 62, 75, '200 g', 'veg'],
              ['Catch Coriander Powder', 'Catch', 58, 70, '200 g', 'veg'],
              ['MDH Garam Masala', 'MDH', 88, 105, '100 g', 'veg', ['Blend']],
              ['Everest Chhole Masala', 'Everest', 72, 86, '100 g', 'veg', ['Blend']],
            ],
          },
          {
            name: 'Whole Spices',
            icon: 'garlic',
            products: [
              ['Tata Sampann Cumin Seeds (Jeera)', 'Tata Sampann', 118, 142, '200 g', 'veg'],
              ['Catch Black Pepper Whole', 'Catch', 168, 199, '100 g', 'veg'],
              ['Tata Sampann Mustard Seeds', 'Tata Sampann', 44, 55, '200 g', 'veg'],
              ['Green Cardamom (Elaichi)', 'Catch', 289, 349, '50 g', 'veg', ['Premium']],
              ['Bay Leaf (Tej Patta)', 'Catch', 38, 48, '50 g', 'veg'],
            ],
          },
          {
            name: 'Salt, Sugar & Jaggery',
            icon: 'salt',
            products: [
              ['Tata Salt Iodised', 'Tata', 28, 32, '1 kg', 'veg', ['Iodised']],
              ['Tata Rock Salt (Sendha)', 'Tata', 54, 68, '500 g', 'veg'],
              ['Madhur Refined Sugar', 'Madhur', 56, 66, '1 kg', 'veg'],
              ['Organic Jaggery Block', '24 Mantra', 88, 108, '500 g', 'veg', ['Organic']],
            ],
          },
        ],
      },
      {
        name: 'Dairy, Bread & Eggs',
        icon: 'glass-of-milk',
        tint: '#E3F2FD',
        children: [
          {
            name: 'Milk',
            icon: 'glass-of-milk',
            products: [
              ['Amul Taaza Toned Milk', 'Amul', 28, 30, '500 ml', 'veg', ['Toned']],
              ['Amul Gold Full Cream Milk', 'Amul', 36, 38, '500 ml', 'veg', ['Full Cream']],
              ['Mother Dairy Cow Milk', 'Mother Dairy', 32, 34, '500 ml', 'veg'],
              ['Nandini Double Toned Milk', 'Nandini', 26, 28, '500 ml', 'veg', ['Low Fat']],
            ],
          },
          {
            name: 'Bread & Buns',
            icon: 'bread',
            products: [
              ['Britannia Brown Bread', 'Britannia', 48, 55, '400 g', 'veg', ['Brown']],
              ['Harvest Gold White Bread', 'Harvest Gold', 42, 48, '400 g', 'veg'],
              ['Britannia Pav Buns', 'Britannia', 36, 42, '6 pcs', 'veg'],
              ['English Oven Multigrain Bread', 'English Oven', 62, 72, '400 g', 'veg', ['Multigrain']],
            ],
          },
          {
            name: 'Eggs',
            icon: 'egg',
            products: [
              ['Farm Fresh White Eggs', 'Bingoor Fresh', 78, 95, '6 pcs', 'nonveg'],
              ['Brown Eggs Cage Free', 'Bingoor Fresh', 112, 139, '6 pcs', 'nonveg', ['Cage Free']],
              ['Country Eggs (Desi)', 'Bingoor Fresh', 96, 120, '6 pcs', 'nonveg', ['Desi']],
            ],
          },
          {
            name: 'Paneer & Tofu',
            icon: 'cheese-wedge',
            products: [
              ['Amul Fresh Paneer', 'Amul', 96, 112, '200 g', 'veg'],
              ['Mother Dairy Malai Paneer', 'Mother Dairy', 102, 120, '200 g', 'veg'],
              ['Soft Tofu Block', 'Bingoor Fresh', 88, 110, '200 g', 'veg', ['Soya']],
            ],
          },
          {
            name: 'Curd & Yogurt',
            icon: 'shaved-ice',
            products: [
              ['Amul Masti Dahi', 'Amul', 34, 40, '400 g', 'veg'],
              ['Epigamia Greek Yogurt Mango', 'Epigamia', 62, 75, '90 g', 'veg', ['High Protein']],
              ['Mother Dairy Lassi', 'Mother Dairy', 25, 30, '200 ml', 'veg'],
              ['Amul Buttermilk (Chaas)', 'Amul', 15, 18, '200 ml', 'veg'],
            ],
          },
          {
            name: 'Butter & Cheese',
            icon: 'butter',
            products: [
              ['Amul Butter Salted', 'Amul', 62, 68, '100 g', 'veg', ['Salted']],
              ['Amul Cheese Slices', 'Amul', 132, 155, '10 slices', 'veg'],
              ['Britannia Cheese Cubes', 'Britannia', 118, 140, '200 g', 'veg'],
              ['Amul Cheese Spread', 'Amul', 98, 115, '200 g', 'veg'],
            ],
          },
        ],
      },
      {
        name: 'Bakery & Biscuits',
        icon: 'cookie',
        tint: '#FDECEF',
        children: [
          {
            name: 'Cookies & Cream Biscuits',
            icon: 'cookie',
            products: [
              ['Sunfeast Dark Fantasy Choco Fills', 'Sunfeast', 95, 110, '300 g', 'veg', ['Choco']],
              ['Oreo Original Cream Biscuits', 'Oreo', 40, 45, '120 g', 'veg', ['Vanilla']],
              ['Britannia Good Day Cashew', 'Britannia', 45, 50, '200 g', 'veg', ['Cashew']],
              ['Bourbon Chocolate Cream', 'Britannia', 38, 45, '150 g', 'veg', ['Choco']],
            ],
          },
          {
            name: 'Glucose & Marie',
            icon: 'pretzel',
            products: [
              ['Parle-G Original Glucose Biscuits', 'Parle', 10, 10, '80 g', 'veg'],
              ['Britannia Marie Gold', 'Britannia', 35, 40, '250 g', 'veg', ['Light']],
              ['Sunfeast Marie Light Oats', 'Sunfeast', 42, 48, '250 g', 'veg', ['Oats']],
              ['Parle Monaco Salted', 'Parle', 30, 35, '200 g', 'veg', ['Salted']],
            ],
          },
          {
            name: 'Rusks & Khari',
            icon: 'baguette-bread',
            products: [
              ['Britannia Premium Bake Rusk', 'Britannia', 62, 72, '300 g', 'veg'],
              ['Parle Elaichi Rusk', 'Parle', 55, 65, '300 g', 'veg', ['Elaichi']],
              ['Butter Khari Puff', 'Bingoor Bakes', 48, 60, '200 g', 'veg'],
            ],
          },
          {
            name: 'Cakes & Rolls',
            icon: 'cupcake',
            products: [
              ['Britannia Fruit Cake', 'Britannia', 58, 68, '250 g', 'veg'],
              ['Swiss Roll Chocolate', 'Winkies', 45, 55, '150 g', 'veg', ['Choco']],
              ['Britannia Chocolate Muffin', 'Britannia', 35, 40, '2 pcs', 'veg'],
            ],
          },
        ],
      },
      {
        name: 'Dry Fruits & Cereals',
        icon: 'peanuts',
        tint: '#F3E9DD',
        children: [
          {
            name: 'Dry Fruits & Nuts',
            icon: 'chestnut',
            products: [
              ['Happilo Californian Almonds', 'Happilo', 449, 599, '500 g', 'veg', ['Premium']],
              ['Happilo Whole Cashews W320', 'Happilo', 529, 699, '500 g', 'veg', ['W320']],
              ['Nutraj Walnut Kernels', 'Nutraj', 489, 649, '250 g', 'veg'],
              ['Seedless Black Raisins', 'Happilo', 189, 249, '250 g', 'veg', ['Seedless']],
              ['Pistachio Roasted & Salted', 'Nutraj', 449, 579, '250 g', 'veg', ['Salted']],
            ],
          },
          {
            name: 'Breakfast Cereals',
            icon: 'bento-box',
            products: [
              ['Kelloggs Corn Flakes Original', 'Kelloggs', 189, 220, '475 g', 'veg'],
              ['Kelloggs Chocos', 'Kelloggs', 165, 195, '385 g', 'veg', ['Choco']],
              ['Bagrrys Corn Flakes Plus', 'Bagrrys', 172, 205, '475 g', 'veg'],
            ],
          },
          {
            name: 'Oats & Muesli',
            icon: 'steaming-bowl',
            products: [
              ['Quaker Oats', 'Quaker', 165, 195, '1 kg', 'veg', ['High Fibre']],
              ['Saffola Masala Oats Classic', 'Saffola', 45, 55, '6 sachets', 'veg', ['Masala']],
              ['Bagrrys Crunchy Muesli', 'Bagrrys', 349, 425, '750 g', 'veg', ['Fruit & Nut']],
            ],
          },
          {
            name: 'Seeds & Superfoods',
            icon: 'peanuts',
            products: [
              ['Chia Seeds Raw', 'Happilo', 249, 329, '250 g', 'veg', ['Superfood']],
              ['Flax Seeds Roasted', 'Nutraj', 149, 199, '250 g', 'veg', ['Omega 3']],
              ['Pumpkin Seeds', 'Happilo', 289, 379, '250 g', 'veg'],
            ],
          },
        ],
      },
      {
        name: 'Chicken, Meat & Fish',
        icon: 'poultry-leg',
        tint: '#FBE3E3',
        children: [
          {
            name: 'Chicken',
            icon: 'poultry-leg',
            products: [
              ['Chicken Curry Cut With Skin', 'Bingoor Meat', 218, 275, '500 g', 'nonveg', ['Curry Cut']],
              ['Chicken Boneless Breast', 'Bingoor Meat', 289, 359, '450 g', 'nonveg', ['Boneless']],
              ['Chicken Drumsticks', 'Bingoor Meat', 249, 310, '450 g', 'nonveg'],
            ],
          },
          {
            name: 'Mutton',
            icon: 'cut-of-meat',
            products: [
              ['Mutton Curry Cut', 'Bingoor Meat', 489, 599, '500 g', 'nonveg', ['Curry Cut']],
              ['Mutton Keema', 'Bingoor Meat', 452, 549, '500 g', 'nonveg', ['Minced']],
            ],
          },
          {
            name: 'Fish & Seafood',
            icon: 'fish',
            products: [
              ['Rohu Fish Curry Cut', 'Bingoor Meat', 289, 359, '500 g', 'nonveg'],
              ['Prawns Medium Cleaned', 'Bingoor Meat', 389, 479, '400 g', 'nonveg', ['Deveined']],
              ['Surmai Fish Steaks', 'Bingoor Meat', 549, 679, '500 g', 'nonveg'],
            ],
          },
          {
            name: 'Frozen & Ready Meat',
            icon: 'french-fries',
            products: [
              ['Godrej Yummiez Chicken Nuggets', 'Yummiez', 229, 279, '400 g', 'nonveg', ['Frozen']],
              ['ITC Master Chef Chicken Seekh Kebab', 'ITC', 259, 319, '400 g', 'nonveg', ['Frozen']],
              ['Sumeru Chicken Sausages', 'Sumeru', 189, 235, '250 g', 'nonveg', ['Frozen']],
            ],
          },
        ],
      },
      {
        name: 'Kitchenware & Appliances',
        icon: 'fork-and-knife-with-plate',
        tint: '#ECEFF1',
        children: [
          {
            name: 'Cookware',
            icon: 'shallow-pan-of-food',
            products: [
              ['Prestige Omega Non-Stick Tawa', 'Prestige', 749, 1099, '1 pc', '', ['Non-Stick']],
              ['Hawkins Contura Pressure Cooker', 'Hawkins', 2149, 2795, '3 L', '', ['Hard Anodised']],
              ['Milton Stainless Steel Kadai', 'Milton', 899, 1299, '1 pc', '', ['Steel']],
            ],
          },
          {
            name: 'Storage & Containers',
            icon: 'takeout-box',
            products: [
              ['Milton Insulated Casserole', 'Milton', 649, 899, '1.5 L', '', ['Insulated']],
              ['Borosil Glass Storage Set', 'Borosil', 899, 1299, '3 pcs', '', ['Glass']],
              ['Cello Plastic Container Set', 'Cello', 449, 649, '6 pcs', '', ['Airtight']],
            ],
          },
          {
            name: 'Small Appliances',
            icon: 'electric-plug',
            products: [
              ['Philips Daily Mixer Grinder', 'Philips', 3499, 4595, '1 pc', '', ['750 W']],
              ['Prestige Electric Kettle', 'Prestige', 1099, 1595, '1.5 L', '', ['1500 W']],
              ['Bajaj Sandwich Toaster', 'Bajaj', 1249, 1799, '1 pc', '', ['700 W']],
            ],
          },
          {
            name: 'Kitchen Tools',
            icon: 'kitchen-knife',
            products: [
              ['Pigeon Chopper', 'Pigeon', 349, 599, '900 ml', '', ['Manual']],
              ['Stainless Steel Knife Set', 'Milton', 449, 699, '5 pcs', '', ['Steel']],
              ['Silicone Spatula Set', 'Wonderchef', 299, 499, '3 pcs', '', ['Heat Safe']],
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Snacks & Drinks',
    icon: 'popcorn',
    categories: [
      {
        name: 'Chips & Namkeen',
        icon: 'french-fries',
        tint: '#FFF1E6',
        children: [
          {
            name: 'Potato Chips',
            icon: 'french-fries',
            products: [
              ["Lay's India's Magic Masala", "Lay's", 20, 20, '52 g', 'veg', ['Masala']],
              ["Lay's American Style Cream & Onion", "Lay's", 20, 20, '52 g', 'veg', ['Cream & Onion']],
              ['Uncle Chipps Spicy Treat', 'Uncle Chipps', 20, 20, '53 g', 'veg', ['Spicy']],
              ['Bingo Original Style Salted', 'Bingo', 20, 20, '52 g', 'veg', ['Salted']],
            ],
          },
          {
            name: 'Bhujia & Mixtures',
            icon: 'peanuts',
            products: [
              ['Haldirams Aloo Bhujia', 'Haldirams', 55, 65, '200 g', 'veg', ['Spicy']],
              ['Haldirams Navratan Mix', 'Haldirams', 60, 72, '200 g', 'veg'],
              ['Bikaji Bikaneri Bhujia', 'Bikaji', 52, 62, '200 g', 'veg'],
              ['Haldirams Moong Dal', 'Haldirams', 48, 58, '200 g', 'veg', ['Fried']],
            ],
          },
          {
            name: 'Nachos & Corn Chips',
            icon: 'taco',
            products: [
              ['Doritos Nacho Cheese', 'Doritos', 50, 60, '70 g', 'veg', ['Cheese']],
              ['Kurkure Masala Munch', 'Kurkure', 20, 20, '75 g', 'veg', ['Masala']],
              ['Bingo Mad Angles Achaari Masti', 'Bingo', 20, 20, '66 g', 'veg', ['Tangy']],
            ],
          },
          {
            name: 'Popcorn & Puffs',
            icon: 'popcorn',
            products: [
              ['Act II Instant Popcorn Butter', 'Act II', 35, 42, '70 g', 'veg', ['Microwave']],
              ['Kurkure Puffcorn Yummy Cheese', 'Kurkure', 20, 20, '58 g', 'veg', ['Cheese']],
              ['4700BC Peri Peri Popcorn', '4700BC', 99, 125, '75 g', 'veg', ['Peri Peri']],
            ],
          },
        ],
      },
      {
        name: 'Sweets & Chocolates',
        icon: 'chocolate-bar',
        tint: '#F4E4EC',
        children: [
          {
            name: 'Chocolates',
            icon: 'chocolate-bar',
            products: [
              ['Cadbury Dairy Milk Silk', 'Cadbury', 85, 95, '150 g', 'veg', ['Milk Choco']],
              ['Nestle KitKat 4 Finger', 'Nestle', 40, 45, '37.3 g', 'veg', ['Wafer']],
              ['Amul Dark Chocolate 55%', 'Amul', 105, 125, '150 g', 'veg', ['Dark']],
              ['Ferrero Rocher T16', 'Ferrero', 549, 699, '200 g', 'veg', ['Premium']],
            ],
          },
          {
            name: 'Indian Sweets',
            icon: 'moon-cake',
            products: [
              ['Haldirams Soan Papdi', 'Haldirams', 145, 175, '500 g', 'veg'],
              ['Bikano Kaju Katli', 'Bikano', 449, 549, '250 g', 'veg', ['Kaju']],
              ['Gits Gulab Jamun Ready to Eat', 'Gits', 132, 160, '500 g', 'veg'],
            ],
          },
          {
            name: 'Candies & Gums',
            icon: 'candy',
            products: [
              ['Center Fresh Spearmint', 'Center Fresh', 10, 10, '10 pcs', 'veg', ['Mint']],
              ['Alpenliebe Original', 'Alpenliebe', 30, 35, '20 pcs', 'veg', ['Caramel']],
              ['Mentos Mint Roll', 'Mentos', 25, 30, '1 roll', 'veg', ['Mint']],
            ],
          },
        ],
      },
      {
        name: 'Drinks & Juices',
        icon: 'cup-with-straw',
        tint: '#E6F4F1',
        children: [
          {
            name: 'Soft Drinks',
            icon: 'cup-with-straw',
            products: [
              ['Coca-Cola Original Taste', 'Coca-Cola', 40, 45, '750 ml', 'veg', ['Chilled']],
              ['Thums Up Strong Soda', 'Thums Up', 40, 45, '750 ml', 'veg', ['Chilled']],
              ['Sprite Lime Flavoured', 'Sprite', 40, 45, '750 ml', 'veg', ['Chilled']],
              ['Pepsi Black Zero Sugar', 'Pepsi', 40, 45, '750 ml', 'veg', ['Zero Sugar']],
            ],
          },
          {
            name: 'Fruit Juices',
            icon: 'beverage-box',
            products: [
              ['Real Alphonso Mango Nectar', 'Real', 120, 140, '1 L', 'veg', ['Mango']],
              ['Tropicana 100% Orange Juice', 'Tropicana', 135, 155, '1 L', 'veg', ['No Added Sugar']],
              ['Paper Boat Aam Panna', 'Paper Boat', 45, 55, '250 ml', 'veg', ['Traditional']],
            ],
          },
          {
            name: 'Energy & Sports Drinks',
            icon: 'bottle-with-popping-cork',
            products: [
              ['Red Bull Energy Drink', 'Red Bull', 125, 140, '250 ml', 'veg', ['Caffeine']],
              ['Gatorade Blue Bolt', 'Gatorade', 60, 70, '500 ml', 'veg', ['Electrolytes']],
              ['ORS Electral Powder', 'Electral', 22, 26, '21.8 g', 'veg', ['Rehydration']],
            ],
          },
          {
            name: 'Water & Soda',
            icon: 'potable-water',
            products: [
              ['Bisleri Mineral Water', 'Bisleri', 20, 22, '1 L', 'veg'],
              ['Kinley Club Soda', 'Kinley', 22, 25, '750 ml', 'veg'],
              ['Himalayan Natural Mineral Water', 'Himalayan', 45, 55, '1 L', 'veg', ['Premium']],
            ],
          },
        ],
      },
      {
        name: 'Tea, Coffee & Health Drinks',
        icon: 'teacup-without-handle',
        tint: '#EFE8DE',
        children: [
          {
            name: 'Tea',
            icon: 'teacup-without-handle',
            products: [
              ['Tata Tea Premium Leaf', 'Tata Tea', 285, 330, '1 kg', 'veg', ['Assam']],
              ['Red Label Natural Care Tea', 'Red Label', 265, 310, '1 kg', 'veg', ['Ayurvedic']],
              ['Lipton Green Tea Bags', 'Lipton', 195, 240, '25 bags', 'veg', ['Green Tea']],
              ['Society Masala Tea', 'Society', 245, 290, '500 g', 'veg', ['Masala']],
            ],
          },
          {
            name: 'Coffee',
            icon: 'hot-beverage',
            products: [
              ['Nescafe Classic Instant Coffee', 'Nescafe', 385, 445, '100 g', 'veg', ['Instant']],
              ['Bru Gold Instant Coffee', 'Bru', 345, 399, '100 g', 'veg', ['Instant']],
              ['Continental Malgudi Filter Coffee', 'Continental', 249, 295, '500 g', 'veg', ['Filter']],
            ],
          },
          {
            name: 'Health & Milk Drinks',
            icon: 'baby-bottle',
            products: [
              ['Horlicks Classic Malt', 'Horlicks', 445, 520, '1 kg', 'veg', ['Malt']],
              ['Bournvita Health Drink', 'Bournvita', 425, 495, '1 kg', 'veg', ['Choco']],
              ['Amul Kool Kesar Milk', 'Amul', 30, 35, '200 ml', 'veg', ['Kesar']],
            ],
          },
        ],
      },
      {
        name: 'Instant & Frozen Food',
        icon: 'steaming-bowl',
        tint: '#FFF0E8',
        children: [
          {
            name: 'Noodles',
            icon: 'steaming-bowl',
            products: [
              ['Maggi 2-Minute Masala Noodles', 'Maggi', 60, 72, '280 g', 'veg', ['Masala']],
              ['Maggi Masala Cuppa Noodles', 'Maggi', 55, 60, '70.5 g', 'veg', ['Cup']],
              ['Yippee Magic Masala Noodles', 'Yippee', 52, 60, '290 g', 'veg', ['Masala']],
              ['Top Ramen Masala Noodles', 'Top Ramen', 74, 82, '360 g', 'veg'],
            ],
          },
          {
            name: 'Pasta & Soups',
            icon: 'spaghetti',
            products: [
              ['Sunfeast Yippee Pasta Treat', 'Yippee', 45, 55, '70 g', 'veg', ['Cheese']],
              ['Knorr Classic Sweet Corn Soup', 'Knorr', 62, 72, '44 g', 'veg'],
              ['Bambino Durum Wheat Pasta', 'Bambino', 78, 95, '500 g', 'veg', ['Durum']],
            ],
          },
          {
            name: 'Ready to Eat',
            icon: 'curry-rice',
            products: [
              ['MTR Ready to Eat Paneer Butter Masala', 'MTR', 125, 149, '300 g', 'veg'],
              ['Haldirams Dal Makhani', 'Haldirams', 99, 120, '300 g', 'veg'],
              ['Gits Ready Meal Rajma Masala', 'Gits', 115, 140, '300 g', 'veg'],
            ],
          },
          {
            name: 'Frozen Snacks',
            icon: 'dumpling',
            products: [
              ['McCain French Fries', 'McCain', 145, 175, '420 g', 'veg', ['Frozen']],
              ['McCain Smiles', 'McCain', 132, 160, '415 g', 'veg', ['Frozen']],
              ['ID Fresh Malabar Parota', 'ID Fresh', 99, 120, '5 pcs', 'veg', ['Frozen']],
            ],
          },
        ],
      },
      {
        name: 'Sauces & Spreads',
        icon: 'honey-pot',
        tint: '#FDEFE0',
        children: [
          {
            name: 'Ketchup & Sauces',
            icon: 'canned-food',
            products: [
              ['Kissan Fresh Tomato Ketchup', 'Kissan', 125, 145, '950 g', 'veg'],
              ['Maggi Hot & Sweet Tomato Chilli Sauce', 'Maggi', 135, 155, '1 kg', 'veg', ['Hot & Sweet']],
              ["Ching's Schezwan Chutney", "Ching's", 98, 115, '250 g', 'veg', ['Spicy']],
            ],
          },
          {
            name: 'Jams & Honey',
            icon: 'honey-pot',
            products: [
              ['Kissan Mixed Fruit Jam', 'Kissan', 165, 195, '700 g', 'veg'],
              ['Dabur Honey', 'Dabur', 249, 290, '500 g', 'veg', ['Pure']],
              ['Nutella Hazelnut Spread', 'Nutella', 399, 465, '350 g', 'veg', ['Choco']],
            ],
          },
          {
            name: 'Peanut Butter & Mayo',
            icon: 'peanuts',
            products: [
              ['Pintola All Natural Peanut Butter', 'Pintola', 349, 449, '1 kg', 'veg', ['High Protein']],
              ['Veeba Eggless Mayonnaise', 'Veeba', 99, 120, '250 g', 'veg', ['Eggless']],
              ['Dr. Oetker Fun Foods Mayo', 'Dr. Oetker', 89, 110, '245 g', 'veg'],
            ],
          },
        ],
      },
      {
        name: 'Paan Corner',
        icon: 'fallen-leaf',
        tint: '#E8F3E2',
        children: [
          {
            name: 'Mouth Fresheners',
            icon: 'fallen-leaf',
            products: [
              ['Pass Pass Pulse Candy', 'Pass Pass', 25, 30, '100 g', 'veg', ['Tangy']],
              ['Rajnigandha Silver Pearls', 'Rajnigandha', 65, 75, '50 g', 'veg', ['Elaichi']],
              ['Chandan Mukhwas', 'Bingoor Fresh', 55, 68, '100 g', 'veg'],
            ],
          },
          {
            name: 'Paan Ingredients',
            icon: 'herb',
            products: [
              ['Gulkand Rose Petal Jam', 'Bingoor Fresh', 89, 110, '200 g', 'veg'],
              ['Saunf Coated Colourful', 'Bingoor Fresh', 48, 60, '100 g', 'veg'],
            ],
          },
        ],
      },
      {
        name: 'Ice Creams & Desserts',
        icon: 'soft-ice-cream',
        tint: '#EAE6F6',
        children: [
          {
            name: 'Tubs & Family Packs',
            icon: 'ice-cream',
            products: [
              ['Amul Vanilla Royale Tub', 'Amul', 185, 220, '700 ml', 'veg', ['Vanilla']],
              ['Kwality Walls Chocolate Tub', 'Kwality Walls', 199, 240, '700 ml', 'veg', ['Choco']],
              ['Vadilal Butterscotch Tub', 'Vadilal', 175, 210, '700 ml', 'veg', ['Butterscotch']],
            ],
          },
          {
            name: 'Cones, Bars & Kulfi',
            icon: 'soft-ice-cream',
            products: [
              ['Cornetto Double Chocolate Cone', 'Cornetto', 45, 50, '110 ml', 'veg', ['Choco']],
              ['Magnum Almond Bar', 'Magnum', 95, 110, '80 ml', 'veg', ['Almond']],
              ['Amul Malai Kulfi', 'Amul', 35, 40, '60 ml', 'veg', ['Kulfi']],
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Beauty & Personal Care',
    icon: 'lipstick',
    categories: [
      {
        name: 'Bath & Body',
        icon: 'soap',
        tint: '#FDE9F1',
        children: [
          {
            name: 'Soaps & Body Wash',
            icon: 'soap',
            products: [
              ['Dove Cream Beauty Bathing Bar', 'Dove', 118, 140, '4 x 100 g', '', ['Moisturising']],
              ['Pears Pure & Gentle Soap', 'Pears', 165, 190, '4 x 125 g', '', ['Glycerine']],
              ['Nivea Nourishing Body Wash', 'Nivea', 285, 340, '500 ml', '', ['Milk & Honey']],
              ['Santoor Sandal & Turmeric Soap', 'Santoor', 130, 152, '4 x 125 g', '', ['Sandal']],
            ],
          },
          {
            name: 'Body Lotion & Oil',
            icon: 'lotion-bottle',
            products: [
              ['Nivea Soft Light Moisturiser', 'Nivea', 249, 299, '300 ml', '', ['Light']],
              ['Vaseline Intensive Care Lotion', 'Vaseline', 289, 345, '400 ml', '', ['Deep Repair']],
              ['Parachute Advansed Body Lotion', 'Parachute', 195, 235, '400 ml', '', ['Coconut']],
            ],
          },
          {
            name: 'Talc & Deodorant',
            icon: 'sponge',
            products: [
              ['Nivea Fresh Active Deodorant', 'Nivea', 199, 245, '150 ml', '', ['48 H']],
              ['Fogg Scent Napoleon', 'Fogg', 289, 349, '100 ml', '', ['No Gas']],
              ['Ponds Dreamflower Talc', 'Ponds', 145, 175, '300 g', '', ['Fragrant']],
            ],
          },
        ],
      },
      {
        name: 'Hair Care',
        icon: 'razor',
        tint: '#F1E7F7',
        children: [
          {
            name: 'Shampoo',
            icon: 'lotion-bottle',
            products: [
              ['Head & Shoulders Anti Dandruff Shampoo', 'Head & Shoulders', 218, 265, '340 ml', '', ['Anti Dandruff']],
              ['Dove Intense Repair Shampoo', 'Dove', 295, 355, '650 ml', '', ['Damage Repair']],
              ['Tresemme Keratin Smooth Shampoo', 'Tresemme', 349, 420, '580 ml', '', ['Smoothing']],
              ['Clinic Plus Strong & Long Shampoo', 'Clinic Plus', 175, 210, '355 ml', '', ['Anti Hairfall']],
            ],
          },
          {
            name: 'Conditioner & Masks',
            icon: 'lotion-bottle',
            products: [
              ['Dove Hair Fall Rescue Conditioner', 'Dove', 235, 285, '340 ml', '', ['Anti Hairfall']],
              ['Loreal Total Repair 5 Hair Mask', 'Loreal', 349, 429, '300 g', '', ['Damaged Hair']],
              ['Tresemme Keratin Smooth Conditioner', 'Tresemme', 289, 349, '335 ml', '', ['Smoothing']],
            ],
          },
          {
            name: 'Hair Oil',
            icon: 'olive',
            products: [
              ['Parachute Advansed Jasmine Hair Oil', 'Parachute', 145, 175, '300 ml', '', ['Coconut']],
              ['Dabur Amla Hair Oil', 'Dabur', 168, 199, '450 ml', '', ['Amla']],
              ['Indulekha Bringha Hair Oil', 'Indulekha', 449, 549, '100 ml', '', ['Ayurvedic']],
            ],
          },
          {
            name: 'Hair Colour',
            icon: 'nail-polish',
            products: [
              ['Godrej Expert Rich Creme Hair Colour', 'Godrej', 45, 55, '20 g', '', ['Natural Black']],
              ['Loreal Casting Creme Gloss', 'Loreal', 549, 665, '1 pack', '', ['Ammonia Free']],
              ['Garnier Color Naturals', 'Garnier', 189, 229, '1 pack', '', ['Creme']],
            ],
          },
        ],
      },
      {
        name: 'Skin & Face',
        icon: 'lotion-bottle',
        tint: '#FFE9E4',
        children: [
          {
            name: 'Face Wash',
            icon: 'droplet',
            products: [
              ['Himalaya Purifying Neem Face Wash', 'Himalaya', 165, 199, '150 ml', '', ['Neem']],
              ['Cetaphil Gentle Skin Cleanser', 'Cetaphil', 549, 675, '250 ml', '', ['Sensitive Skin']],
              ['Garnier Bright Complete Face Wash', 'Garnier', 175, 210, '150 g', '', ['Vitamin C']],
            ],
          },
          {
            name: 'Moisturiser & Serum',
            icon: 'lotion-bottle',
            products: [
              ['Minimalist Niacinamide 10% Serum', 'Minimalist', 549, 699, '30 ml', '', ['Acne', 'Niacinamide']],
              ['The Derma Co Vitamin C Serum', 'The Derma Co', 499, 649, '30 ml', '', ['Brightening']],
              ['Ponds Super Light Gel Moisturiser', 'Ponds', 225, 275, '147 g', '', ['Oil Free']],
            ],
          },
          {
            name: 'Sunscreen & Lip Care',
            icon: 'sunglasses',
            products: [
              ['Lakme Sun Expert SPF 50 Sunscreen', 'Lakme', 299, 365, '100 ml', '', ['SPF 50']],
              ['Minimalist SPF 50 Sunscreen', 'Minimalist', 449, 579, '50 g', '', ['SPF 50']],
              ['Nivea Strawberry Lip Balm', 'Nivea', 149, 179, '4.8 g', '', ['Tinted']],
            ],
          },
        ],
      },
      {
        name: 'Beauty & Cosmetics',
        icon: 'lipstick',
        tint: '#FBE2EE',
        children: [
          {
            name: 'Lips',
            icon: 'lipstick',
            products: [
              ['Loreal Paris Infallible Matte Lipstick', 'Loreal', 930, 1099, '5 ml', '', ['Matte']],
              ['Maybelline Superstay Matte Ink', 'Maybelline', 649, 799, '5 ml', '', ['Long Wear']],
              ['Lakme 9 to 5 Lip Crayon', 'Lakme', 449, 549, '2.8 g', '', ['Creamy']],
            ],
          },
          {
            name: 'Face Makeup',
            icon: 'nail-polish',
            products: [
              ["L'Oreal Infallible 24H Tinted Serum", 'Loreal', 850, 999, '30 ml', '', ['Natural']],
              ['Maybelline Fit Me Compact Powder', 'Maybelline', 349, 425, '8 g', '', ['Matte']],
              ['Lakme Absolute Blur Primer', 'Lakme', 549, 675, '30 g', '', ['Primer']],
            ],
          },
          {
            name: 'Eyes & Nails',
            icon: 'ring',
            products: [
              ['Maybelline Colossal Kajal', 'Maybelline', 199, 240, '0.35 g', '', ['Smudge Proof']],
              ['Lakme Eyeconic Liquid Liner', 'Lakme', 275, 335, '4.5 ml', '', ['Waterproof']],
              ['Colorbar Nail Lacquer', 'Colorbar', 299, 375, '12 ml', '', ['Glossy']],
            ],
          },
        ],
      },
      {
        name: 'Feminine Hygiene',
        icon: 'cherry-blossom',
        tint: '#FCE4EC',
        children: [
          {
            name: 'Sanitary Pads',
            icon: 'cherry-blossom',
            products: [
              ['Whisper Ultra Clean XL Wings', 'Whisper', 289, 345, '30 pads', '', ['XL']],
              ['Stayfree Secure XL Cottony', 'Stayfree', 189, 230, '20 pads', '', ['XL']],
              ['Sofy Bodyfit Antibacteria XL', 'Sofy', 225, 275, '24 pads', '', ['XL']],
            ],
          },
          {
            name: 'Intimate Care',
            icon: 'droplet',
            products: [
              ['Everteen Natural Intimate Wash', 'Everteen', 199, 249, '105 ml', '', ['pH Balanced']],
              ['Sirona Menstrual Cup Medium', 'Sirona', 549, 699, '1 pc', '', ['Reusable']],
              ['Pee Safe Toilet Seat Sanitizer', 'Pee Safe', 149, 185, '75 ml', '', ['Travel']],
            ],
          },
        ],
      },
      {
        name: 'Baby Care',
        icon: 'baby',
        tint: '#E4F1FB',
        children: [
          {
            name: 'Diapers & Wipes',
            icon: 'baby-symbol',
            products: [
              ['Pampers Premium Care Pants M', 'Pampers', 899, 1099, '54 pcs', '', ['Medium']],
              ['Huggies Wonder Pants L', 'Huggies', 849, 1049, '48 pcs', '', ['Large']],
              ['Himalaya Gentle Baby Wipes', 'Himalaya', 199, 249, '72 pcs', '', ['Fragrance Free']],
            ],
          },
          {
            name: 'Baby Food',
            icon: 'baby-bottle',
            products: [
              ['Cerelac Wheat Apple Cherry', 'Nestle', 289, 340, '300 g', 'veg', ['Stage 2']],
              ['Nestle Nan Pro 2 Formula', 'Nestle', 749, 899, '400 g', 'veg', ['Stage 2']],
              ['Slurrp Farm Millet Dosa Mix', 'Slurrp Farm', 249, 299, '150 g', 'veg', ['Millet']],
            ],
          },
          {
            name: 'Baby Bath & Skin',
            icon: 'bathtub',
            products: [
              ['Johnsons Baby Shampoo', 'Johnsons', 225, 275, '200 ml', '', ['No Tears']],
              ['Himalaya Baby Lotion', 'Himalaya', 189, 230, '200 ml', '', ['Olive Oil']],
              ['Sebamed Baby Cleansing Bar', 'Sebamed', 349, 425, '150 g', '', ['pH 5.5']],
            ],
          },
        ],
      },
      {
        name: 'Health & Pharma',
        icon: 'pill',
        tint: '#E6F2EC',
        children: [
          {
            name: 'Vitamins & Supplements',
            icon: 'pill',
            products: [
              ['Tata 1mg Salmon Omega 3', 'Tata 1mg', 465, 549, '60 pcs', '', ['Omega 3']],
              ['Himalaya Ashwagandha Tablets', 'Himalaya', 199, 245, '60 tabs', 'veg', ['Ayurvedic']],
              ['Revital H Multivitamin', 'Revital', 389, 465, '30 caps', '', ['Daily']],
            ],
          },
          {
            name: 'Protein & Nutrition',
            icon: 'flexed-biceps',
            products: [
              ['Optimum Nutrition Gold Standard Whey', 'Optimum Nutrition', 2389, 2999, '907 g', '', ['Chocolate']],
              ['GNC Pro 100% Whey Protein', 'GNC', 2657, 3099, '1 kg', '', ['Chocolate']],
              ['Wellcore Micronised Creatine', 'Wellcore', 539, 699, '122 g', 'veg', ['Fruit Fusion']],
            ],
          },
          {
            name: 'First Aid & Relief',
            icon: 'adhesive-bandage',
            products: [
              ['Band-Aid Washproof Strips', 'Band-Aid', 89, 110, '40 pcs', '', ['Waterproof']],
              ['Volini Pain Relief Spray', 'Volini', 249, 299, '60 g', '', ['Fast Relief']],
              ['Dettol Antiseptic Liquid', 'Dettol', 189, 225, '550 ml', '', ['Antiseptic']],
            ],
          },
          {
            name: 'Oral Care',
            icon: 'toothbrush',
            products: [
              ['Colgate Strong Teeth Toothpaste', 'Colgate', 115, 135, '200 g', 'veg', ['Cavity Guard']],
              ['Sensodyne Rapid Relief', 'Sensodyne', 189, 225, '80 g', 'veg', ['Sensitive']],
              ['Oral-B Pro Health Toothbrush', 'Oral-B', 99, 125, '2 pcs', '', ['Soft']],
              ['Listerine Cool Mint Mouthwash', 'Listerine', 219, 265, '500 ml', '', ['Mint']],
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Household Essentials',
    icon: 'broom',
    categories: [
      {
        name: 'Cleaners & Repellents',
        icon: 'bucket',
        tint: '#E3F0FA',
        children: [
          {
            name: 'Detergents & Fabric Care',
            icon: 'bucket',
            products: [
              ['Surf Excel Matic Top Load Liquid', 'Surf Excel', 449, 545, '2 L', '', ['Top Load']],
              ['Ariel Matic Front Load Powder', 'Ariel', 599, 725, '2 kg', '', ['Front Load']],
              ['Rin Advanced Detergent Bar', 'Rin', 60, 72, '4 x 250 g', '', ['Bar']],
              ['Comfort After Wash Fabric Conditioner', 'Comfort', 249, 299, '860 ml', '', ['Floral']],
            ],
          },
          {
            name: 'Dishwash',
            icon: 'sponge',
            products: [
              ['Vim Dishwash Liquid Gel Lemon', 'Vim', 219, 265, '1.8 L', '', ['Lemon']],
              ['Vim Dishwash Bar', 'Vim', 40, 48, '3 x 200 g', '', ['Bar']],
              ['Scotch-Brite Scrub Pad', 'Scotch-Brite', 89, 110, '3 pcs', ''],
            ],
          },
          {
            name: 'Floor & Toilet Cleaners',
            icon: 'toilet',
            products: [
              ['Lizol Disinfectant Floor Cleaner Citrus', 'Lizol', 289, 345, '2 L', '', ['Citrus']],
              ['Harpic Power Plus Toilet Cleaner', 'Harpic', 199, 240, '1 L', '', ['10x Action']],
              ['Colin Glass Cleaner', 'Colin', 129, 155, '500 ml', '', ['Streak Free']],
            ],
          },
          {
            name: 'Repellents & Fresheners',
            icon: 'butterfly',
            products: [
              ['Good Knight Gold Flash Refill', 'Good Knight', 89, 110, '45 ml', '', ['Mosquito']],
              ['All Out Ultra Refill Twin Pack', 'All Out', 149, 185, '2 x 45 ml', '', ['Mosquito']],
              ['Odonil Room Freshener Blocks', 'Odonil', 99, 125, '3 x 50 g', '', ['Lavender']],
            ],
          },
          {
            name: 'Tissues & Disposables',
            icon: 'roll-of-paper',
            products: [
              ['Origami Kitchen Towel Rolls', 'Origami', 199, 249, '2 rolls', '', ['Absorbent']],
              ['Premium Toilet Paper Rolls', 'Origami', 289, 349, '4 rolls', '', ['3 Ply']],
              ['Garbage Bags Medium', 'Bingoor Home', 149, 189, '90 pcs', '', ['Biodegradable']],
            ],
          },
        ],
      },
      {
        name: 'Home & Lifestyle',
        icon: 'potted-plant',
        tint: '#EAF1E6',
        children: [
          {
            name: 'Bedsheets & Furnishing',
            icon: 'bed',
            products: [
              ['Cotton Double Bedsheet with 2 Pillow Covers', 'Bingoor Home', 899, 1499, '1 set', '', ['Cotton']],
              ['Microfibre Pillow Pair', 'Bingoor Home', 649, 999, '2 pcs', '', ['Soft']],
              ['Cotton Bath Towel Large', 'Bombay Dyeing', 449, 699, '1 pc', '', ['Cotton']],
            ],
          },
          {
            name: 'Home Decor & Plants',
            icon: 'potted-plant',
            products: [
              ['Money Plant in Ceramic Pot', 'Bingoor Home', 349, 499, '1 pc', '', ['Indoor']],
              ['Scented Candle Jar Vanilla', 'Bingoor Home', 299, 449, '1 pc', '', ['Vanilla']],
              ['Photo Frame Set of 3', 'Bingoor Home', 449, 699, '3 pcs', ''],
            ],
          },
          {
            name: 'Pooja Needs',
            icon: 'candle',
            products: [
              ['Cycle Agarbatti Three in One', 'Cycle', 89, 110, '120 sticks', '', ['Fragrant']],
              ['Brass Diya Set', 'Bingoor Home', 399, 599, '2 pcs', '', ['Brass']],
              ['Pure Cotton Wicks (Batti)', 'Bingoor Home', 49, 65, '100 pcs', ''],
            ],
          },
        ],
      },
      {
        name: 'Electronics',
        icon: 'headphone',
        tint: '#E8EAF6',
        children: [
          {
            name: 'Earphones & Speakers',
            icon: 'headphone',
            products: [
              ['Dubstep Buzz X11 TWS Earbuds', 'Dubstep', 499, 1999, '1 unit', '', ['ENC', 'IPX5']],
              ['Portronics Conch Theta C Wired Earphones', 'Portronics', 311, 799, '1 unit', '', ['USB C']],
              ['boAt Stone 358 Bluetooth Speaker', 'boAt', 1299, 2990, '1 unit', '', ['10 W', 'IPX7']],
              ['Ambrane Stringz 38 Wired Earphones', 'Ambrane', 199, 449, '1 unit', '', ['3.5 mm Jack']],
            ],
          },
          {
            name: 'Power & Charging',
            icon: 'battery',
            products: [
              ['Portronics Luxcell B12 10K Power Bank', 'Portronics', 629, 1499, '10000 mAh', '', ['Type C']],
              ['Mi 33 W Fast Charger', 'Mi', 749, 999, '1 unit', '', ['33 W']],
              ['Braided Type C Cable 1.5 m', 'Ambrane', 249, 499, '1 unit', '', ['60 W']],
            ],
          },
          {
            name: 'Smart Wearables',
            icon: 'watch',
            products: [
              ['NoiseFit Twist Go Smart Watch', 'Noise', 1999, 5999, '1 unit', '', ['Bluetooth Calling']],
              ['boAt Wave Call Smart Watch', 'boAt', 1799, 4999, '1 unit', '', ['1.83 inch']],
            ],
          },
          {
            name: 'Bulbs & Lighting',
            icon: 'light-bulb',
            products: [
              ['Philips 12 W LED Bulb Cool Day Light', 'Philips', 149, 299, '1 unit', '', ['12 W']],
              ['Philips Rechargeable Emergency Bulb', 'Philips', 369, 649, '1 unit', '', ['9 W']],
              ['Wipro LED Batten 20 W', 'Wipro', 449, 799, '1 unit', '', ['20 W']],
            ],
          },
        ],
      },
      {
        name: 'Stationery & Games',
        icon: 'pencil',
        tint: '#FFF4DE',
        children: [
          {
            name: 'Notebooks & Paper',
            icon: 'notebook',
            products: [
              ['Classmate Notebook Single Line', 'Classmate', 175, 220, '6 pcs', '', ['172 Pages']],
              ['A4 Copier Paper Ream', 'JK', 349, 449, '500 sheets', '', ['75 GSM']],
              ['Sticky Notes Assorted', 'Bingoor Office', 99, 149, '5 pads', ''],
            ],
          },
          {
            name: 'Pens & Art Supplies',
            icon: 'pencil',
            products: [
              ['Cello Butterflow Ball Pen Blue', 'Cello', 50, 60, '10 pcs', ''],
              ['Apsara Platinum Pencils', 'Apsara', 60, 75, '10 pcs', ''],
              ['Camlin Wax Crayons 24 Shades', 'Camlin', 89, 120, '24 pcs', ''],
            ],
          },
          {
            name: 'Board Games & Toys',
            icon: 'game-die',
            products: [
              ['UNO Flip Card Game', 'Mattel', 399, 599, '1 pack', '', ['2-10 Players']],
              ['Funskool Chess Set', 'Funskool', 449, 699, '1 set', ''],
              ['Ludo King Board Game', 'Bingoor Play', 249, 399, '1 set', ''],
            ],
          },
        ],
      },
      {
        name: 'Pet Care',
        icon: 'dog',
        tint: '#F7EDE2',
        children: [
          {
            name: 'Dog Food & Treats',
            icon: 'dog',
            products: [
              ['Pedigree Adult Chicken & Vegetables', 'Pedigree', 749, 899, '3 kg', 'nonveg', ['Adult']],
              ['Drools Focus Puppy Food', 'Drools', 649, 799, '3 kg', 'nonveg', ['Puppy']],
              ['Pedigree Dentastix Treats', 'Pedigree', 199, 249, '7 sticks', 'nonveg'],
            ],
          },
          {
            name: 'Cat Food & Litter',
            icon: 'cat',
            products: [
              ['Whiskas Adult Ocean Fish', 'Whiskas', 549, 679, '1.2 kg', 'nonveg', ['Adult']],
              ['Sheba Rich Premium Cat Food', 'Sheba', 99, 125, '70 g', 'nonveg', ['Gravy']],
              ['Clumping Cat Litter', 'Drools', 449, 599, '5 kg', '', ['Clumping']],
            ],
          },
          {
            name: 'Pet Grooming',
            icon: 'paw-prints',
            products: [
              ['Himalaya Erina EP Pet Shampoo', 'Himalaya', 249, 299, '200 ml', '', ['Tick Control']],
              ['Pet Grooming Brush', 'Bingoor Pet', 299, 449, '1 pc', ''],
            ],
          },
        ],
      },
    ],
  },
];
