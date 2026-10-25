const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const c = require('../controllers/attendanceController');

router.use(protect);

router.post('/check-in', authorize('employee'), c.checkIn);
router.post('/check-out', authorize('employee'), c.checkOut);
router.get('/me', authorize('employee'), c.myRecords);
router.get('/board', authorize('hr', 'admin'), c.board);

module.exports = router;