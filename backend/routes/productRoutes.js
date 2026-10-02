const express = require('express');
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getLowStockProducts,
} = require('../controllers/productController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router
  .route('/')
  .get(protect, getProducts)
  .post(protect, authorize('manager', 'admin'), createProduct);

router.get('/alerts/low-stock', protect, getLowStockProducts);

router
  .route('/:id')
  .get(protect, getProduct)
  .put(protect, authorize('manager', 'admin'), updateProduct)
  .delete(protect, authorize('admin'), deleteProduct);

module.exports = router;