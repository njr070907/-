export type ParseStatus = 'raw' | 'review_required' | 'confirmed'

export type Evidence = {
  field: keyof Omit<NoticeExtraction, 'confidence' | 'evidence'>
  text: string
}

export type NoticeExtraction = {
  matter_name: string
  audience: string[]
  stage: string
  deadline: string | null
  submit_channel: string
  materials: string[]
  explicit_change: string
  confidence: number
  evidence: Evidence[]
}

export type NoticeSummary = {
  id: string
  title: string | null
  source_name: string | null
  published_at: string | null
  source_type: string
  parse_status: ParseStatus
  matter_id: string | null
  audience_roles?: string[] | null
  colleges?: string[] | null
  majors?: string[] | null
  grades?: string[] | null
  tags?: string[] | null
  category?: string | null
  summary?: string | null
  description?: string | null
  deadline?: string | null
  importance?: string | null
  required?: boolean | null
}

export type NoticeDetail = NoticeSummary & {
  raw_text: string
  source_url: string | null
  collected_by: string | null
  collected_at: string | null
  imported_at: string
  created_at: string
  extracted_json: NoticeExtraction | null
}

export type MatterSummary = {
  id: string
  name: string
  created_at: string
}

export type Task = {
  id: string
  matter_id: string
  source_notice_id: string | null
  stage: string
  deadline: string | null
  submit_channel: string
  materials: string[]
  confirmed: boolean
  completed: boolean
  created_at: string
}

export type MatterDetail = MatterSummary & {
  notices: NoticeSummary[]
  tasks: Task[]
}

export type FieldChange = {
  field: 'deadline' | 'audience' | 'submit_channel' | 'materials'
  before: string | string[] | null
  after: string | string[] | null
}

export type VersionComparison = {
  previous_notice_id: string
  current_notice_id: string
  changes: FieldChange[]
  summary: string[]
}

export type NoticeCreateInput = {
  title?: string | null
  raw_text: string
  source_name?: string | null
  source_url?: string | null
  audience_roles?: string[] | null
  colleges?: string[] | null
  majors?: string[] | null
  grades?: string[] | null
  tags?: string[] | null
  deadline?: string | null
  importance?: string | null
  required?: boolean | null
}

export type TaskDraft = {
  stage: string
  deadline: string | null
  submit_channel: string
  materials: string[]
}

export type NoticeConfirmInput = {
  extraction: NoticeExtraction
  matter_id?: string
  new_matter_name?: string
  task?: TaskDraft
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '')
const offlineMode = import.meta.env.VITE_OFFLINE_MODE === 'true' || window.location.protocol === 'file:'

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  if (offlineMode) return offlineRequest<T>(path, init)
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: string } | null
    throw new Error(payload?.detail || `请求失败（${response.status}）`)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const getHealth = () => requestJson<{ status: string }>('/health')

export const getNotices = (query?: string) => {
  const suffix = query?.trim() ? `?query=${encodeURIComponent(query.trim())}` : ''
  return requestJson<NoticeSummary[]>(`/api/notices${suffix}`)
}
export const getNotice = (id: string) =>
  requestJson<NoticeDetail>(`/api/notices/${encodeURIComponent(id)}`)

export const createNotice = (payload: NoticeCreateInput) =>
  requestJson<NoticeDetail>('/api/notices', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const updateNotice = (id: string, payload: NoticeCreateInput) =>
  requestJson<NoticeDetail>(`/api/notices/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

export const deleteDraftNotice = (id: string) =>
  requestJson<void>(`/api/notices/${encodeURIComponent(id)}`, { method: 'DELETE' })

// Drafts are notices extracted but not yet confirmed; they stay out of the feed.
export const isDraftNotice = (notice: Pick<NoticeSummary, 'parse_status'>) => notice.parse_status === 'review_required'

export const extractNotice = (id: string) =>
  requestJson<NoticeDetail>(`/api/notices/${encodeURIComponent(id)}/extract`, {
    method: 'POST',
  })

export const confirmNotice = (id: string, payload: NoticeConfirmInput) =>
  requestJson<NoticeDetail>(`/api/notices/${encodeURIComponent(id)}/confirm`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const getMatters = () => requestJson<MatterSummary[]>('/api/matters')

export const getMatter = (id: string) =>
  requestJson<MatterDetail>(`/api/matters/${encodeURIComponent(id)}`)

export const compareMatterNotices = (
  matterId: string,
  previousNoticeId: string,
  currentNoticeId: string,
) => {
  const query = new URLSearchParams({
    previous_notice_id: previousNoticeId,
    current_notice_id: currentNoticeId,
  })
  return requestJson<VersionComparison>(
    `/api/matters/${encodeURIComponent(matterId)}/compare?${query.toString()}`,
  )
}

export const getWeekTasks = (start?: string) => {
  const suffix = start ? `?start=${encodeURIComponent(start)}` : ''
  return requestJson<Task[]>(`/api/tasks/week${suffix}`)
}

export const updateTask = (id: string, completed: boolean) =>
  requestJson<Task>(`/api/tasks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ completed }),
  })
import { offlineRequest } from './offlineApi'
