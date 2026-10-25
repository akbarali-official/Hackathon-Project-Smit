const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const c = require('../controllers/employeeController');

router.use(protect);

router.post('/', authorize('hr'), c.create);
router.get('/', authorize('hr', 'admin'), c.list);

module.exports = router;