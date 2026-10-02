const express = require('express');
const {
  getTransactions,
  createTransaction,
  getProductTransactions,
  getStats,
} = require('../controllers/transactionController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router
  .route('/')
  .get(protect, getTransactions)
  .post(protect, authorize('manager', 'admin'), createTransaction);

router.get('/stats', protect, getStats);
router.get('/product/:productId', protect, getProductTransactions);

module.exports = router;