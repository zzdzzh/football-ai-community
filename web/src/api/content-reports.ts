import apiClient from './client';
import type {
  ContentReport,
  ContentReportActionResponse,
  ContentReportListResponse,
  CreateContentReportRequest,
} from '@/types/fan';

export async function submitContentReport(
  payload: CreateContentReportRequest,
): Promise<ContentReport> {
  const { data } = await apiClient.post<ContentReport>('/content-reports', payload);
  return data;
}

export async function fetchAdminContentReports(params?: {
  status?: 'pending' | 'hidden' | 'dismissed';
  page?: number;
  pageSize?: number;
}): Promise<ContentReportListResponse> {
  const { data } = await apiClient.get<ContentReportListResponse>('/admin/content-reports', {
    params,
  });
  return data;
}

export async function hideContentReport(reportId: string): Promise<ContentReportActionResponse> {
  const { data } = await apiClient.post<ContentReportActionResponse>(
    `/admin/content-reports/${reportId}/hide`,
  );
  return data;
}

export async function dismissContentReport(reportId: string): Promise<ContentReportActionResponse> {
  const { data } = await apiClient.post<ContentReportActionResponse>(
    `/admin/content-reports/${reportId}/dismiss`,
  );
  return data;
}
