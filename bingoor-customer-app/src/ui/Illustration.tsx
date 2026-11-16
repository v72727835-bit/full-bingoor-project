import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
import { ms } from '../theme';

/**
 * Flat artwork for every aisle in the shop.
 *
 * Metro needs a literal path in every require, so the map is generated rather
 * than built at runtime. Shipping the art with the app (instead of pulling
 * photos off a CDN) means category tiles paint instantly, work offline, and
 * always match the product - which stock photography never does.
 */
const ART: Record<string, number> = {
  'adhesive-bandage': require('../assets/cat/adhesive-bandage.png'),
  'avocado': require('../assets/cat/avocado.png'),
  'baby': require('../assets/cat/baby.png'),
  'baby-bottle': require('../assets/cat/baby-bottle.png'),
  'baby-symbol': require('../assets/cat/baby-symbol.png'),
  'baguette-bread': require('../assets/cat/baguette-bread.png'),
  'banana': require('../assets/cat/banana.png'),
  'basket': require('../assets/cat/basket.png'),
  'bathtub': require('../assets/cat/bathtub.png'),
  'battery': require('../assets/cat/battery.png'),
  'beans': require('../assets/cat/beans.png'),
  'bed': require('../assets/cat/bed.png'),
  'bell-pepper': require('../assets/cat/bell-pepper.png'),
  'bento-box': require('../assets/cat/bento-box.png'),
  'beverage-box': require('../assets/cat/beverage-box.png'),
  'bottle-with-popping-cork': require('../assets/cat/bottle-with-popping-cork.png'),
  'bread': require('../assets/cat/bread.png'),
  'broccoli': require('../assets/cat/broccoli.png'),
  'broom': require('../assets/cat/broom.png'),
  'bucket': require('../assets/cat/bucket.png'),
  'butter': require('../assets/cat/butter.png'),
  'butterfly': require('../assets/cat/butterfly.png'),
  'candle': require('../assets/cat/candle.png'),
  'candy': require('../assets/cat/candy.png'),
  'canned-food': require('../assets/cat/canned-food.png'),
  'carrot': require('../assets/cat/carrot.png'),
  'cat': require('../assets/cat/cat.png'),
  'cheese-wedge': require('../assets/cat/cheese-wedge.png'),
  'cherry-blossom': require('../assets/cat/cherry-blossom.png'),
  'chestnut': require('../assets/cat/chestnut.png'),
  'chocolate-bar': require('../assets/cat/chocolate-bar.png'),
  'coconut': require('../assets/cat/coconut.png'),
  'cooked-rice': require('../assets/cat/cooked-rice.png'),
  'cookie': require('../assets/cat/cookie.png'),
  'cucumber': require('../assets/cat/cucumber.png'),
  'cup-with-straw': require('../assets/cat/cup-with-straw.png'),
  'cupcake': require('../assets/cat/cupcake.png'),
  'curry-rice': require('../assets/cat/curry-rice.png'),
  'cut-of-meat': require('../assets/cat/cut-of-meat.png'),
  'department-store': require('../assets/cat/department-store.png'),
  'dog': require('../assets/cat/dog.png'),
  'droplet': require('../assets/cat/droplet.png'),
  'dumpling': require('../assets/cat/dumpling.png'),
  'ear-of-corn': require('../assets/cat/ear-of-corn.png'),
  'egg': require('../assets/cat/egg.png'),
  'eggplant': require('../assets/cat/eggplant.png'),
  'electric-plug': require('../assets/cat/electric-plug.png'),
  'fallen-leaf': require('../assets/cat/fallen-leaf.png'),
  'fire': require('../assets/cat/fire.png'),
  'fish': require('../assets/cat/fish.png'),
  'flatbread': require('../assets/cat/flatbread.png'),
  'flexed-biceps': require('../assets/cat/flexed-biceps.png'),
  'fork-and-knife-with-plate': require('../assets/cat/fork-and-knife-with-plate.png'),
  'french-fries': require('../assets/cat/french-fries.png'),
  'game-die': require('../assets/cat/game-die.png'),
  'garlic': require('../assets/cat/garlic.png'),
  'glass-of-milk': require('../assets/cat/glass-of-milk.png'),
  'green-salad': require('../assets/cat/green-salad.png'),
  'headphone': require('../assets/cat/headphone.png'),
  'herb': require('../assets/cat/herb.png'),
  'honey-pot': require('../assets/cat/honey-pot.png'),
  'hot-beverage': require('../assets/cat/hot-beverage.png'),
  'hot-pepper': require('../assets/cat/hot-pepper.png'),
  'ice-cream': require('../assets/cat/ice-cream.png'),
  'kitchen-knife': require('../assets/cat/kitchen-knife.png'),
  'leafy-green': require('../assets/cat/leafy-green.png'),
  'lemon': require('../assets/cat/lemon.png'),
  'light-bulb': require('../assets/cat/light-bulb.png'),
  'lipstick': require('../assets/cat/lipstick.png'),
  'lotion-bottle': require('../assets/cat/lotion-bottle.png'),
  'mango': require('../assets/cat/mango.png'),
  'moon-cake': require('../assets/cat/moon-cake.png'),
  'nail-polish': require('../assets/cat/nail-polish.png'),
  'notebook': require('../assets/cat/notebook.png'),
  'olive': require('../assets/cat/olive.png'),
  'onion': require('../assets/cat/onion.png'),
  'paw-prints': require('../assets/cat/paw-prints.png'),
  'peanuts': require('../assets/cat/peanuts.png'),
  'pencil': require('../assets/cat/pencil.png'),
  'pill': require('../assets/cat/pill.png'),
  'popcorn': require('../assets/cat/popcorn.png'),
  'potable-water': require('../assets/cat/potable-water.png'),
  'potato': require('../assets/cat/potato.png'),
  'potted-plant': require('../assets/cat/potted-plant.png'),
  'poultry-leg': require('../assets/cat/poultry-leg.png'),
  'pretzel': require('../assets/cat/pretzel.png'),
  'razor': require('../assets/cat/razor.png'),
  'red-apple': require('../assets/cat/red-apple.png'),
  'rice-ball': require('../assets/cat/rice-ball.png'),
  'ring': require('../assets/cat/ring.png'),
  'roll-of-paper': require('../assets/cat/roll-of-paper.png'),
  'salt': require('../assets/cat/salt.png'),
  'shallow-pan-of-food': require('../assets/cat/shallow-pan-of-food.png'),
  'shaved-ice': require('../assets/cat/shaved-ice.png'),
  'shopping-bags': require('../assets/cat/shopping-bags.png'),
  'shopping-cart': require('../assets/cat/shopping-cart.png'),
  'shrimp': require('../assets/cat/shrimp.png'),
  'soap': require('../assets/cat/soap.png'),
  'soft-ice-cream': require('../assets/cat/soft-ice-cream.png'),
  'spaghetti': require('../assets/cat/spaghetti.png'),
  'sparkles': require('../assets/cat/sparkles.png'),
  'sponge': require('../assets/cat/sponge.png'),
  'steaming-bowl': require('../assets/cat/steaming-bowl.png'),
  'sunglasses': require('../assets/cat/sunglasses.png'),
  'taco': require('../assets/cat/taco.png'),
  'takeout-box': require('../assets/cat/takeout-box.png'),
  'tangerine': require('../assets/cat/tangerine.png'),
  'teacup-without-handle': require('../assets/cat/teacup-without-handle.png'),
  'toilet': require('../assets/cat/toilet.png'),
  'tomato': require('../assets/cat/tomato.png'),
  'toothbrush': require('../assets/cat/toothbrush.png'),
  'watch': require('../assets/cat/watch.png'),
};

/** Something sensible when the backend sends a key we have no art for. */
const FALLBACK = ART['shopping-cart'];

export function hasIllustration(key?: string | null): boolean {
  return !!key && key in ART;
}

export function illustrationSource(key?: string | null): number {
  return (key && ART[key]) || FALLBACK;
}

export function Illustration({
  name,
  size = 44,
  style,
}: {
  name?: string | null;
  size?: number;
  style?: StyleProp<ImageStyle>;
}) {
  const px = ms(size);
  return (
    <Image
      source={illustrationSource(name)}
      style={[{ width: px, height: px }, style]}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}
