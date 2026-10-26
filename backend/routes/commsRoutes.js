const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const c = require('../controllers/commsController');

router.use(protect);

router.get('/announcements', c.listAnnouncements);
router.post('/announcements', authorize('hr', 'admin'), c.postAnnouncement);
router.get('/audit', authorize('admin'), c.listAudit);

module.exports = router;