const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const c = require('../controllers/aiController');

router.use(protect);

router.post('/chat', c.chat);
router.post('/smart-leave', authorize('employee'), c.smartLeave);
router.post('/summary', authorize('hr', 'admin'), c.summary);

module.exports = router;