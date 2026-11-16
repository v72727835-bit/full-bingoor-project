import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fillParent, gutter, hitSlop, ms, radius, screen, space, useStyles, useTheme } from '../theme';
import { Txt } from './Text';

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Pinned footer, typically the confirm button. */
  footer?: React.ReactNode;
}

/** Bottom sheet built on the native Modal - no extra dependency needed. */
export function Sheet({ visible, onClose, title, children, footer }: Props) {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const styles = useStyles(({ c: p }) => ({
    root: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...fillParent, backgroundColor: p.overlay },
    sheet: {
      backgroundColor: p.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      maxHeight: screen.height * 0.86,
    },
    grabber: {
      width: ms(38),
      height: ms(4),
      borderRadius: radius.pill,
      backgroundColor: p.borderStrong,
      alignSelf: 'center',
      marginTop: space.md,
    },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: gutter, paddingTop: space.lg, paddingBottom: space.md },
    title: { flex: 1, paddingRight: space.md },
    body: { flexGrow: 0 },
    bodyContent: { paddingHorizontal: gutter, paddingBottom: space.lg },
    footer: { paddingHorizontal: gutter, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.border },
  }));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.md }]}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Txt variant="h2" style={styles.title} numberOfLines={2}>
              {title}
            </Txt>
            <Pressable onPress={onClose} hitSlop={hitSlop} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={ms(23)} color={c.inkMuted} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

