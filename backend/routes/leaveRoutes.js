const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const c = require('../controllers/leaveController');

router.use(protect);

router.post('/', authorize('employee'), c.apply);
router.get('/me', authorize('employee'), c.myLeaves);
router.patch('/:id/cancel', authorize('employee'), c.cancel);
router.get('/', authorize('hr', 'admin'), c.inbox);
router.patch('/:id/decision', authorize('hr'), c.decide);

module.exports = router;