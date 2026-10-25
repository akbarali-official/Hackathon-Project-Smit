const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const c = require('../controllers/payrollController');

router.use(protect);

router.get('/me/slips', authorize('employee'), c.mySlips);
router.post('/run', authorize('hr'), c.run);
router.get('/', authorize('hr', 'admin'), c.list);
router.get('/:month', authorize('hr', 'admin'), c.getOne);
router.post('/:month/finalize', authorize('admin'), c.finalize);

module.exports = router;