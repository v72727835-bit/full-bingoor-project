import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, ms, radius, space, themed } from '../theme';
import { tapTab } from '../utils/haptics';
import { Txt } from '../ui/Text';
import type { IconName } from '../ui/Button';
import type { TabName } from './types';

export interface TabDef {
  name: TabName;
  label: string;
  icon: IconName;
  iconActive: IconName;
  badge?: number;
}

interface Props {
  tabs: TabDef[];
  active: TabName;
  onSelect: (name: TabName) => void;
}

/**
 * Hand-built tab bar.
 *
 * Deliberately not @react-navigation/bottom-tabs: this app needs a cart count
 * bubble, an active pill behind the icon and full control of the safe-area
 * padding, and all of that is less code here than fighting the library's theme.
 */
export function TabBar({ tabs, active, onSelect }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
      {tabs.map((tab) => {
        const on = tab.name === active;
        return (
          <Pressable
            key={tab.name}
            onPress={() => {
              tapTab();
              onSelect(tab.name);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={tab.badge ? `${tab.label}, ${tab.badge} items` : tab.label}
            style={styles.tab}
            android_ripple={{ color: colors.brandSurfaceStrong, borderless: true, radius: ms(34) }}
          >
            <View style={[styles.iconWrap, on && styles.iconWrapActive]}>
              <Ionicons
                name={(on ? tab.iconActive : tab.icon) as never}
                size={ms(22)}
                color={on ? colors.brand : colors.inkMuted}
              />
              {tab.badge ? (
                <View style={styles.badge}>
                  <Txt style={styles.badgeText}>{tab.badge > 99 ? '99+' : tab.badge}</Txt>
                </View>
              ) : null}
            </View>
            <Txt
              variant="caption"
              numberOfLines={1}
              style={[styles.label, { color: on ? colors.brand : colors.inkMuted, fontWeight: on ? '700' : '600' }]}
            >
              {tab.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = themed(({ c }) => ({
  bar: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    paddingTop: ms(6),
    ...Platform.select({
      ios: { shadowColor: c.shadow, shadowOffset: { width: 0, height: -1 }, shadowRadius: 6, shadowOpacity: 0.04 },
      android: { elevation: 8 },
      default: {},
    }),
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xxs },
  iconWrap: {
    minWidth: ms(56),
    height: ms(28),
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: c.brandSurface },
  label: { marginTop: ms(3), textAlign: 'center' },
  badge: {
    position: 'absolute',
    top: ms(-2),
    right: ms(9),
    minWidth: ms(17),
    height: ms(17),
    paddingHorizontal: ms(4),
    borderRadius: radius.pill,
    backgroundColor: c.brand,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: c.surface,
  },
  badgeText: { color: '#FFFFFF', fontSize: ms(9), lineHeight: ms(12), fontWeight: '800' },}));
