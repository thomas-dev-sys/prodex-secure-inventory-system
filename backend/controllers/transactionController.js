const Transaction = require('../models/Transaction');
const Product = require('../models/Product');
const mongoose = require('mongoose');

// @desc    Get all transactions
// @route   GET /api/transactions
// @access  Private
exports.getTransactions = async (req, res) => {
  try {
    const { productId, type, startDate, endDate, page = 1, limit = 20 } = req.query;

    // Build query
    let query = {};

    if (productId) {
      query.product = productId;
    }

    if (type) {
      query.type = type;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    const transactions = await Transaction.find(query)
      .populate('product', 'name sku')
      .populate('performedBy', 'firstName lastName')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const count = await Transaction.countDocuments(query);

    res.status(200).json({
      success: true,
      count: transactions.length,
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      data: transactions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create transaction (stock in/out/adjustment)
// @route   POST /api/transactions
// @access  Private (Manager/Admin)
exports.createTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { productId, type, quantity, reason } = req.body;

    // Validate required fields
    if (!productId || !type || !quantity) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
      });
    }

    // Validate type
    if (!['IN', 'OUT', 'ADJUSTMENT'].includes(type)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invalid transaction type',
      });
    }

    // Get product
    const product = await Product.findById(productId).session(session);

    if (!product) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const previousQuantity = product.quantity;
    let newQuantity;

    // Calculate new quantity based on transaction type
    switch (type) {
      case 'IN':
        newQuantity = previousQuantity + quantity;
        break;
      case 'OUT':
        newQuantity = previousQuantity - quantity;
        if (newQuantity < 0) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: 'Insufficient stock',
          });
        }
        break;
      case 'ADJUSTMENT':
        newQuantity = quantity; // For adjustments, quantity is the new total
        break;
    }

    // Create transaction
    const transaction = await Transaction.create(
      [
        {
          product: productId,
          type,
          quantity: type === 'ADJUSTMENT' ? Math.abs(newQuantity - previousQuantity) : quantity,
          previousQuantity,
          newQuantity,
          reason,
          performedBy: req.user.id,
        },
      ],
      { session }
    );

    // Update product quantity
    product.quantity = newQuantity;
    product.updatedBy = req.user.id;
    await product.save({ session });

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      data: transaction[0],
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// @desc    Get transaction history for a product
// @route   GET /api/transactions/product/:productId
// @access  Private
exports.getProductTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({
      product: req.params.productId,
    })
      .populate('performedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get dashboard statistics
// @route   GET /api/transactions/stats
// @access  Private
exports.getStats = async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments({ isActive: true });
    
    const lowStockCount = await Product.countDocuments({
      isActive: true,
      $expr: { $lte: ['$quantity', '$reorderLevel'] },
    });

    const totalValue = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          total: { $sum: { $multiply: ['$quantity', '$price'] } },
        },
      },
    ]);

    const recentTransactions = await Transaction.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    const categoryBreakdown = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalValue: { $sum: { $multiply: ['$quantity', '$price'] } },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalProducts,
        lowStockCount,
        totalValue: totalValue.length > 0 ? totalValue[0].total : 0,
        recentTransactions,
        categoryBreakdown,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};