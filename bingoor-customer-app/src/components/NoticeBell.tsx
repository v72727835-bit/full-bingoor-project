import Icon from '@react-native-vector-icons/ionicons/static';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useNoticesQuery } from '../store/catalogApi';
import { gutter, hitSlop, ms, radius, space, themed, useTheme } from '../theme';
import { Txt } from '../ui/Text';

/**
 * Announcements the admin broadcasts.
 *
 * Which ones have been read is kept in memory rather than on disk: this is a
 * "there is news" marker, not a record, and a fresh launch showing the count
 * again is better than wiring up another native store for it.
 */
let lastSeen = '';

export function NoticeBell({ onDark = false }: { onDark?: boolean }) {
  const { c } = useTheme();
  const { data: notices = [] } = useNoticesQuery(undefined, { pollingInterval: 120_000 });
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(lastSeen);

  const unread = notices.filter((n) => n.createdAt > seen).length;

  const show = () => {
    setOpen(true);
    if (notices[0]) {
      lastSeen = notices[0].createdAt;
      setSeen(lastSeen);
    }
  };

  return (
    <>
      <Pressable
        onPress={show}
        hitSlop={hitSlop}
        accessibilityRole="button"
        accessibilityLabel={unread ? `${unread} new notifications` : 'Notifications'}
        style={({ pressed }) => [styles.btn, onDark && styles.btnOnDark, pressed && { opacity: 0.8 }]}
      >
        <Icon name="notifications-outline" size={ms(20)} color={onDark ? c.onHeader : c.ink} />
        {unread > 0 ? (
          <View style={styles.count}>
            <Txt variant="caption" style={styles.countText}>
              {unread > 9 ? '9+' : unread}
            </Txt>
          </View>
        ) : null}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <View style={styles.sheetHead}>
              <Txt variant="h3">Notifications</Txt>
              <Pressable onPress={() => setOpen(false)} hitSlop={hitSlop} accessibilityLabel="Close">
                <Icon name="close" size={ms(22)} color={c.inkMuted} />
              </Pressable>
            </View>

            {notices.length === 0 ? (
              <Txt variant="bodySm" tone="muted" style={styles.empty}>
                Nothing new right now.
              </Txt>
            ) : (
              <ScrollView style={styles.list}>
                {notices.map((n) => (
                  <View key={n._id} style={styles.item}>
                    <Txt variant="bodySm">{n.message}</Txt>
                    <Txt variant="caption" tone="faint" style={styles.when}>
                      {new Date(n.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </Txt>
                  </View>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = themed(({ c }) => ({
  btn: {
    width: ms(38),
    height: ms(38),
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
  },
  btnOnDark: { backgroundColor: 'rgba(255,255,255,0.16)' },
  count: {
    position: 'absolute',
    top: ms(2),
    right: ms(2),
    minWidth: ms(16),
    height: ms(16),
    paddingHorizontal: ms(3),
    borderRadius: radius.pill,
    backgroundColor: c.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { color: '#FFFFFF', fontSize: ms(9), lineHeight: ms(12), fontWeight: '800' },

  scrim: { flex: 1, backgroundColor: 'rgba(12,6,10,0.5)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '70%',
    paddingHorizontal: gutter,
    paddingTop: space.lg,
    paddingBottom: space.xxl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: c.surface,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  empty: { paddingVertical: space.lg },
  list: { flexGrow: 0 },
  item: { paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: c.border },
  when: { marginTop: ms(4) },}));
