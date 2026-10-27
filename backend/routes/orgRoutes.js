const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const c = require('../controllers/orgController');

router.use(protect);

router.get('/settings', authorize('admin', 'hr'), c.getSettings);
router.put('/settings', authorize('admin'), c.updateSettings);

router.get('/departments', authorize('admin', 'hr'), c.listDepartments);
router.post('/departments', authorize('admin'), c.addDepartment);
router.delete('/departments/:id', authorize('admin'), c.removeDepartment);

router.get('/holidays', c.listHolidays);
router.post('/holidays', authorize('admin'), c.addHoliday);
router.delete('/holidays/:id', authorize('admin'), c.removeHoliday);

module.exports = router;