const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Leave = require('../models/leave');

const dateKey = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

exports.get = async (req, res) => {
  try {
    const now = new Date();
    const today = dateKey(now);
    const monthStart = today.slice(0, 8) + '01';

    if (req.user.role === 'employee') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 6);
      const weekRecords = await Attendance.find({
        employeeId: req.user.employeeId,
        date: { $gte: dateKey(weekAgo) },
      });
      const monthRecords = await Attendance.find({
        employeeId: req.user.employeeId,
        date: { $gte: monthStart },
      });
      const pendingLeaves = await Leave.countDocuments({
        employeeId: req.user.employeeId,
        status: 'pending',
      });
      return res.json({
        role: 'employee',
        hoursThisWeek: Number(weekRecords.reduce((s, r) => s + r.hours, 0).toFixed(1)),
        lateThisMonth: monthRecords.filter((r) => r.status === 'late').length,
        daysPresentThisMonth: monthRecords.length,
        pendingLeaves,
      });
    }

    const [headcount, todayRecords, onLeave, pending, byDept, topLate] = await Promise.all([
      Employee.countDocuments({ status: { $in: ['active', 'probation'] } }),
      Attendance.find({ date: today }),
      Leave.countDocuments({ status: 'approved', startDate: { $lte: today }, endDate: { $gte: today } }),
      Leave.countDocuments({ status: 'pending' }),
      Employee.aggregate([
        { $match: { status: { $in: ['active', 'probation'] } } },
        { $group: { _id: '$department', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Attendance.aggregate([
        { $match: { status: 'late', date: { $gte: monthStart } } },
        { $group: { _id: '$employeeId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'employees', localField: '_id', foreignField: '_id', as: 'emp' } },
        { $unwind: '$emp' },
        { $project: { _id: 0, name: '$emp.name', count: 1 } },
      ]),
    ]);

    res.json({
      role: req.user.role,
      date: today,
      headcount,
      presentToday: todayRecords.length,
      lateToday: todayRecords.filter((r) => r.status === 'late').length,
      onLeave,
      pendingApprovals: pending,
      headcountByDepartment: byDept.map((d) => ({ department: d._id || 'No department', count: d.count })),
      topLateComers: topLate,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};