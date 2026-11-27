import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as auth from '../controllers/auth.controller';
import adminRoutes from './admin';
import * as cart from '../controllers/cart.controller';
import * as catalog from '../controllers/catalog.controller';
import * as orders from '../controllers/order.controller';
import * as invoices from '../controllers/invoice.controller';
import * as reviews from '../controllers/review.controller';
import * as me from '../controllers/user.controller';
import * as rider from '../controllers/rider.controller';
import * as wallet from '../controllers/riderWallet.controller';
import * as extra from '../controllers/adminExtra.controller';
import * as support from '../controllers/support.controller';
import * as seller from '../controllers/seller.controller';
import * as blog from '../controllers/blog.controller';
import { authorize, customerOnly, protect } from '../middleware/auth';

import { catalogCache, invalidateOnWrite } from '../middleware/cache';
import { validate } from '../middleware/validate';
import * as uploads from '../controllers/upload.controller';
import { uploadSellerImages, uploadSellerVideo } from '../middleware/upload';
import * as v from '../validators/schemas';

const router = Router();

// Stricter limit on credential endpoints (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
});

const limiter = (limit: number) =>
  rateLimit({ windowMs: 15 * 60 * 1000, limit, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many requests. Please try again in a few minutes.' } });
/** "Notify me" stores a phone / email per request: keep it from being used to spam the list. */
const notifyLimiter = limiter(20);
/** The guest cart is re-priced as a visitor shops, so it gets more room than a form. */
const guestCartLimiter = limiter(300);
/** Payment providers retry, but never this often from one address. */
const webhookLimiter = limiter(300);

/* ============ Auth ============ */
router.post('/auth/register', authLimiter, validate({ body: v.registerBody }), auth.register);
router.post('/auth/login', authLimiter, validate({ body: v.loginBody }), auth.login);
router.post('/auth/google', authLimiter, validate({ body: v.googleLoginBody }), auth.googleLogin);
router.post('/auth/facebook', authLimiter, validate({ body: v.facebookLoginBody }), auth.facebookLogin);
router.post('/auth/instagram', authLimiter, validate({ body: v.instagramLoginBody }), auth.instagramLogin);
router.post('/rider/auth/login', authLimiter, validate({ body: v.loginBody }), auth.riderLogin);
router.post('/auth/refresh', authLimiter, validate({ body: v.refreshBody }), auth.refresh);
router.post('/auth/logout', protect, auth.logout);
router.post('/auth/change-password', ...customerOnly, validate({ body: v.changePasswordBody }), auth.changePassword);

/* ============ Webhooks (no login; verified by signature or by re-fetching from the provider) ============ */
router.post('/webhooks/razorpayx', webhookLimiter, extra.razorpayxWebhook);
// Razorpay payment webhook: places (or refunds) the order even if the client
// never calls /orders/online/confirm. Verified by HMAC signature on the raw body.
router.post('/orders/online/webhook', webhookLimiter, orders.razorpayWebhook);
router.post('/webhooks/razorpay', webhookLimiter, orders.razorpayWebhook);

/* ============ Public catalog (no login needed) ============ */
router.get('/home', catalogCache, validate({ query: v.homeQuery }), catalog.home);
router.get('/coverage', catalogCache, validate({ query: v.coverageQuery }), catalog.coverage);
router.get('/categories', catalogCache, validate({ query: v.categoriesQuery }), catalog.listCategories);
router.get('/categories/tree', catalogCache, catalog.categoryTree);
router.get('/categories/:idOrSlug', catalogCache, validate({ params: v.idOrSlugParam }), catalog.getCategory);
router.get('/shops', catalogCache, validate({ query: v.shopsQuery }), catalog.listShops);
router.get('/shops/:idOrSlug', catalogCache, validate({ params: v.idOrSlugParam }), catalog.getShop);
router.get('/products', catalogCache, validate({ query: v.productsQuery }), catalog.listProducts);
router.get('/products/brands', catalogCache, catalog.listBrands);
router.get('/products/suggest', catalogCache, validate({ query: v.suggestQuery }), catalog.suggestProducts);
router.get('/products/:idOrSlug', catalogCache, validate({ params: v.idOrSlugParam }), catalog.getProduct);
router.get('/products/:id/reviews', catalogCache, validate({ params: v.idParam, query: v.pagination }), reviews.listReviews);

router.get('/settings/public', catalogCache, catalog.publicSettings);
router.get('/festival', catalogCache, validate({ query: v.homeQuery }), catalog.festival);
router.get('/notices', catalogCache, support.listNotices);
router.get('/blog', catalogCache, validate({ query: v.pagination }), blog.listPosts);
router.get('/blog/:slug', catalogCache, validate({ params: v.blogSlugParam }), blog.getPost);
router.get('/gallery', catalogCache, extra.listMediaPublic('photo'));
router.get('/videos', catalogCache, extra.listMediaPublic('video'));
router.post('/enquiries', authLimiter, validate({ body: v.enquiryBody }), support.createEnquiry);
router.post('/products/:id/notify', notifyLimiter, validate({ params: v.idParam, body: v.notifyMeBody }), support.notifyMe);

/* ============ Chat with customer care (login) ============ */
router.get('/me/tickets', ...customerOnly, support.listMyTickets);
router.get('/me/tickets/unread', ...customerOnly, support.myUnreadCount);
router.post('/me/tickets', ...customerOnly, validate({ body: v.ticketBody }), support.createTicket);
router.get('/me/tickets/:id', ...customerOnly, validate({ params: v.idParam }), support.getMyTicket);
router.post('/me/tickets/:id/messages', ...customerOnly, validate({ params: v.idParam, body: v.ticketMessageBody }), support.replyMyTicket);

/* ============ Seller panel ============ */
const sellerOnly = [protect, authorize('seller')];
router.post('/seller/register', authLimiter, validate({ body: v.warehouseRegisterBody }), seller.registerWarehouse);
router.post('/seller/auth/login', authLimiter, validate({ body: v.loginBody }), seller.sellerLogin);
router.get('/seller/me', ...sellerOnly, seller.getMe);
router.post('/seller/ack-orders', ...sellerOnly, seller.ackOrders);
router.put('/seller/profile', ...sellerOnly, validate({ body: v.sellerProfileBody }), seller.saveProfile);
router.post('/seller/uploads/images', ...sellerOnly, uploadSellerImages, uploads.uploadImages);
router.post('/seller/uploads/video', ...sellerOnly, uploadSellerVideo, uploads.uploadVideo);
router.get('/seller/categories', ...sellerOnly, seller.categoryTree);
router.get('/seller/products', ...sellerOnly, validate({ query: v.sellerProductsQuery }), seller.listMyProducts);
router.get('/seller/dashboard', ...sellerOnly, seller.warehouseOnly, seller.warehouseDashboard);
router.get('/seller/shops', ...sellerOnly, seller.warehouseOnly, seller.listMyShops);
router.patch('/seller/shops/:id', ...sellerOnly, seller.warehouseOnly, validate({ params: v.idParam, body: v.sellerShopBody }), seller.updateMyShop);
router.get('/seller/customers', ...sellerOnly, seller.warehouseOnly, validate({ query: v.sellerCustomersQuery }), seller.listMyCustomers);
router.post('/seller/change-password', ...sellerOnly, validate({ body: v.changePasswordBody }), seller.changeMyPassword);
router.post('/seller/products/bulk', ...sellerOnly, invalidateOnWrite, validate({ body: v.bulkProductsBody }), seller.bulkCreateMyProducts);
router.post('/seller/products', ...sellerOnly, invalidateOnWrite, validate({ body: v.sellerProductBody }), seller.createMyProduct);
router.delete('/seller/products/:id', ...sellerOnly, invalidateOnWrite, validate({ params: v.idParam }), seller.deleteMyProduct);
router.get('/seller/riders', ...sellerOnly, seller.warehouseOnly, seller.listMyRiders);
router.post('/seller/riders', ...sellerOnly, seller.warehouseOnly, validate({ body: v.sellerRiderBody }), seller.createMyRider);
router.post('/seller/orders/:id/invoice-link', ...sellerOnly, seller.warehouseOnly, validate({ params: v.idParam }), invoices.sellerInvoiceLink);
router.get('/seller/orders', ...sellerOnly, validate({ query: v.sellerOrdersQuery }), seller.listMyOrders);
router.patch('/seller/orders/:id/status', ...sellerOnly, seller.warehouseOnly, validate({ params: v.idParam, body: v.sellerOrderStatusBody }), seller.setMyOrderStatus);
router.get('/seller/orders/:id/riders', ...sellerOnly, seller.warehouseOnly, validate({ params: v.idParam }), seller.myOrderRiders);
router.get('/seller/orders/:id/free-riders', ...sellerOnly, seller.warehouseOnly, validate({ params: v.idParam }), seller.myOrderFreeRiders);
router.post('/seller/orders/:id/assign-rider', ...sellerOnly, seller.warehouseOnly, validate({ params: v.idParam, body: v.assignRiderBody }), seller.assignRiderMyOrder);
router.post('/seller/orders/:id/assign-shiprocket', ...sellerOnly, seller.warehouseOnly, validate({ params: v.idParam }), seller.assignShiprocketMyOrder);
router.get('/seller/wallet', ...sellerOnly, seller.getMyWallet);
router.get('/seller/wallet/txns', ...sellerOnly, validate({ query: v.walletTxnsQuery }), seller.listMyWalletTxns);
router.post('/seller/wallet/account', ...sellerOnly, validate({ body: v.walletAccountBody }), seller.saveMyAccount);
router.post('/seller/wallet/withdraw', ...sellerOnly, validate({ body: v.withdrawBody }), seller.requestMyWithdraw);
router.patch('/seller/products/:id', ...sellerOnly, invalidateOnWrite, validate({ params: v.idParam, body: v.sellerProductUpdateBody }), seller.updateMyProduct);

/* ============ Reviews (login) ============ */
router.put('/products/:id/reviews', ...customerOnly, invalidateOnWrite, validate({ params: v.idParam, body: v.reviewBody }), reviews.upsertReview);
router.delete('/reviews/:id', ...customerOnly, invalidateOnWrite, validate({ params: v.idParam }), reviews.deleteReview);

/* ============ Profile, addresses, wishlist (login) ============ */
router.get('/me', ...customerOnly, me.getMe);
router.delete('/me', ...customerOnly, validate({ body: v.deleteMeBody }), me.deleteMe);
router.patch('/me', ...customerOnly, validate({ body: v.updateProfileBody }), me.updateMe);

router.get('/me/addresses', ...customerOnly, me.listAddresses);
router.post('/me/addresses', ...customerOnly, validate({ body: v.addressBody }), me.addAddress);
router.patch('/me/addresses/:addressId', ...customerOnly, validate({ params: v.addressIdParam, body: v.addressUpdateBody }), me.updateAddress);
router.patch('/me/addresses/:addressId/default', ...customerOnly, validate({ params: v.addressIdParam }), me.setDefaultAddress);
router.delete('/me/addresses/:addressId', ...customerOnly, validate({ params: v.addressIdParam }), me.deleteAddress);

router.get('/me/wishlist', ...customerOnly, me.getWishlist);
router.post('/me/wishlist/:productId', ...customerOnly, validate({ params: v.productIdParam }), me.addToWishlist);
router.delete('/me/wishlist/:productId', ...customerOnly, validate({ params: v.productIdParam }), me.removeFromWishlist);

/* ============ Cart (login) ============ */
router.get('/cart/points-products', catalog.pointsProducts);
router.post('/cart/guest', guestCartLimiter, validate({ body: v.guestCartBody }), cart.guestCart);
router.get('/cart', ...customerOnly, cart.getCart);
router.get('/cart/quote', ...customerOnly, validate({ query: v.quoteQuery }), cart.quote);
router.post('/cart/items', ...customerOnly, validate({ body: v.addCartItemBody }), cart.addItem);
router.patch('/cart/items/:productId', ...customerOnly, validate({ params: v.productIdParam, body: v.updateCartItemBody }), cart.updateItem);
router.delete('/cart/items/:productId', ...customerOnly, validate({ params: v.productIdParam }), cart.removeItem);
router.delete('/cart', ...customerOnly, cart.clearCart);

/* ============ Orders (login) ============ */
router.post('/orders', ...customerOnly, validate({ body: v.placeOrderBody }), orders.placeOrder);
router.post('/orders/online/confirm', ...customerOnly, validate({ body: v.confirmPaymentBody }), orders.confirmOnlinePayment);
router.get('/orders', ...customerOnly, validate({ query: v.ordersQuery }), orders.listOrders);
router.post('/orders/:id/invoice-link', ...customerOnly, validate({ params: v.idParam }), invoices.customerInvoiceLink);
router.get('/invoices/:id', validate({ params: v.idParam }), invoices.renderInvoice);
router.get('/orders/:id/rider-distance', ...customerOnly, validate({ params: v.idParam }), orders.riderDistance);
router.get('/orders/:id', ...customerOnly, validate({ params: v.idParam }), orders.getOrder);
router.post('/orders/:id/cancel', ...customerOnly, validate({ params: v.idParam, body: v.cancelOrderBody }), orders.cancelOrder);
router.post('/orders/:id/reorder', ...customerOnly, validate({ params: v.idParam }), orders.reorder);
/* ============ Rider delivery ============ */
router.get('/rider/me', protect, authorize('rider'), rider.touchRider, rider.getProfile);
router.get('/rider/orders', protect, authorize('rider'), rider.touchRider, validate({ query: v.riderOrdersQuery }), rider.listOrders);
router.post('/rider/orders/:id/accept', protect, authorize('rider'), validate({ params: v.idParam }), rider.acceptOrder);
router.get('/rider/road-distance', protect, authorize('rider'), validate({ query: v.roadDistanceQuery }), rider.roadDistance);
router.get('/rider/route', protect, authorize('rider'), validate({ query: v.roadDistanceQuery }), rider.route);
router.post('/rider/location', protect, authorize('rider'), rider.touchRider, validate({ body: v.riderLocationBody }), rider.updateLocation);
router.post('/rider/orders/:id/cancel', protect, authorize('rider'), validate({ params: v.idParam, body: v.cancelOrderBody }), rider.cancelOrder);
router.post('/rider/orders/:id/deliver', protect, authorize('rider'), validate({ params: v.idParam, body: v.riderDeliveryBody }), rider.deliverOrder);
router.get('/rider/wallet', protect, authorize('rider'), rider.touchRider, wallet.getWallet);
router.get('/rider/wallet/txns', protect, authorize('rider'), validate({ query: v.walletTxnsQuery }), wallet.listWalletTxns);
router.get('/rider/earnings', protect, authorize('rider'), wallet.earningsSummary);
router.post('/rider/wallet/account', protect, authorize('rider'), validate({ body: v.walletAccountBody }), wallet.saveAccount);
router.post('/rider/wallet/withdraw', protect, authorize('rider'), validate({ body: v.withdrawBody }), wallet.requestWithdraw);
router.post('/rider/wallet/cash-submit', protect, authorize('rider'), validate({ body: v.cashSubmitBody }), wallet.submitCash);

/* ============ Admin panel ============ */
router.use('/admin', invalidateOnWrite, adminRoutes);

export default router;
