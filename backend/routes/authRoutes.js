const router = require('express').Router();
const { protect } = require('../middleware/auth');
const c = require('../controllers/authController');

router.get('/status', c.status);
router.post('/setup', c.setup);
router.post('/login', c.login);
router.get('/me', protect, c.me);
router.post('/change-password', protect, c.changePassword);

module.exports = router;