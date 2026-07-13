import { randomUUID } from 'node:crypto';
import { getDb } from '../connection.js';

export function mapContentReportRow(row) {
  return {
    id: row.id,
    reporterUserId: row.reporter_user_id,
    targetType: row.target_type,
    targetId: row.target_id,
    reason: row.reason,
    status: row.status,
    reviewedBy: row.reviewed_by ?? null,
    reviewedAt: row.reviewed_at ?? null,
    createdAt: row.created_at,
  };
}

export function createContentReport(report) {
  const db = getDb();
  const id = report.id ?? randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO content_reports (
      id, reporter_user_id, target_type, target_id, reason, status, reviewed_by, reviewed_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    report.reporterUserId,
    report.targetType,
    report.targetId,
    report.reason,
    report.status ?? 'pending',
    report.reviewedBy ?? null,
    report.reviewedAt ?? null,
    report.createdAt ?? now,
  );
  return findContentReportById(id);
}

export function findContentReportById(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM content_reports WHERE id = ?').get(id);
  return row ? mapContentReportRow(row) : null;
}

export function findRecentReportByReporterAndTarget({ reporterUserId, targetType, targetId, sinceIso }) {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM content_reports
    WHERE reporter_user_id = ? AND target_type = ? AND target_id = ? AND created_at >= ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(reporterUserId, targetType, targetId, sinceIso);
  return row ? mapContentReportRow(row) : null;
}

export function listContentReports({ status = 'pending', page = 1, pageSize = 20 } = {}) {
  const db = getDb();
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(50, Math.max(1, pageSize));
  const offset = (safePage - 1) * safePageSize;

  const total = db.prepare(`
    SELECT COUNT(*) AS count FROM content_reports WHERE status = ?
  `).get(status).count;

  const rows = db.prepare(`
    SELECT * FROM content_reports
    WHERE status = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(status, safePageSize, offset);

  return {
    items: rows.map(mapContentReportRow),
    page: safePage,
    pageSize: safePageSize,
    total,
  };
}

export function updateContentReportStatus(id, { status, reviewedBy }) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE content_reports
    SET status = ?, reviewed_by = ?, reviewed_at = ?
    WHERE id = ?
  `).run(status, reviewedBy, now, id);
  return findContentReportById(id);
}
