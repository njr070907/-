import type {
  FieldChange,
  MatterDetail,
  MatterSummary,
  NoticeConfirmInput,
  NoticeCreateInput,
  NoticeDetail,
  NoticeExtraction,
  Task,
  VersionComparison,
} from './api'
import { createOfflineSeedNotices } from './offlineSeeds'

type OfflineState = { notices: NoticeDetail[]; matters: MatterSummary[]; tasks: Task[] }
const storageKey = 'xiaoshiqing.offline.v3'
let volatileState: OfflineState | null = null

function initialState(): OfflineState {
  return { notices: createOfflineSeedNotices(), matters: [], tasks: [] }
}

function loadState(): OfflineState {
  if (volatileState) return volatileState
  try {
    const saved = localStorage.getItem(storageKey)
    volatileState = saved ? JSON.parse(saved) as OfflineState : initialState()
  } catch { volatileState = initialState() }
  return volatileState
}

function saveState(state: OfflineState) {
  volatileState = state
  try { localStorage.setItem(storageKey, JSON.stringify(state)) } catch { /* memory fallback */ }
}

function identifier(prefix: string) {
  const suffix = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replaceAll('-', '')
    : `${Date.now()}${Math.random().toString(16).slice(2)}`
  return `${prefix}_${suffix}`
}

function bodyAs<T>(init?: RequestInit): T {
  if (typeof init?.body !== 'string') throw new Error('离线请求缺少数据')
  return JSON.parse(init.body) as T
}

function noticeOrThrow(state: OfflineState, id: string) {
  const notice = state.notices.find(item => item.id === id)
  if (!notice) throw new Error('通知不存在')
  return notice
}

function matterOrThrow(state: OfflineState, id: string) {
  const matter = state.matters.find(item => item.id === id)
  if (!matter) throw new Error('事项不存在')
  return matter
}

function extractFields(rawText: string): NoticeExtraction {
  const evidence: NoticeExtraction['evidence'] = []
  const lines = rawText.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const heading = lines.find(line => /^[【[]/.test(line) || /(通知|公告)$/.test(line))?.slice(0, 200) || lines[0]?.slice(0, 200) || ''
  if (heading) evidence.push({ field: 'matter_name', text: heading })
  const pick = (field: 'audience' | 'stage' | 'materials', pattern: RegExp) => {
    const match = rawText.match(pattern)
    if (!match?.[1]) return ''
    evidence.push({ field, text: match[0].trim() })
    return match[1].trim()
  }
  const audienceText = pick('audience', /(?:适用对象|面向对象|通知对象|参加人员|对象)\s*[：:]\s*([^\n。；;]+)/)
  const stage = pick('stage', /(?:办理环节|办理阶段|阶段)\s*[：:]\s*([^\n。；;]+)/)
  const materialsText = pick('materials', /(?:材料|提交材料)(?:包括|为)?\s*[：:]\s*([^\n。；;]+)/)
  const splitList = (value: string) => value.split(/[、，,；;]/).map(item => item.trim()).filter(Boolean)
  let deadline: string | null = null
  const date = rawText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日(?:\s*(?:上午|下午)?\s*(\d{1,2})(?:(?::|：|时)(\d{1,2}))?)?/)
  if (date) {
    evidence.push({ field: 'deadline', text: date[0] })
    const day = `${date[1]}-${date[2].padStart(2, '0')}-${date[3].padStart(2, '0')}`
    deadline = date[4] ? `${day}T${date[4].padStart(2, '0')}:${(date[5] || '0').padStart(2, '0')}` : day
  }
  let submitChannel = ''
  const channel = rawText.match(/(?:提交|报送)(?:至|到|方式[：:]?)\s*([^\n。；;]+)/)
  if (channel?.[1]) { submitChannel = channel[1].trim(); evidence.push({ field: 'submit_channel', text: channel[0].trim() }) }
  const changeLine = lines.find(line => ['调整为', '变更为', '更新为', '修改为'].some(word => line.includes(word))) || ''
  if (changeLine) evidence.push({ field: 'explicit_change', text: changeLine })
  const values = [heading, audienceText, stage, deadline, submitChannel, materialsText, changeLine]
  return {
    matter_name: heading, audience: splitList(audienceText), stage, deadline,
    submit_channel: submitChannel, materials: splitList(materialsText), explicit_change: changeLine.slice(0, 300),
    confidence: Math.round(values.filter(Boolean).length / 7 * 100) / 100, evidence,
  }
}

