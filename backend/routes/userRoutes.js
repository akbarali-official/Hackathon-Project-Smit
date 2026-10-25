const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const c = require('../controllers/userController');

router.use(protect, authorize('admin'));

router.post('/hr', c.createHR);
router.get('/', c.listUsers);

module.exports = router;