import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as admin from '../controllers/admin.controller';
import * as uploads from '../controllers/upload.controller';
import * as extra from '../controllers/adminExtra.controller';
import * as invoices from '../controllers/invoice.controller';
import * as seller from '../controllers/seller.controller';
import { adminOnly } from '../middleware/auth';
import { uploadProductImages, uploadProductVideo } from '../middleware/upload';
import { validate } from '../middleware/validate';
import * as v from '../validators/schemas';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
});

/* Public: log in to the admin panel */
router.post('/auth/login', authLimiter, validate({ body: v.adminLoginBody }), admin.login);

/* Everything below needs a valid admin session */
router.use(...adminOnly);

router.get('/stats', validate({ query: v.adminStatsQuery }), admin.stats);

router.get('/me', admin.me);
router.get('/integrations', extra.getIntegrationsAdmin);
router.put('/integrations', validate({ body: v.integrationsBody }), extra.updateIntegrationsAdmin);
router.post('/integrations/razorpay/test', extra.testRazorpayAdmin);
router.post('/integrations/firebase/test', extra.testFirebaseAdmin);
router.post('/integrations/shiprocket/test', extra.testShiprocketAdmin);
router.post('/integrations/razorpayx/test', extra.testRazorpayxAdmin);
router.get('/standard-categories', extra.listStandardCategories);
router.post('/standard-categories', validate({ body: v.standardCategoryBody }), extra.createStandardCategory);
router.patch('/standard-categories/:id', validate({ params: v.idParam, body: v.standardCategoryUpdateBody }), extra.updateStandardCategory);
router.delete('/standard-categories/:id', validate({ params: v.idParam }), extra.deleteStandardCategory);
router.patch('/me', validate({ body: v.adminProfileBody }), admin.updateMe);
router.post('/me/password', validate({ body: v.adminPasswordBody }), admin.changeMyPassword);

router.post('/uploads/images', uploadProductImages, uploads.uploadImages);
router.post('/uploads/video', uploadProductVideo, uploads.uploadVideo);

router.get('/products', validate({ query: v.adminProductsQuery }), admin.listProductsAdmin);
router.get('/products/:id', validate({ params: v.idParam }), admin.getProductAdmin);
router.post('/products/bulk', validate({ body: v.bulkProductsBody }), admin.bulkCreateProducts);
router.post('/products', validate({ body: v.adminProductBody }), admin.createProduct);
router.patch('/products/:id', validate({ params: v.idParam, body: v.adminProductUpdateBody }), admin.updateProduct);
router.delete('/products/:id', validate({ params: v.idParam }), admin.deleteProduct);

router.get('/categories', admin.listCategoriesAdmin);
router.post('/categories', validate({ body: v.adminCategoryBody }), admin.createCategory);
router.patch('/categories/:id', validate({ params: v.idParam, body: v.adminCategoryUpdateBody }), admin.updateCategory);
router.delete('/categories/:id', validate({ params: v.idParam }), admin.deleteCategory);

router.get('/banners', admin.listBannersAdmin);
router.post('/banners', validate({ body: v.adminBannerBody }), admin.createBanner);
router.patch('/banners/:id', validate({ params: v.idParam, body: v.adminBannerUpdateBody }), admin.updateBanner);
router.delete('/banners/:id', validate({ params: v.idParam }), admin.deleteBanner);

router.get('/orders', validate({ query: v.adminOrdersQuery }), admin.listOrdersAdmin);
router.get('/orders/:id', validate({ params: v.idParam }), admin.getOrderAdmin);
router.post('/orders/:id/invoice-link', validate({ params: v.idParam }), invoices.adminInvoiceLink);
router.get('/orders/:id/free-riders', validate({ params: v.idParam }), admin.freeRidersAdmin);
router.post('/orders/:id/assign-rider', validate({ params: v.idParam, body: v.assignRiderBody }), admin.assignRiderAdmin);
router.post('/orders/:id/assign-shiprocket', validate({ params: v.idParam }), admin.assignShiprocketAdmin);
router.post('/orders/:id/refund', validate({ params: v.idParam }), admin.refundOrderAdmin);
router.patch('/orders/:id/status', validate({ params: v.idParam, body: v.adminOrderStatusBody }), admin.updateOrderStatus);

router.get('/shops', validate({ query: v.pagination }), admin.listShopsAdmin);
router.get('/shops/logins', seller.adminListWarehouseLogins);
router.put('/shops/:id/login', validate({ params: v.idParam, body: v.warehouseLoginBody }), seller.adminSetWarehouseLogin);
router.post('/shops', validate({ body: v.adminShopBody }), admin.createShop);
router.patch('/shops/:id', validate({ params: v.idParam, body: v.adminShopUpdateBody }), admin.updateShop);
router.delete('/shops/:id', validate({ params: v.idParam }), admin.deleteShop);

router.post('/riders', validate({ body: v.adminRiderBody }), admin.createRider);
router.get('/users', validate({ query: v.adminUsersQuery }), admin.listUsersAdmin);
router.patch('/users/:id', validate({ params: v.idParam, body: v.adminUserUpdateBody }), admin.updateUserAdmin);
router.delete('/users/:id', validate({ params: v.idParam }), admin.deleteUserAdmin);

