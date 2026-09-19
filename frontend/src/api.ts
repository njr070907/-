export type Evidence = { field: string; text: string }

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
  parse_status: string
  matter_id: string | null
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

export type MatterSummary = { id: string; name: string; created_at: string }
export type NoticeCreatePayload = {
  title?: string | null
  raw_text: string
  source_name?: string | null
  source_url?: string | null
}
export type NoticeConfirmPayload = {
  extraction: NoticeExtraction
  matter_id?: string
  new_matter_name?: string
  task?: {
    stage: string
    deadline: string | null
    submit_channel: string
    materials: string[]
  }
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    let message = `请求失败（${response.status}）`
    try {
      const body = await response.json() as { detail?: string | Array<{ msg?: string }> }
      if (typeof body.detail === 'string') message = body.detail
      if (Array.isArray(body.detail)) {
        message = body.detail.map((item) => item.msg).filter(Boolean).join('；') || message
      }
    } catch {
      // Keep the status-based message when the server did not return JSON.
    }
    throw new Error(message)
  }
  return response.json() as Promise<T>
}

export const getHealth = () => requestJson<{ status: string }>('/health')
export const getNotices = () => requestJson<NoticeSummary[]>('/api/notices')
export const getNotice = (id: string) =>
  requestJson<NoticeDetail>(`/api/notices/${encodeURIComponent(id)}`)
export const getMatters = () => requestJson<MatterSummary[]>('/api/matters')
export const createNotice = (payload: NoticeCreatePayload) =>
  requestJson<NoticeDetail>('/api/notices', { method: 'POST', body: JSON.stringify(payload) })
export const extractNotice = (id: string) =>
  requestJson<NoticeDetail>(`/api/notices/${encodeURIComponent(id)}/extract`, { method: 'POST' })
export const confirmNotice = (id: string, payload: NoticeConfirmPayload) =>
  requestJson<NoticeDetail>(`/api/notices/${encodeURIComponent(id)}/confirm`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
