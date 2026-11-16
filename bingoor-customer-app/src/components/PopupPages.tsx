import Icon from '@react-native-vector-icons/ionicons/static';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { Image, Linking, Modal, Pressable, View, useWindowDimensions } from 'react-native';
import { usePublicSettingsQuery } from '../store/catalogApi';
import type { AppNav } from '../navigation/types';
import { hitSlop, ms, radius, themed } from '../theme';

/**
 * Point 30: full-screen promo pages the admin uploads. One appears on a timer
 * (every `intervalSeconds`, default 3.5 min), a different page each time, and
 * closes with the cross. Turned on/off from the admin panel.
 */
export function PopupPages() {
  const { data: settings } = usePublicSettingsQuery();
  const nav = useNavigation<AppNav>();
  const { width, height } = useWindowDimensions();
  const popup = settings?.popup;
  const pages = (popup?.enabled ? popup.pages : [])?.filter((p) => p.image) ?? [];

  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!pages.length) {
      setVisible(false);
      return;
    }
    const every = Math.max(15, popup?.intervalSeconds ?? 210) * 1000;
    const schedule = () => {
      timer.current = setTimeout(() => setVisible(true), every);
    };
    schedule();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // Re-arm when the page set or the interval changes.
  }, [pages.length, popup?.intervalSeconds]);

  const close = () => {
    setVisible(false);
    setIndex((i) => (pages.length ? (i + 1) % pages.length : 0));
    if (timer.current) clearTimeout(timer.current);
    const every = Math.max(15, popup?.intervalSeconds ?? 210) * 1000;
    timer.current = setTimeout(() => setVisible(true), every);
  };

  if (!visible || !pages.length) return null;
  const page = pages[Math.min(index, pages.length - 1)];

  const open = () => {
    const link = page.link;
    if (!link) return;
    close();
    if (/^https?:\/\//i.test(link)) {
      void Linking.openURL(link).catch(() => undefined);
    } else if (link.startsWith('/categories/')) {
      nav.navigate('CategoryBrowse', { slug: link.replace('/categories/', ''), name: 'Offers' });
    }
  };

  // One fixed 3:4 frame for every promo (big or small upload), with the cross on the
  // frame's own corner - it no longer floats far above a small banner.
  const frameW = Math.min(width - ms(48), 400, (height * 0.78 * 3) / 4);
  const frameH = (frameW * 4) / 3;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={{ width: frameW, height: frameH }}>
          <Pressable style={styles.fill} onPress={open} accessibilityRole="imagebutton" accessibilityLabel="Promotion">
            <Image source={{ uri: page.image }} style={{ width: frameW, height: frameH, borderRadius: radius.lg, backgroundColor: '#111' }} resizeMode="cover" />
          </Pressable>
          <Pressable onPress={close} hitSlop={hitSlop} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
            <Icon name="close" size={ms(20)} color="#fff" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = themed(() => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', alignItems: 'center', justifyContent: 'center' },
  fill: { alignItems: 'center', justifyContent: 'center' },
  close: {
    position: 'absolute',
    top: ms(8),
    right: ms(8),
    width: ms(38),
    height: ms(38),
    borderRadius: ms(19),
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
