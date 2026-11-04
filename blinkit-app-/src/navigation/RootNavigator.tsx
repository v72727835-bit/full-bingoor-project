import { DefaultTheme, NavigationContainer, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { AddressFormScreen } from '../screens/AddressFormScreen';
import { AddressListScreen } from '../screens/AddressListScreen';
import { CategoryBrowseScreen } from '../screens/CategoryBrowseScreen';
import { ChangePasswordScreen } from '../screens/ChangePasswordScreen';
import { DeleteAccountScreen } from '../screens/DeleteAccountScreen';
import { CheckoutScreen } from '../screens/CheckoutScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { OrderDetailScreen } from '../screens/OrderDetailScreen';
import { OrderSuccessScreen } from '../screens/OrderSuccessScreen';
import { ProductDetailScreen } from '../screens/ProductDetailScreen';
import { ProductListScreen } from '../screens/ProductListScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { ShopDetailScreen } from '../screens/ShopDetailScreen';
import { SignupScreen } from '../screens/SignupScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { SplashScreen } from '../screens/SplashScreen';
import { SupportScreen } from '../screens/SupportScreen';
import { WishlistScreen } from '../screens/WishlistScreen';
import { DarkTheme } from '@react-navigation/native';
import { useTheme } from '../theme';
import { WelcomeCredentials } from '../components/WelcomeCredentials';
import { MainTabs } from './MainTabs';
import type { AppStackParamList, AuthStackParamList } from './types';

const AppStack = createNativeStackNavigator<AppStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

/**
 * React Navigation paints the gaps we do not - screen transitions, the space
 * behind a modal - so it gets the same palette rather than its own defaults.
 */
function useNavTheme(): Theme {
  const { c, mode } = useTheme();
  const base = mode === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: mode === 'dark',
    colors: {
      ...base.colors,
      primary: c.brand,
      background: c.surfaceSunken,
      card: c.surface,
      text: c.ink,
      border: c.border,
      notification: c.brand,
    },
  };
}

// Screens draw their own AppHeader, so the native one stays off everywhere.
const screenOptions = { headerShown: false, animation: 'slide_from_right' } as const;

function AuthFlow() {
  return (
    <AuthStack.Navigator screenOptions={screenOptions}>
      <AuthStack.Screen name="Onboarding" component={OnboardingScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
}

function AppFlow() {
  return (
    <AppStack.Navigator screenOptions={screenOptions}>
      <AppStack.Screen name="MainTabs" component={MainTabs} />
      <AppStack.Screen name="Search" component={SearchScreen} options={{ animation: 'fade' }} />
      <AppStack.Screen name="CategoryBrowse" component={CategoryBrowseScreen} />
      <AppStack.Screen name="ProductList" component={ProductListScreen} />
      <AppStack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <AppStack.Screen name="ShopDetail" component={ShopDetailScreen} />
      <AppStack.Screen name="Checkout" component={CheckoutScreen} />
      <AppStack.Screen name="AddressList" component={AddressListScreen} />
      <AppStack.Screen name="AddressForm" component={AddressFormScreen} />
      <AppStack.Screen
        name="OrderSuccess"
        component={OrderSuccessScreen}
        options={{ animation: 'fade', gestureEnabled: false }}
      />
      <AppStack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <AppStack.Screen name="Wishlist" component={WishlistScreen} />
      <AppStack.Screen name="Support" component={SupportScreen} />
      <AppStack.Screen name="EditProfile" component={EditProfileScreen} />
      <AppStack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <AppStack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
    </AppStack.Navigator>
  );
}

export default function RootNavigator() {
  const { user, initializing } = useAuth();
  const navTheme = useNavTheme();

  if (initializing) return <SplashScreen />;

  return (
    <NavigationContainer theme={navTheme}>
      {user ? <AppFlow /> : <AuthFlow />}
      <WelcomeCredentials />
    </NavigationContainer>
  );
}
