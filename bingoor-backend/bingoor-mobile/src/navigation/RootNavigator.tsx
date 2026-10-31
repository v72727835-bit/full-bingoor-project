import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { FadeSlide, Pulse } from '../components/anim';

const LOGO = require('../assets/logo-mark.png');
import { useAuth } from '../context/AuthContext';
import RiderHome from '../screens/RiderHome';
import LoginScreen from '../screens/LoginScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import { colors } from '../theme';

export type AuthStackParamList = { Login: undefined; ForgotPassword: undefined };
export type AppStackParamList = { RiderHome: undefined };

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();
const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.background, primary: colors.primary } };

function Splash() {
  return (
    <View style={styles.splash}>
      <FadeSlide>
        <Pulse style={styles.splashLogo}><Image source={LOGO} style={styles.splashLogoImg} /></Pulse>
      </FadeSlide>
      <FadeSlide delay={120}><Text style={styles.brand}>Bingoor Rider</Text></FadeSlide>
      <FadeSlide delay={220}><Text style={styles.splashTag}>Deliver happiness, earn every ride</Text></FadeSlide>
      <ActivityIndicator color={colors.primary} style={{ marginTop: 22 }} />
    </View>
  );
}

export default function RootNavigator() {
  const { user, initializing } = useAuth();
  if (initializing) return <Splash />;
  return <NavigationContainer theme={navTheme}>
    {user?.role === 'rider' ? <AppStack.Navigator screenOptions={{ headerShown: false }}><AppStack.Screen name="RiderHome" component={RiderHome} /></AppStack.Navigator> : <AuthStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}><AuthStack.Screen name="Login" component={LoginScreen} /><AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} /></AuthStack.Navigator>}
  </NavigationContainer>;
}

const styles = StyleSheet.create({ splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }, splashLogo: { width: 92, height: 92, borderRadius: 26, backgroundColor: '#1F2937', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }, splashLogoImg: { width: 62, height: 62, borderRadius: 16 }, brand: { fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: 0.3, textAlign: 'center' }, splashTag: { color: colors.muted, fontSize: 13.5, marginTop: 6, textAlign: 'center' } });