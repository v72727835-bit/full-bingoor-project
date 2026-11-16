import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gutter, ms, radius, space } from '../theme';
import type { IconName } from './Button';
import { Txt } from './Text';

type ToastTone = 'success' | 'error' | 'info';

interface ToastOptions {
  tone?: ToastTone;
  /** Optional inline action, e.g. "View cart". */
  action?: { label: string; onPress: () => void };
}

interface ToastState extends ToastOptions {
  id: number;
  message: string;
}

interface ToastApi {
  show: (message: string, options?: ToastOptions) => void;
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastApi | undefined>(undefined);

/* Toasts stay dark in both themes. A snackbar is an overlay, not part of the
 * page, and a light one on a light page reads as a broken dialog. */
const SKIN: Record<ToastTone, { bg: string; icon: IconName; action: string }> = {
  success: { bg: '#12261A', icon: 'checkmark-circle', action: '#FFD23F' },
  error: { bg: '#3A1216', icon: 'alert-circle', action: '#FFB4B4' },
  info: { bg: '#18221C', icon: 'information-circle', action: '#FFD23F' },
};

/**
 * Lightweight snackbar. Used instead of Alert for routine confirmations -
 * a modal popup for "Added to cart" is the fastest way to make an app feel
 * amateur, and it blocks the next tap.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const seq = useRef(0);

  const hide = useCallback(() => {
    Animated.timing(anim, { toValue: 0, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(
      ({ finished }) => finished && setToast(null),
    );
  }, [anim]);

  const show = useCallback(
    (message: string, options: ToastOptions = {}) => {
      if (timer.current) clearTimeout(timer.current);
      seq.current += 1;
      setToast({ id: seq.current, message, ...options });
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      timer.current = setTimeout(hide, options.action ? 4200 : 2600);
    },
    [anim, hide],
  );

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m, o) => show(m, { ...o, tone: 'success' }),
      error: (m, o) => show(m, { ...o, tone: 'error' }),
    }),
    [show],
  );

  const skin = SKIN[toast?.tone ?? 'info'];

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.wrap,
            { bottom: insets.bottom + ms(72) },
            {
              opacity: anim,
              transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
            },
          ]}
        >
          <View style={[styles.toast, { backgroundColor: skin.bg }]}>
            <Ionicons name={skin.icon as never} size={ms(19)} color="#FFFFFF" style={styles.icon} />
            <Txt variant="bodySm" tone="onBrand" style={styles.text}>
              {toast.message}
            </Txt>
            {toast.action ? (
              <Pressable
                onPress={() => {
                  hide();
                  toast.action?.onPress();
                }}
                hitSlop={8}
                accessibilityRole="button"
                style={styles.action}
              >
                <Txt variant="label" style={{ color: skin.action }}>
                  {toast.action.label}
                </Txt>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: gutter,
    right: gutter,
    zIndex: 1000,
    ...Platform.select({ android: { elevation: 12 }, default: {} }),
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    ...Platform.select({
      android: { elevation: 12 },
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowRadius: 24, shadowOpacity: 0.3 },
    }),
  },
  icon: { marginRight: space.md },
  text: { flex: 1 },
  action: { marginLeft: space.md, paddingVertical: space.xxs },
});
