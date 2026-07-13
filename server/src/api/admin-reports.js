import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  dismissContentReport,
  hideReportedContent,
  listAdminContentReports,
} from '../services/admin-report-service.js';

const router = Router();

router.use(requireAuth);
router.use(requireRole('moderator', 'admin'));

router.get('/', (req, res, next) => {
  try {
    const page = req.query.page ? Number(req.query.page) : 1;
    const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 20;
    const status = req.query.status ?? 'pending';
    const result = listAdminContentReports({ status, page, pageSize });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/:reportId/hide', (req, res, next) => {
  try {
    const result = hideReportedContent({
      reportId: req.params.reportId,
      reviewerUserId: req.user.id,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/:reportId/dismiss', (req, res, next) => {
  try {
    const result = dismissContentReport({
      reportId: req.params.reportId,
      reviewerUserId: req.user.id,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
