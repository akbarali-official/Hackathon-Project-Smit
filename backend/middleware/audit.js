const AuditLog = require('../models/AuditLog');

module.exports = (req, action, entity, entityId, before, after) =>
  AuditLog.create({
    actorId: req.user._id,
    actorName: req.user.name,
    role: req.user.role,
    action,
    entity,
    entityId: String(entityId || ''),
    before: before ?? null,
    after: after ?? null,
  }).catch(() => {});