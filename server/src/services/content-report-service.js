import { AppError } from '../middleware/error.js';
import {
  createContentReport,
  findContentReportById,
  findRecentReportByReporterAndTarget,
} from '../db/repositories/content-report-repository.js';
import {
  findFanDiscussionForReport,
  findFanDiscussionTurnForReport,
} from './fan-discussion-service.js';

const REPORT_DEDUP_MS = 24 * 60 * 60 * 1000;

export function submitContentReport({ reporterUserId, targetType, targetId, reason }) {
  if (!targetType || !['fan_discussion', 'fan_discussion_turn'].includes(targetType)) {
    throw new AppError(400, 'bad_request', '举报目标类型无效');
  }
  if (!targetId || typeof targetId !== 'string') {
    throw new AppError(400, 'bad_request', '举报目标无效');
  }
  if (!reason || typeof reason !== 'string' || reason.trim().length === 0 || reason.length > 500) {
    throw new AppError(400, 'bad_request', '举报原因无效');
  }

  if (targetType === 'fan_discussion') {
    const discussion = findFanDiscussionForReport(targetId);
    if (!discussion) {
      throw new AppError(404, 'not_found', '举报目标不存在');
    }
  } else {
    const turn = findFanDiscussionTurnForReport(targetId);
    if (!turn) {
      throw new AppError(404, 'not_found', '举报目标不存在');
    }
  }

  const sinceIso = new Date(Date.now() - REPORT_DEDUP_MS).toISOString();
  const duplicate = findRecentReportByReporterAndTarget({
    reporterUserId,
    targetType,
    targetId,
    sinceIso,
  });
  if (duplicate) {
    throw new AppError(409, 'conflict', '24 小时内不可重复举报同一目标');
  }

  const report = createContentReport({
    reporterUserId,
    targetType,
    targetId,
    reason: reason.trim(),
  });

  console.log(JSON.stringify({
    level: 'info',
    type: 'content_report_submitted',
    reportId: report.id,
    targetType,
    targetId,
    reporterUserId,
  }));

  return {
    id: report.id,
    targetType: report.targetType,
    targetId: report.targetId,
    reason: report.reason,
    status: report.status,
    reporterUserId: report.reporterUserId,
    reviewedBy: report.reviewedBy,
    reviewedAt: report.reviewedAt,
    createdAt: report.createdAt,
  };
}

export function mapContentReportResponse(report, targetSummary = null) {
  return {
    id: report.id,
    targetType: report.targetType,
    targetId: report.targetId,
    reason: report.reason,
    status: report.status,
    reporterUserId: report.reporterUserId,
    reviewedBy: report.reviewedBy,
    reviewedAt: report.reviewedAt,
    createdAt: report.createdAt,
    targetSummary: targetSummary ?? undefined,
  };
}

export function buildTargetSummary(report) {
  if (report.targetType === 'fan_discussion') {
    const discussion = findFanDiscussionForReport(report.targetId);
    return discussion?.topic ?? null;
  }
  const turn = findFanDiscussionTurnForReport(report.targetId);
  return turn?.content?.slice(0, 120) ?? null;
}

export function getContentReportById(reportId) {
  const report = findContentReportById(reportId);
  if (!report) {
    throw new AppError(404, 'not_found', '举报不存在');
  }
  return report;
}
