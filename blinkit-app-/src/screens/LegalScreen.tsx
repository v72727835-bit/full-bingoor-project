import { RouteProp, useRoute } from '@react-navigation/native';
import React from 'react';
import { ScrollView, View } from 'react-native';
import cancellation from '../content/cancellation.json';
import privacy from '../content/privacy.json';
import terms from '../content/terms.json';
import type { LegalDoc } from '../navigation/types';
import { gutter, ms, space, themed } from '../theme';
import { AppHeader } from '../ui/AppHeader';
import { Screen } from '../ui/Screen';
import { Txt } from '../ui/Text';

interface LegalItem {
  kind: 'p' | 'li';
  text: string;
}

interface LegalSection {
  heading: string | null;
  items: LegalItem[];
}

/**
 * The same policy text the website shows (copied from bingoor-web/src/content),
 * so the wording stays exactly as it was supplied and only the layout lives here.
 */
const DOCS: Record<LegalDoc, { title: string; updated?: string; sections: LegalSection[] }> = {
  privacy: {
    title: 'Privacy Policy',
    updated: 'Last updated in January 2025',
    sections: privacy as LegalSection[],
  },
  terms: {
    title: 'Terms & Conditions',
    updated: 'Updated in January 2026',
    // The first block only repeats the title and the date shown above.
    sections: (terms as LegalSection[]).slice(1),
  },
  cancellation: {
    title: 'Cancellation Policy',
    sections: (cancellation as LegalSection[]).map((s, i) => (i === 0 ? { ...s, heading: null } : s)),
  },
};

export function LegalScreen() {
  const { params } = useRoute<RouteProp<{ Legal: { doc: LegalDoc } }, 'Legal'>>();
  const doc = DOCS[params.doc];

  return (
    <Screen>
      <AppHeader title={doc.title} subtitle={doc.updated} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {doc.sections.map((section, i) => (
          <View key={i} style={styles.section}>
            {section.heading ? (
              <Txt variant="h3" style={styles.heading}>
                {section.heading}
              </Txt>
            ) : null}
            {section.items.map((item, j) =>
              item.kind === 'li' ? (
                <View key={j} style={styles.bulletRow}>
                  <Txt variant="body" tone="body" style={styles.bullet}>
                    {'•'}
                  </Txt>
                  <Txt variant="body" tone="body" style={styles.bulletText}>
                    {item.text}
                  </Txt>
                </View>
              ) : (
                <Txt key={j} variant="body" tone="body" style={styles.para}>
                  {item.text}
                </Txt>
              ),
            )}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = themed(() => ({
  content: { paddingHorizontal: gutter, paddingTop: space.lg, paddingBottom: ms(48) },
  section: { marginBottom: space.lg },
  heading: { marginBottom: space.sm },
  para: { marginBottom: space.sm },
  bulletRow: { flexDirection: 'row', marginBottom: space.xs },
  bullet: { width: ms(16) },
  bulletText: { flex: 1 },
}));
