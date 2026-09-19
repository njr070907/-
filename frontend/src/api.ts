export type NoticeSummary = {
  id: string
  title: string | null
  source_name: string | null
  published_at: string | null
  source_type: string
  parse_status: string
}

export type NoticeDetail = NoticeSummary & {
  raw_text: string
  source_url: string | null
  collected_by: string | null
  collected_at: string | null
  imported_at: string
  created_at: string
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`)
  if (!response.ok) throw new Error(`API request failed: ${response.status}`)
  return response.json() as Promise<T>
}

export const getHealth = () => getJson<{ status: string }>('/health')
export const getNotices = () => getJson<NoticeSummary[]>('/api/notices')
export const getNotice = (id: string) =>
  getJson<NoticeDetail>(`/api/notices/${encodeURIComponent(id)}`)
