"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import Layout from './components/Layout';
import { CenterSpinner } from './components/ui';
import { useAuth } from './context/AuthContext';
import { StatsProvider } from './context/StatsContext';
import { Navigate } from './navigation';
import dynamic from 'next/dynamic';

const AnalyticsPage = dynamic(() => import('./screens/AnalyticsPage'), { ssr: false });
const BannersPage = dynamic(() => import('./screens/BannersPage'), { ssr: false });
const MediaPage = dynamic(() => import('./screens/MediaPage'), { ssr: false });
const NoticesPage = dynamic(() => import('./screens/NoticesPage'), { ssr: false });
const RidersPage = dynamic(() => import('./screens/RidersPage'), { ssr: false });
const PayoutsPage = dynamic(() => import('./screens/PayoutsPage'), { ssr: false });
const RiderProfilePage = dynamic(() => import('./screens/RiderProfilePage'), { ssr: false });
const SettingsStorePage = dynamic(() => import('./screens/SettingsStorePage'), { ssr: false });
const SupportPage = dynamic(() => import('./screens/SupportPage'), { ssr: false });
const CategoriesPage = dynamic(() => import('./screens/CategoriesPage'), { ssr: false });
const DashboardPage = dynamic(() => import('./screens/DashboardPage'), { ssr: false });
const InventoryPage = dynamic(() => import('./screens/InventoryPage'), { ssr: false });
const LoginPage = dynamic(() => import('./screens/LoginPage'), { ssr: false });
const OffersPage = dynamic(() => import('./screens/OffersPage'), { ssr: false });
const OrdersPage = dynamic(() => import('./screens/OrdersPage'), { ssr: false });
const ProductsPage = dynamic(() => import('./screens/ProductsPage'), { ssr: false });
const SettingsPage = dynamic(() => import('./screens/SettingsPage'), { ssr: false });
const ShopsPage = dynamic(() => import('./screens/ShopsPage'), { ssr: false });
const DeliveryPricingPage = dynamic(() => import('./screens/DeliveryPricingPage'), { ssr: false });
const BlogPage = dynamic(() => import('./screens/BlogPage'), { ssr: false });
const ProductSellersPage = dynamic(() => import('./screens/ProductSellersPage'), { ssr: false });
const WarehouseRequestsPage = dynamic(() => import('./screens/WarehouseRequestsPage'), { ssr: false });
const EnquiriesPage = dynamic(() => import('./screens/EnquiriesPage'), { ssr: false });
const StandardCategoriesPage = dynamic(() => import('./screens/StandardCategoriesPage'), { ssr: false });
const IntegrationsPage = dynamic(() => import('./screens/IntegrationsPage'), { ssr: false });
const SellerApp = dynamic(() => import('./seller/SellerApp'), { ssr: false });
const UsersPage = dynamic(() => import('./screens/UsersPage'), { ssr: false });

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <CenterSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  // A warehouse never sees the admin panel: it gets its own panel.
  if (user.role === 'seller') return <SellerApp />;
  return <StatsProvider>{children}</StatsProvider>;
}

function CurrentPage({ pathname }: { pathname: string }) {
  if (pathname.startsWith('/riders/')) return <RiderProfilePage riderId={pathname.slice('/riders/'.length)} />;
  switch (pathname) {
    case '/':
      return <DashboardPage />;
    case '/analytics':
      return <AnalyticsPage />;
    case '/products':
      return <ProductsPage />;
    case '/inventory':
      return <InventoryPage />;
    case '/integrations':
      return <IntegrationsPage />;
    case '/standard-categories':
      return <StandardCategoriesPage />;
    case '/categories':
      return <CategoriesPage />;
    case '/banners':
      return <BannersPage />;
    case '/gallery':
      return <MediaPage kind="photo" />;
    case '/videos':
      return <MediaPage kind="video" />;
    case '/offers':
      return <OffersPage />;
    case '/orders':
      return <OrdersPage />;
    case '/shops':
      return <ShopsPage />;
    case '/riders':
      return <RidersPage />;
    case '/payouts':
      return <PayoutsPage />;
    case '/rider-accounts':
      return <UsersPage fixedRole="rider" title="Riders" subtitle="Delivery partners authorised to collect and deliver Bingoor orders." />;
    case '/customers':
      return <UsersPage fixedRole="customer" title="Customers" subtitle="All customers registered on the Bingoor app and website." />;
    case '/team':
      return <UsersPage title="Team & access" subtitle="Grant administrator access or suspend an account." />;
    case '/support':
      return <SupportPage />;
    case '/notifications':
      return <NoticesPage />;
    case '/delivery-pricing':
      return <DeliveryPricingPage />;
    case '/blog':
      return <BlogPage />;
    case '/product-sellers':
      return <ProductSellersPage />;
    case '/warehouse-requests':
      return <WarehouseRequestsPage />;
    case '/enquiries':
      return <EnquiriesPage />;
    case '/store-settings':
      return <SettingsStorePage />;
    case '/settings':
      return <SettingsPage />;
    default:
      return <Navigate to="/" replace />;
  }
}

export default function AdminApp() {
  const pathname = usePathname() ?? '/';
  if (pathname === '/login') return <LoginPage />;

  return (
    <RequireAuth>
      <Layout>
        <CurrentPage pathname={pathname} />
      </Layout>
    </RequireAuth>
  );
}