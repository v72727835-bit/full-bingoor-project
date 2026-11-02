import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CartDock } from '../components/CartDock';
import { OrderProgressPopup } from '../components/OrderProgressPopup';
import { useCart } from '../context/CartContext';
import { BrowseScreen } from '../screens/BrowseScreen';
import { CartScreen } from '../screens/CartScreen';
import { FestivalScreen } from '../screens/FestivalScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { OrdersScreen } from '../screens/OrdersScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { usePublicSettingsQuery } from '../store/catalogApi';
import { themed } from '../theme';
import { TabBar, TabDef } from './TabBar';
import { useAutoLocation } from '../utils/useAutoLocation';
import { useTabs } from './TabsContext';

/**
 * Tab host.
 *
 * All five tabs stay mounted and inactive ones are hidden rather than
 * unmounted, so scroll position and loaded lists survive a tab switch - the
 * difference between an app that feels instant and one that reloads constantly.
 */
export function MainTabs() {
  const { active, goToTab } = useTabs();
  const { cart } = useCart();
  const [barHeight, setBarHeight] = useState(0);
  const { data: settings } = usePublicSettingsQuery();
  const festival = settings?.festival.enabled ? settings.festival.name : null;
  // No pinned address yet: use where the phone is, so the right shops show up.
  useAutoLocation();

  // The festival tab takes the second slot while the admin has it switched on,
  // and Orders steps aside rather than crowding a sixth tab onto the bar.
  const tabs = useMemo<TabDef[]>(
    () => [
      { name: 'home', label: 'Home', icon: 'home-outline', iconActive: 'home' },
      ...(festival
        ? [{ name: 'festival' as const, label: festival, icon: 'gift-outline', iconActive: 'gift' }]
        : []),
      { name: 'browse', label: 'Categories', icon: 'grid-outline', iconActive: 'grid' },
      { name: 'cart', label: 'Cart', icon: 'cart-outline', iconActive: 'cart', badge: cart.itemCount },
      ...(festival ? [] : [{ name: 'orders' as const, label: 'Orders', icon: 'receipt-outline', iconActive: 'receipt' }]),
      { name: 'profile', label: 'Account', icon: 'person-outline', iconActive: 'person' },
    ],
    [cart.itemCount, festival],
  );

  return (
    <>
      <View style={styles.root}>
        <Pane visible={active === 'home'}>
          <HomeScreen active={active === 'home'} />
        </Pane>
        <Pane visible={active === 'festival'}>
          <FestivalScreen active={active === 'festival'} />
        </Pane>
        <Pane visible={active === 'browse'}>
          <BrowseScreen active={active === 'browse'} />
        </Pane>
        <Pane visible={active === 'cart'}>
          <CartScreen active={active === 'cart'} />
        </Pane>
        <Pane visible={active === 'orders'}>
          <OrdersScreen active={active === 'orders'} />
        </Pane>
        <Pane visible={active === 'profile'}>
          <ProfileScreen active={active === 'profile'} />
        </Pane>
      </View>
      <View onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}>
        <OrderProgressPopup hidden={active !== 'home' && active !== 'browse' && active !== 'festival'} />
        <TabBar tabs={tabs} active={active} onSelect={goToTab} />
      </View>
      {/* Positioned against the whole screen rather than hung off the tab bar:
          Android does not deliver taps to a child drawn outside its parent. */}
      <CartDock bottom={barHeight} hidden={active === 'cart'} onPress={() => goToTab('cart')} />
    </>
  );
}

function Pane({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <View
      style={[StyleSheet.absoluteFill, !visible && styles.hidden]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    >
      {children}
    </View>
  );
}

const styles = themed(({ c }) => ({
  root: { flex: 1, backgroundColor: c.surfaceSunken },
  hidden: { display: 'none' },}));
