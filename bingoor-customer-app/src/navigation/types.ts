import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { Address, ProductSort } from '../types';

export type AuthStackParamList = {
  Onboarding: undefined;
  Login: { phone?: string } | undefined;
  Signup: undefined;
  ForgotPassword: undefined;
};

export type AppStackParamList = {
  MainTabs: undefined;
  Search: { initialQuery?: string } | undefined;
  ProductList: {
    title: string;
    category?: string;
    shop?: string;
    q?: string;
    sort?: ProductSort;
  };
  CategoryBrowse: { slug: string; name?: string; childSlug?: string };
  ProductDetail: { id: string; name?: string };
  ShopDetail: { id: string; name?: string };
  Checkout: undefined;
  AddressList: { pickMode?: boolean } | undefined;
  AddressForm: { address?: Address } | undefined;
  OrderSuccess: { orderIds: string[]; grandTotal: number };
  OrderDetail: { id: string };
  Wishlist: undefined;
  Support: undefined;
  EditProfile: undefined;
  ChangePassword: undefined;
  DeleteAccount: undefined;
};

export type AppNav = NativeStackNavigationProp<AppStackParamList>;
export type AuthNav = NativeStackNavigationProp<AuthStackParamList>;

export type AppRoute<T extends keyof AppStackParamList> = RouteProp<AppStackParamList, T>;

export type TabName = 'home' | 'festival' | 'browse' | 'cart' | 'orders' | 'profile';