router.get('/settings', extra.getSettings);
router.patch('/settings', validate({ body: v.adminSettingsBody }), extra.updateSettings);

router.get('/media', validate({ query: v.mediaQuery }), extra.listMediaAdmin);
router.post('/media', validate({ body: v.mediaBody }), extra.createMedia);
router.patch('/media/:id', validate({ params: v.idParam, body: v.mediaUpdateBody }), extra.updateMedia);
router.delete('/media/:id', validate({ params: v.idParam }), extra.deleteMedia);
router.get('/notices', extra.listNoticesAdmin);
router.post('/notices', validate({ body: v.noticeBody }), extra.createNotice);
router.delete('/notices/:id', validate({ params: v.idParam }), extra.deleteNotice);

router.get('/tickets', validate({ query: v.adminTicketsQuery }), extra.listTicketsAdmin);
router.get('/tickets/:id', validate({ params: v.idParam }), extra.getTicketAdmin);
router.post('/tickets/:id/reply', validate({ params: v.idParam, body: v.ticketMessageBody }), extra.replyTicketAdmin);
router.patch('/tickets/:id', validate({ params: v.idParam, body: v.ticketStatusBody }), extra.setTicketStatus);

router.get('/stock-alerts', validate({ query: v.pagination }), extra.listStockAlerts);
router.patch('/stock-alerts/:id', validate({ params: v.idParam, body: v.stockAlertUpdateBody }), extra.updateStockAlert);
router.delete('/stock-alerts/:id', validate({ params: v.idParam }), extra.deleteStockAlert);

router.get('/riders', validate({ query: v.adminRidersQuery }), extra.listRidersAdmin);
router.patch('/riders/:id/pause', validate({ params: v.idParam, body: v.riderPauseBody }), extra.setRiderPaused);
router.patch('/riders/:id/long-distance', validate({ params: v.idParam, body: v.riderLongDistanceBody }), extra.setRiderLongDistance);
router.get('/warehouse-applications', validate({ query: v.warehouseApplicationsQuery }), seller.adminListWarehouseApplications);
router.post('/warehouse-applications/:id/approve', validate({ params: v.idParam }), seller.adminApproveWarehouse);
router.post('/warehouse-applications/:id/reject', validate({ params: v.idParam, body: v.warehouseRejectBody }), seller.adminRejectWarehouse);
router.get('/sellers', validate({ query: v.adminSellersQuery }), seller.adminListSellers);
router.post('/sellers', validate({ body: v.adminSellerBody }), seller.adminCreateSeller);
router.patch('/sellers/:id/warehouses', validate({ params: v.idParam, body: v.sellerWarehousesBody }), seller.adminSetSellerWarehouses);
router.delete('/sellers/:id/profile', validate({ params: v.idParam }), seller.adminClearSellerProfile);
router.patch('/sellers/:id/active', validate({ params: v.idParam, body: v.activeBody }), seller.adminSetSellerActive);
router.get('/enquiries', validate({ query: v.adminEnquiriesQuery }), extra.listEnquiries);
router.delete('/enquiries/:id', validate({ params: v.idParam }), extra.deleteEnquiry);
router.post('/riders/:id/settle-cod', validate({ params: v.idParam }), extra.settleRiderCod);
router.get('/riders/:id/profile', validate({ params: v.idParam }), extra.getRiderProfileAdmin);
router.get('/withdrawals', validate({ query: v.withdrawalsQuery }), extra.listWithdrawals);
router.post('/withdrawals/:id/mark', validate({ params: v.idParam, body: v.markWithdrawalBody }), extra.markWithdrawal);
router.post('/withdrawals/:id/pay', validate({ params: v.idParam }), extra.payWithdrawalAdmin);
router.get('/seller-withdrawals', validate({ query: v.withdrawalsQuery }), extra.listSellerWithdrawals);
router.post('/seller-withdrawals/:id/mark', validate({ params: v.idParam, body: v.markWithdrawalBody }), extra.markSellerWithdrawal);
router.post('/seller-withdrawals/:id/pay', validate({ params: v.idParam }), extra.paySellerWithdrawalAdmin);
router.post('/cash-submits/:id/confirm', validate({ params: v.idParam }), extra.confirmCashSubmit);
router.post('/riders/:id/bonus', validate({ params: v.idParam, body: v.walletAdjustBody }), extra.adjustRiderWallet);

router.get('/alerts', extra.listAdminAlerts);
router.post('/alerts/read', extra.readAdminAlerts);

router.get('/coupons', validate({ query: v.adminCouponsQuery }), admin.listCouponsAdmin);
router.post('/coupons', validate({ body: v.adminCouponBody }), admin.createCoupon);
router.patch('/coupons/:id', validate({ params: v.idParam, body: v.adminCouponUpdateBody }), admin.updateCoupon);
router.delete('/coupons/:id', validate({ params: v.idParam }), admin.deleteCoupon);

export default router;
