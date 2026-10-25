const router = require('express').Router();
const { protect } = require('../middleware/auth');
const c = require('../controllers/dashboardController');

router.get('/', protect, c.get);

module.exports = router;