import { AppError } from '../middleware/error.js';
import {
  listContentReports,
  updateContentReportStatus,
} from '../db/repositories/content-report-repository.js';
import {
  hideFanDiscussionTurn,
  updateFanDiscussion,
} from '../db/repositories/fan-discussion-repository.js';
import { hideFanDiscussionFeedItem } from './feed-service.js';
import {
  buildTargetSummary,
  getContentReportById,
  mapContentReportResponse,
} from './content-report-service.js';

export function listAdminContentReports({ status = 'pending', page = 1, pageSize = 20 } = {}) {
  const result = listContentReports({ status, page, pageSize });
  return {
    items: result.items.map((report) => mapContentReportResponse(report, buildTargetSummary(report))),
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
  };
}

export function hideReportedContent({ reportId, reviewerUserId }) {
  const report = getContentReportById(reportId);
  if (report.status !== 'pending') {
    throw new AppError(400, 'bad_request', '举报已处理');
  }

  if (report.targetType === 'fan_discussion') {
    updateFanDiscussion(report.targetId, { status: 'hidden' });
    hideFanDiscussionFeedItem(report.targetId);
  } else {
    hideFanDiscussionTurn(report.targetId);
  }

  const updated = updateContentReportStatus(reportId, {
    status: 'hidden',
    reviewedBy: reviewerUserId,
  });

  return {
    report: mapContentReportResponse(updated, buildTargetSummary(updated)),
    message: '内容已隐藏',
  };
}

export function dismissContentReport({ reportId, reviewerUserId }) {
  const report = getContentReportById(reportId);
  if (report.status !== 'pending') {
    throw new AppError(400, 'bad_request', '举报已处理');
  }

  const updated = updateContentReportStatus(reportId, {
    status: 'dismissed',
    reviewedBy: reviewerUserId,
  });

  return {
    report: mapContentReportResponse(updated, buildTargetSummary(updated)),
    message: '举报已驳回',
  };
}
