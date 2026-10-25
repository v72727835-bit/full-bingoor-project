import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Linking, ScrollView, View } from 'react-native';
import type { AppNav } from '../navigation/types';
import { colors, gutter, ms, radius, space, themed } from '../theme';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { Banner } from '../ui/Feedback';
import { Screen } from '../ui/Screen';
import { Card } from '../ui/Surface';
import { Txt } from '../ui/Text';
import { useToast } from '../ui/Toast';

const SUPPORT_EMAIL = 'info@bingoor.com';

/** "Contact us" - the same wording as bingoor.com/contact. */
export function ContactScreen() {
  const navigation = useNavigation<AppNav>();
  const toast = useToast();

  const email = () =>
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => toast.show(`Write to us at ${SUPPORT_EMAIL}`));

  return (
    <Screen>
      <AppHeader title="Contact us" subtitle="We are here to help with orders, deliveries and anything else" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Banner
          tone="danger"
          style={styles.banner}
          message="Be cautious: A Bingoor representative would never request bank information, such as account number, UPI pin, CVV, OTP, or card data, from strangers posing as Bingoor."
        />
        <Banner
          tone="info"
          icon="call-outline"
          style={styles.banner}
          message="Watch out for phony numbers! Please only use our in-app assistance, where we are available, if you have any problems."
        />

        <Button
          label="Chat with customer care"
          icon="chatbubbles-outline"
          block
          onPress={() => navigation.navigate('Support')}
          style={styles.banner}
        />

        <Card style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.icon}>
              <Ionicons name="business-outline" size={ms(18)} color={colors.brand} />
            </View>
            <Txt variant="h4">Registered office</Txt>
          </View>
          <Txt variant="body" tone="body">
            AUAXI AID{'\n'}First floor, 35 A, Shyam Nagar 3rd,{'\n'}Mangalam Ananda Road,{'\n'}Jaipur, Rajasthan – 302029
          </Txt>
          <Txt variant="label" tone="muted" style={styles.gst}>
            GSTIN: 08BPNPC9732A1ZZ
          </Txt>
        </Card>

        <Card style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.icon}>
              <Ionicons name="mail-outline" size={ms(18)} color={colors.brand} />
            </View>
            <Txt variant="h4">Write to us</Txt>
          </View>
          <Txt variant="body" tone="body" style={styles.para}>
            Email us and our support team will get back to you. For anything about a live order, in-app assistance is
            the fastest route.
          </Txt>
          <Button label={SUPPORT_EMAIL} variant="tonal" icon="mail-outline" block onPress={email} />
        </Card>

        <Txt variant="h3" style={styles.heading}>
          #1 instant delivery service in India
        </Txt>
        <Txt variant="body" tone="body" style={styles.para}>
          Get anything delivered right to your door while you shop on the move. Purchase a wide range of goods,
          including groceries, fresh produce, cakes and baked goods, meats and seafood, cosmetics, cell phones and
          accessories, electronics, baby care products, and much more. We bring everything to your home as quickly and
          safely as we can.
        </Txt>

        <Txt variant="h3" style={styles.heading}>
          A single app for all your daily needs
        </Txt>
        <Txt variant="body" tone="body" style={styles.para}>
          With just a tap, you can order thousands of products from your local stores, including milk, eggs, bread,
          cooking oil, ghee, atta, rice, fresh fruits and vegetables, spices, chocolates, chips, biscuits, noodles, cold
          drinks, shampoos, soaps, body wash, pet food, nappies, electronics, and much more.
        </Txt>
      </ScrollView>
    </Screen>
  );
}

const styles = themed(({ c }) => ({
  content: { paddingHorizontal: gutter, paddingTop: space.lg, paddingBottom: ms(48) },
  banner: { marginBottom: space.md },
  card: { marginBottom: space.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space.sm },
  icon: {
    width: ms(34),
    height: ms(34),
    borderRadius: radius.pill,
    backgroundColor: c.brandSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.sm,
  },
  gst: { marginTop: space.sm },
  heading: { marginTop: space.lg, marginBottom: space.sm },
  para: { marginBottom: space.sm },
}));
