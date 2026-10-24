export type Lang = 'en' | 'hi';

/**
 * Interface words in both languages. Product and category names come from the
 * catalogue (the admin types both); this list only covers fixed labels.
 */
const DICT: Record<string, { en: string; hi: string }> = {
  home: { en: 'Home', hi: 'होम' },
  categories: { en: 'Categories', hi: 'श्रेणियाँ' },
  cart: { en: 'Cart', hi: 'कार्ट' },
  profile: { en: 'Profile', hi: 'प्रोफ़ाइल' },
  account: { en: 'Account', hi: 'खाता' },
  search: { en: 'Search for products', hi: 'सामान खोजें' },
  add: { en: 'Add', hi: 'जोड़ें' },
  outOfStock: { en: 'Out of stock', hi: 'स्टॉक में नहीं' },
  yourCart: { en: 'Your cart', hi: 'आपका कार्ट' },
  checkout: { en: 'Checkout', hi: 'चेकआउट' },
  proceed: { en: 'Proceed to payment', hi: 'भुगतान के लिए आगे बढ़ें' },
  delivery: { en: 'Delivery', hi: 'डिलीवरी' },
  free: { en: 'FREE', hi: 'मुफ़्त' },
  itemTotal: { en: 'Item total', hi: 'सामान का कुल' },
  toPay: { en: 'To pay', hi: 'कुल भुगतान' },
  handling: { en: 'Handling charge', hi: 'हैंडलिंग शुल्क' },
  billSummary: { en: 'Bill summary', hi: 'बिल का विवरण' },
  seeAll: { en: 'See all', hi: 'सभी देखें' },
  language: { en: 'Language', hi: 'भाषा' },
  signIn: { en: 'Sign in', hi: 'साइन इन' },
  createAccount: { en: 'Create account', hi: 'खाता बनाएँ' },
  myOrders: { en: 'My orders', hi: 'मेरे ऑर्डर' },
  wishlist: { en: 'Wishlist', hi: 'विशलिस्ट' },
  support: { en: 'Chat with customer care', hi: 'कस्टमर केयर से चैट' },
  deliveryTime: { en: 'Delivery time', hi: 'डिलीवरी का समय' },
  chooseSlot: { en: 'Choose delivery time', hi: 'डिलीवरी का समय चुनें' },
  address: { en: 'Delivery address', hi: 'डिलीवरी का पता' },
  payment: { en: 'Payment', hi: 'भुगतान' },
  placeOrder: { en: 'Place order', hi: 'ऑर्डर करें' },
  filters: { en: 'Filters', hi: 'फ़िल्टर' },
  sortBy: { en: 'Sort by', hi: 'क्रमबद्ध करें' },
  lowToHigh: { en: 'Low to high', hi: 'कम से ज़्यादा' },
  highToLow: { en: 'High to low', hi: 'ज़्यादा से कम' },
  price: { en: 'Price', hi: 'कीमत' },
  brand: { en: 'Brand', hi: 'ब्रांड' },
  inStockOnly: { en: 'In stock only', hi: 'सिर्फ़ उपलब्ध' },
  clear: { en: 'Clear', hi: 'हटाएँ' },
  needHelp: { en: 'Need help? Call', hi: 'मदद चाहिए? कॉल करें' },
};

export function translate(key: string, lang: Lang): string {
  const row = DICT[key];
  return row ? row[lang] : key;
}

/** A product or category name in the chosen language, falling back to English. */
export function localName(entity: { name: string; nameHi?: string }, lang: Lang): string {
  return lang === 'hi' && entity.nameHi ? entity.nameHi : entity.name;
}
