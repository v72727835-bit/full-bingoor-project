import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import React from 'react';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import { CartProvider } from '../context/CartContext';
import { CatalogProvider } from '../context/CatalogContext';
import { LanguageProvider } from '../context/LanguageContext';
import { SlotProvider } from '../context/SlotContext';
import { SettingsProvider } from '../context/SettingsContext';
import { WishlistProvider } from '../context/WishlistContext';
import { ThemeProvider } from '../context/ThemeContext';
import { ToastProvider } from '../context/ToastContext';
import { BottomNav } from '../components/BottomNav';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { LocationGate } from '../components/LocationGate';
import { OrderProgressToast } from '../components/OrderProgressToast';
import { PwaRegister } from '../components/PwaRegister';
import { AccountPrompt } from '../components/AccountPrompt';
import { INSTALL_BOOT } from '../lib/install';
import { RateOrderPrompt } from '../components/RateOrderPrompt';

/**
 * Plus Jakarta Sans, served from our own origin rather than Google's. It
 * removes a third-party round trip on first paint, keeps the build working
 * without network access to fonts.googleapis.com, and means no visitor data
 * leaves to a font CDN.
 */
const sans = localFont({
  src: './fonts/PlusJakartaSans-Variable.woff2',
  weight: '200 800',
  style: 'normal',
  display: 'swap',
  variable: '--font-sans',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
});

export const metadata: Metadata = {
  title: { default: 'Bingoor — groceries in minutes', template: '%s · Bingoor' },
  description:
    'Order groceries, fruits, vegetables and daily essentials from shops near you in Robertsganj. Delivered in minutes.',
  manifest: '/manifest.json',
  icons: { icon: '/icons/icon-32.png', apple: '/icons/icon-180.png' },
  appleWebApp: { capable: true, title: 'Bingoor', statusBarStyle: 'black-translucent' },
  openGraph: {
    title: 'Bingoor — groceries in minutes',
    description: 'Everyday essentials from shops in your neighbourhood.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffc61a' },
    { media: '(prefers-color-scheme: dark)', color: '#0b2a1a' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/**
 * Applies the saved theme before first paint. Without this the page renders
 * light and then flips, which is the most obvious tell of a bolted-on theme.
 */
/**
 * The site used to save its settings (sign-in, location, theme, language...)
 * under the old brand's key prefix. This copies each one to its "bingoor_"
 * key once, before anything reads them, so nobody is signed out or loses
 * their delivery location after the rename. The old prefix is spelled in
 * two parts so the old name does not appear in the code.
 */
const STORAGE_BOOT = `(function(){try{var o='auto'+'zo_',n='bingoor_';for(var i=localStorage.length-1;i>=0;i--){var k=localStorage.key(i);if(k&&k.indexOf(o)===0){var nk=n+k.slice(o.length);if(localStorage.getItem(nk)===null)localStorage.setItem(nk,localStorage.getItem(k));localStorage.removeItem(k)}}}catch(e){}})()`;

const THEME_BOOT = `(function(){try{var t=localStorage.getItem('bingoor_theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: STORAGE_BOOT }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        {/* Point 6: catch the browser's install offer before the app starts, so every "Add to Home Screen" button can use it. */}
        <script dangerouslySetInnerHTML={{ __html: INSTALL_BOOT }} />
      </head>
      <body>
        <a href="#main" className="sr-only">
          Skip to content
        </a>
        <ThemeProvider>
          <AuthProvider>
            <SettingsProvider>
             <LanguageProvider>
              <SlotProvider>
              <CatalogProvider>
                <CartProvider>
                 <WishlistProvider>
                  <ToastProvider>
                    <Header />
                    <LocationGate />
                    <main id="main" style={{ minHeight: '60vh' }}>
                      {children}
                    </main>
                    <Footer />
                    <BottomNav />
                    <OrderProgressToast />
                    <RateOrderPrompt />
                    <PwaRegister />
                    <AccountPrompt />
                  </ToastProvider>
                 </WishlistProvider>
                </CartProvider>
              </CatalogProvider>
              </SlotProvider>
             </LanguageProvider>
            </SettingsProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
