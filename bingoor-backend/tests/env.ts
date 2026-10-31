// Controller tests mock database operations; no connection or production secrets are used.
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/bingoor-unit-tests';
process.env.JWT_ACCESS_SECRET = 'unit-test-access-secret-only';
process.env.JWT_REFRESH_SECRET = 'unit-test-refresh-secret-only';
