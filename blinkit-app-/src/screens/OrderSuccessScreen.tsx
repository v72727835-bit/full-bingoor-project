import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useRef } from 'react';
import { Animated, BackHandler, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTabs } from '../navigation/TabsContext';
import type { AppNav, AppRoute } from '../navigation/types';
import { colors, currency, gutter, ms, radius, space, themed } from '../theme';
import { Button } from '../ui/Button';
import { LogoMark } from '../ui/Logo';
import { Txt } from '../ui/Text';

export function OrderSuccessScreen() {
  const navigation = useNavigation<AppNav>();
  const { params } = useRoute<AppRoute<'OrderSuccess'>>();
  const { goToTab } = useTabs();

  const pop = useRef(new Animated.Value(0)).current;
  const count = params.orderIds.length;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(120),
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }),
    ]).start();
  }, [pop]);

  const goHome = () => {
    navigation.navigate('MainTabs');
    goToTab('home');
  };

  // Hardware back should land on Home, never back on the checkout form.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goHome();
      return true;
    });
    return () => sub.remove();
  });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top', 'bottom']} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View
            style={[
              styles.tickWrap,
              { transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }], opacity: pop },
            ]}
          >
            <View style={styles.tickRing}>
              <Ionicons name="checkmark" size={ms(52)} color={colors.brand} />
            </View>
          </Animated.View>

          <Txt variant="display" tone="onBrand" center style={styles.title}>
            Order placed
          </Txt>
          <Txt variant="bodyLg" center style={styles.subtitle}>
            {count === 1
              ? 'Your order is on its way to the shop. We will tell you as soon as they accept it.'
              : `Your basket had items from ${count} shops, so we created ${count} separate orders. Each one is tracked on its own.`}
          </Txt>

          <View style={styles.receipt}>
            <View style={styles.receiptRow}>
              <Txt variant="body" tone="muted">
                {count === 1 ? 'Order' : 'Orders'}
              </Txt>
              <Txt variant="h4">
                {count} {count === 1 ? 'order' : 'orders'}
              </Txt>
            </View>
            <View style={styles.receiptDivider} />
            <View style={styles.receiptRow}>
              <Txt variant="body" tone="muted">
                Amount payable
              </Txt>
              <Txt variant="h2">{currency(params.grandTotal)}</Txt>
            </View>

            <View style={styles.eta}>
              <Ionicons name="time-outline" size={ms(16)} color={colors.brand} />
              <Txt variant="labelSm" tone="brand" style={styles.etaText}>
                Usually delivered the same day
              </Txt>
            </View>
          </View>

          <LogoMark size={28} style={styles.mark} />
          <Txt variant="caption" center style={styles.thanks}>
            Thank you for shopping local.
          </Txt>
        </ScrollView>

        <View style={styles.actions}>
          <Button
            label={count === 1 ? 'Track my order' : 'Track my orders'}
            icon="navigate-outline"
            variant="onBrand"
            size="lg"
            onPress={() => {
              if (count === 1) {
                navigation.replace('OrderDetail', { id: params.orderIds[0] });
              } else {
                navigation.navigate('MainTabs');
                goToTab('orders');
              }
            }}
          />
          <Button label="Back to home" variant="ghostOnBrand" size="lg" onPress={goHome} style={styles.secondary} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = themed(({ c }) => ({
  root: { flex: 1, backgroundColor: c.headerFrom },
  flex: { flex: 1 },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: gutter, paddingVertical: space.xxl },

  tickWrap: { marginBottom: space.xxl },
  tickRing: {
    width: ms(104),
    height: ms(104),
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { marginBottom: space.md },
  subtitle: { color: 'rgba(255,255,255,0.8)', maxWidth: ms(340) },

  receipt: {
    alignSelf: 'stretch',
    marginTop: space.xxl,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: c.surface,
  },
  receiptRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  receiptDivider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginVertical: space.md },
  eta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  etaText: { marginLeft: space.xs },

  mark: { opacity: 0.6, marginTop: space.xxxl },
  thanks: { color: 'rgba(255,255,255,0.6)', marginTop: space.sm },

  actions: { paddingHorizontal: gutter, paddingBottom: space.md },
  secondary: { marginTop: space.sm },}));
