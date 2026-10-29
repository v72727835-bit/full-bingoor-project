import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as StoreProvider } from 'react-redux';
import { PushRegistrar } from './src/components/PushRegistrar';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { WishlistProvider } from './src/context/WishlistContext';
import RootNavigator from './src/navigation/RootNavigator';
import { store } from './src/store';
import { loadLang } from './src/store/language';
import { TabsProvider } from './src/navigation/TabsContext';
import { ThemeProvider, useTheme } from './src/theme';
import { ToastProvider } from './src/ui/Toast';

/**
 * Provider order matters here:
 *   Store -> Theme -> SafeArea -> Toast -> Auth -> Cart -> Wishlist -> Tabs
 * The Redux store wraps everything so any screen can read cached catalogue
 * data. Theme is next because everything below it paints. Toast sits above Auth
 * because the cart and wishlist raise toasts, and both of those need the
 * signed-in user to know whose data to load.
 */
// The saved English / Hindi choice, read before the first screen paints names.
loadLang();

export default function App() {
  return (
    <StoreProvider store={store}>
      <ThemeProvider>
        <SafeAreaProvider>
          <ThemedStatusBar />
          <ToastProvider>
            <AuthProvider>
              <CartProvider>
                <WishlistProvider>
                  <TabsProvider>
                    <RootNavigator />
                    <PushRegistrar />
                  </TabsProvider>
                </WishlistProvider>
              </CartProvider>
            </AuthProvider>
          </ToastProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </StoreProvider>
  );
}

/**
 * The status bar sits on the brand band at the top of Home and Categories,
 * which is dark in both themes - so its icons are light either way.
 */
function ThemedStatusBar() {
  useTheme();
  return <StatusBar barStyle="light-content" />;
}