function compareVersions(previous: NoticeExtraction, current: NoticeExtraction): Omit<VersionComparison, 'previous_notice_id' | 'current_notice_id'> {
  const labels = { deadline: '截止时间', audience: '适用对象', submit_channel: '提交入口', materials: '材料要求' }
  const fields = Object.keys(labels) as (keyof typeof labels)[]
  const changes: FieldChange[] = []
  const summary: string[] = []
  for (const field of fields) {
    const before = previous[field]
    const after = current[field]
    if (JSON.stringify(before) === JSON.stringify(after)) continue
    changes.push({ field, before, after })
    const display = (value: string | string[] | null) => !value || value.length === 0 ? '未填写' : Array.isArray(value) ? value.join('、') : value
    summary.push(`${labels[field]}：${display(before)} → ${display(after)}`)
  }
  return { changes, summary }
}

export async function offlineRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const url = new URL(path, 'https://offline.local')
  const route = url.pathname
  const method = (init?.method || 'GET').toUpperCase()
  const state = loadState()
  if (route === '/health' && method === 'GET') return { status: 'ok' } as T

  if (route === '/api/notices' && method === 'GET') {
    const query = (url.searchParams.get('query') || '').trim().toLocaleLowerCase()
    return [...state.notices].filter(notice => !query || [notice.title, notice.raw_text, ...(notice.tags ?? [])].join('\n').toLocaleLowerCase().includes(query))
      .sort((a, b) => (b.published_at || b.created_at).localeCompare(a.published_at || a.created_at)) as T
  }
  if (route === '/api/notices' && method === 'POST') {
    const payload = bodyAs<NoticeCreateInput>(init)
    const now = new Date().toISOString()
    const notice: NoticeDetail = {
      id: identifier('notice'), title: payload.title || null, raw_text: payload.raw_text,
      source_name: payload.source_name || null, source_url: payload.source_url || null,
      published_at: now, source_type: 'manual_copy', parse_status: 'raw', matter_id: null,
      audience_roles: payload.audience_roles ?? null, colleges: payload.colleges ?? null,
      majors: payload.majors ?? null, grades: payload.grades ?? null, tags: payload.tags ?? null,
      category: null, summary: payload.raw_text.slice(0, 180), description: payload.raw_text,
      deadline: payload.deadline ?? null, importance: payload.importance ?? null, required: payload.required ?? false,
      collected_by: null, collected_at: null, imported_at: now, created_at: now, extracted_json: null,
    }
    state.notices.push(notice); saveState(state); return notice as T
  }

  const extractMatch = route.match(/^\/api\/notices\/([^/]+)\/extract$/)
  if (extractMatch && method === 'POST') {
    const notice = noticeOrThrow(state, decodeURIComponent(extractMatch[1]))
    notice.extracted_json = extractFields(notice.raw_text); notice.parse_status = 'review_required'
    saveState(state); return notice as T
  }
  const confirmMatch = route.match(/^\/api\/notices\/([^/]+)\/confirm$/)
  if (confirmMatch && method === 'POST') {
    const notice = noticeOrThrow(state, decodeURIComponent(confirmMatch[1]))
    const payload = bodyAs<NoticeConfirmInput>(init)
    const matter = payload.matter_id ? matterOrThrow(state, payload.matter_id) : {
      id: identifier('matter'), name: payload.new_matter_name || payload.extraction.matter_name, created_at: new Date().toISOString(),
    }
    if (!payload.matter_id) state.matters.push(matter)
    notice.matter_id = matter.id; notice.extracted_json = payload.extraction; notice.parse_status = 'confirmed'
    if (payload.task) {
      const existing = state.tasks.find(item => item.source_notice_id === notice.id)
      if (existing) Object.assign(existing, payload.task, { matter_id: matter.id, confirmed: true })
      else state.tasks.push({ id: identifier('task'), matter_id: matter.id, source_notice_id: notice.id, confirmed: true, completed: false, created_at: new Date().toISOString(), ...payload.task })
    }
    saveState(state); return notice as T
  }
  const noticeMatch = route.match(/^\/api\/notices\/([^/]+)$/)
  if (noticeMatch && method === 'GET') return noticeOrThrow(state, decodeURIComponent(noticeMatch[1])) as T
  if (noticeMatch && method === 'DELETE') {
    const notice = noticeOrThrow(state, decodeURIComponent(noticeMatch[1]))
    if (notice.parse_status !== 'review_required' || notice.matter_id) throw new Error('只能放弃尚未确认的草稿')
    state.notices = state.notices.filter(item => item.id !== notice.id)
    saveState(state); return undefined as T
  }
  if (noticeMatch && method === 'PATCH') {
    const notice = noticeOrThrow(state, decodeURIComponent(noticeMatch[1]))
    if (notice.parse_status === 'confirmed') throw new Error('已确认的通知不能直接修改')
    const payload = bodyAs<NoticeCreateInput>(init)
    Object.assign(notice, payload, { title: payload.title || null, source_name: payload.source_name || null, source_url: payload.source_url || null, extracted_json: null, parse_status: 'raw' })
    saveState(state); return notice as T
  }
  if (route === '/api/matters' && method === 'GET') return [...state.matters].sort((a, b) => b.created_at.localeCompare(a.created_at)) as T
  const compareMatch = route.match(/^\/api\/matters\/([^/]+)\/compare$/)
  if (compareMatch && method === 'GET') {
    matterOrThrow(state, decodeURIComponent(compareMatch[1]))
    const previousId = url.searchParams.get('previous_notice_id') || ''
    const currentId = url.searchParams.get('current_notice_id') || ''
    const previous = noticeOrThrow(state, previousId); const current = noticeOrThrow(state, currentId)
    if (!previous.extracted_json || !current.extracted_json) throw new Error('请先确认两条通知的提取结果')
    return { ...compareVersions(previous.extracted_json, current.extracted_json), previous_notice_id: previousId, current_notice_id: currentId } as T
  }
  const matterMatch = route.match(/^\/api\/matters\/([^/]+)$/)
  if (matterMatch && method === 'GET') {
    const matter = matterOrThrow(state, decodeURIComponent(matterMatch[1]))
    return { ...matter, notices: state.notices.filter(item => item.matter_id === matter.id), tasks: state.tasks.filter(item => item.matter_id === matter.id) } as MatterDetail as T
  }
  if (route === '/api/tasks/week' && method === 'GET') {
    const start = url.searchParams.get('start') || new Date().toLocaleDateString('sv-SE')
    const endDate = new Date(`${start}T00:00:00`); endDate.setDate(endDate.getDate() + 7)
    const end = endDate.toLocaleDateString('sv-SE')
    return state.tasks.filter(task => task.confirmed && task.deadline && task.deadline >= start && task.deadline < end)
      .sort((a, b) => (a.deadline || '').localeCompare(b.deadline || '')) as T
  }
  const taskMatch = route.match(/^\/api\/tasks\/([^/]+)$/)
  if (taskMatch && method === 'PATCH') {
    const task = state.tasks.find(item => item.id === decodeURIComponent(taskMatch[1]))
    if (!task) throw new Error('待办不存在')
    task.completed = bodyAs<{ completed: boolean }>(init).completed; saveState(state); return task as T
  }
  throw new Error(`离线版不支持该操作：${method} ${route}`)
}
