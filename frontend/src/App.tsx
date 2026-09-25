import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react'
import { SlidingIndicator } from './SlidingIndicator'

import {
  compareMatterNotices,
  confirmNotice,
  createNotice,
  deleteDraftNotice,
  extractNotice,
  getHealth,
  getMatter,
  getMatters,
  getNotice,
  getNotices,
  getWeekTasks,
  updateNotice,
  updateTask,
  type Evidence,
  type MatterDetail,
  type MatterSummary,
  type NoticeDetail,
  type NoticeExtraction,
  type NoticeSummary,
  type Task,
  type VersionComparison,
} from './api'

type View = 'add' | 'matters' | 'week' | 'search'
type MatterMode = 'new' | 'existing'

const emptyExtraction: NoticeExtraction = {
  matter_name: '',
  audience: [],
  stage: '',
  deadline: null,
  submit_channel: '',
  materials: [],
  explicit_change: '',
  confidence: 0,
  evidence: [],
}

const viewMeta: Record<View, { label: string; eyebrow: string }> = {
  add: { label: '添加通知', eyebrow: '把分散消息变成清楚行动' },
  matters: { label: '事项', eyebrow: '同一件事的通知都在这里' },
  week: { label: '我的本周', eyebrow: '只看已经确认的截止事项' },
  search: { label: '搜索', eyebrow: '回到原文，不靠模糊记忆' },
}

const fieldLabels: Record<string, string> = {
  matter_name: '事项名称',
  audience: '适用对象',
  stage: '办理阶段',
  deadline: '截止时间',
  submit_channel: '提交入口',
  materials: '材料要求',
  explicit_change: '明确变更',
}

function splitList(value: string): string[] {
  return value.split(/[、,，;；\n]/).map((item) => item.trim()).filter(Boolean)
}

function displayValue(value: string | string[] | null): string {
  if (Array.isArray(value)) return value.length ? value.join('、') : '未填写'
  return value || '未填写'
}

function formatDeadline(value: string | null): string {
  if (!value) return '待确认'
  return value.replace('T', ' ')
}

function noticeTitle(notice: Pick<NoticeSummary, 'title' | 'id'>): string {
  return notice.title?.trim() || `未命名通知 · ${notice.id.slice(-6)}`
}

function Icon({ name }: { name: View }) {
  const paths: Record<View, ReactNode> = {
    add: <><path d="M12 5v14M5 12h14" /><rect x="3" y="3" width="18" height="18" rx="5" /></>,
    matters: <><path d="M5 7h14M5 12h14M5 17h9" /><circle cx="3" cy="7" r=".5" /><circle cx="3" cy="12" r=".5" /><circle cx="3" cy="17" r=".5" /></>,
    week: <><rect x="3" y="5" width="18" height="16" rx="4" /><path d="M8 3v4M16 3v4M3 10h18M8 15l2 2 5-5" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m16 16 5 5" /></>,
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24">{paths[name]}</svg>
}

function StatusPill({ status }: { status: NoticeSummary['parse_status'] }) {
  const text = status === 'confirmed' ? '已确认' : status === 'review_required' ? '待核对' : '未提取'
  return <span className={`status status-${status}`}>{text}</span>
}

function EvidenceList({ items, field }: { items: Evidence[]; field: string }) {
  const matching = items.filter((item) => item.field === field)
  if (!matching.length) return null
  return (
    <details className="evidence">
      <summary>查看原文依据</summary>
      {matching.map((item, index) => <blockquote key={`${item.field}-${index}`}>{item.text}</blockquote>)}
    </details>
  )
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <span aria-hidden="true">○</span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  )
}

function App({ embedded = false }: { embedded?: boolean }) {
  const [view, setView] = useState<View>('add')
  const [connected, setConnected] = useState<boolean | null>(null)
  const [globalError, setGlobalError] = useState('')
  const [toast, setToast] = useState('')

  const [title, setTitle] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [rawText, setRawText] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [reviewNotice, setReviewNotice] = useState<NoticeDetail | null>(null)
  const [draftNoticeId, setDraftNoticeId] = useState<string | null>(null)
  const [extraction, setExtraction] = useState<NoticeExtraction>(emptyExtraction)
  const [matterMode, setMatterMode] = useState<MatterMode>('new')
  const [newMatterName, setNewMatterName] = useState('')
  const [existingMatterId, setExistingMatterId] = useState('')
  const [includeTask, setIncludeTask] = useState(true)

  const [matters, setMatters] = useState<MatterSummary[]>([])
  const [matterDetail, setMatterDetail] = useState<MatterDetail | null>(null)
  const [matterLoading, setMatterLoading] = useState(false)
  const [previousNoticeId, setPreviousNoticeId] = useState('')
  const [currentNoticeId, setCurrentNoticeId] = useState('')
  const [comparison, setComparison] = useState<VersionComparison | null>(null)
  const [openNotice, setOpenNotice] = useState<NoticeDetail | null>(null)

  const [tasks, setTasks] = useState<Task[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<NoticeSummary[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    getHealth().then(() => setConnected(true)).catch(() => setConnected(false))
    void refreshMatters()
  }, [])

  useEffect(() => {
    setGlobalError('')
    if (view === 'matters') void refreshMatters()
    if (view === 'week') void refreshTasks()
  }, [view])

  const confirmedNotices = useMemo(
    () => matterDetail?.notices.filter((notice) => notice.parse_status === 'confirmed') ?? [],
    [matterDetail],
  )

  async function refreshMatters() {
    try {
      setMatters(await getMatters())
    } catch (cause) {
      setGlobalError(messageFrom(cause, '无法读取事项'))
    }
  }

  async function refreshTasks() {
    setTasksLoading(true)
    try {
      setTasks(await getWeekTasks())
    } catch (cause) {
      setGlobalError(messageFrom(cause, '无法读取本周待办'))
    } finally {
      setTasksLoading(false)
    }
  }

  function navigate(next: View) {
    setToast('')
    setView(next)
    if (next !== 'add') setReviewNotice(null)
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    setFormError('')
    setToast('')
    if (!rawText.trim()) {
      setFormError('请粘贴通知原文')
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: title.trim() || null,
        source_name: sourceName.trim() || null,
        source_url: sourceUrl.trim() || null,
        raw_text: rawText.trim(),
      }
      const saved = draftNoticeId
        ? await updateNotice(draftNoticeId, payload)
        : await createNotice(payload)
      setDraftNoticeId(saved.id)
      const extracted = await extractNotice(saved.id)
      const fields = extracted.extracted_json ?? emptyExtraction
      setReviewNotice(extracted)
      setExtraction(fields)
      setNewMatterName(fields.matter_name || title.trim())
      setMatterMode('new')
      setExistingMatterId('')
      setIncludeTask(Boolean(fields.stage || fields.deadline || fields.submit_channel || fields.materials.length))
      await refreshMatters()
    } catch (cause) {
      setFormError(messageFrom(cause, '保存或提取失败，请稍后重试'))
    } finally {
      setSaving(false)
    }
  }

  function updateExtraction<K extends keyof NoticeExtraction>(key: K, value: NoticeExtraction[K]) {
    setExtraction((current) => ({ ...current, [key]: value }))
  }

  async function handleConfirm(event: FormEvent) {
    event.preventDefault()
    if (!reviewNotice) return
    setFormError('')
    if (matterMode === 'new' && !newMatterName.trim()) {
      setFormError('请填写新事项名称')
      return
    }
    if (matterMode === 'existing' && !existingMatterId) {
      setFormError('请选择要关联的已有事项')
      return
    }
    if (includeTask && !extraction.stage.trim()) {
      setFormError('创建待办时必须填写办理阶段')
      return
    }
    setSaving(true)
    try {
      const confirmed = await confirmNotice(reviewNotice.id, {
        extraction,
        ...(matterMode === 'new'
          ? { new_matter_name: newMatterName.trim() }
          : { matter_id: existingMatterId }),
        ...(includeTask ? {
          task: {
            stage: extraction.stage.trim(),
            deadline: extraction.deadline || null,
            submit_channel: extraction.submit_channel.trim(),
            materials: extraction.materials,
          },
        } : {}),
      })
      setTitle('')
      setSourceName('')
      setSourceUrl('')
      setRawText('')
      setReviewNotice(null)
      setDraftNoticeId(null)
      await refreshMatters()
      setToast('通知已确认并归入事项')
      setView('matters')
      if (confirmed.matter_id) await openMatter(confirmed.matter_id)
    } catch (cause) {
      setFormError(messageFrom(cause, '确认失败，请检查填写内容'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDiscard() {
    if (!reviewNotice) return
    setFormError('')
    setSaving(true)
    try {
      await deleteDraftNotice(reviewNotice.id)
      setTitle('')
      setSourceName('')
      setSourceUrl('')
      setRawText('')
      setReviewNotice(null)
      setDraftNoticeId(null)
      setToast('已放弃这条草稿')
    } catch (cause) {
      setFormError(messageFrom(cause, '放弃草稿失败，请稍后重试'))
    } finally {
      setSaving(false)
    }
  }

  async function openMatter(id: string) {
    setMatterLoading(true)
    setComparison(null)
    setPreviousNoticeId('')
    setCurrentNoticeId('')
    try {
      setMatterDetail(await getMatter(id))
    } catch (cause) {
      setGlobalError(messageFrom(cause, '无法读取事项详情'))
    } finally {
      setMatterLoading(false)
    }
  }

  async function handleCompare() {
    if (!matterDetail || !previousNoticeId || !currentNoticeId) return
    setGlobalError('')
    try {
      setComparison(await compareMatterNotices(matterDetail.id, previousNoticeId, currentNoticeId))
    } catch (cause) {
      setGlobalError(messageFrom(cause, '版本对比失败'))
    }
  }

  async function showNotice(id: string) {
    try {
      setOpenNotice(await getNotice(id))
    } catch (cause) {
      setGlobalError(messageFrom(cause, '无法读取通知原文'))
    }
  }

  async function toggleTask(task: Task) {
    try {
      const updated = await updateTask(task.id, !task.completed)
      setTasks((current) => current.map((item) => item.id === updated.id ? updated : item))
      if (matterDetail) {
        setMatterDetail({
          ...matterDetail,
          tasks: matterDetail.tasks.map((item) => item.id === updated.id ? updated : item),
        })
      }
    } catch (cause) {
      setGlobalError(messageFrom(cause, '待办状态更新失败'))
    }
  }

  async function handleSearch(event: FormEvent) {
    event.preventDefault()
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      setSearchResults(await getNotices(searchQuery))
    } catch (cause) {
      setGlobalError(messageFrom(cause, '搜索失败'))
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className={embedded ? 'app-shell workflow-shell is-embedded' : 'app-shell'}>
      <aside className="side-rail" aria-label="主导航">
        <Brand connected={connected} />
        <nav className="nav-list">
          {embedded && <SlidingIndicator activeKey={view} className="workflow-nav-indicator" />}
          {(Object.keys(viewMeta) as View[]).map((item) => (
            <button
              aria-current={view === item ? 'page' : undefined}
              className={view === item ? 'nav-item is-active' : 'nav-item'}
              data-motion-key={item}
              key={item}
              onClick={() => navigate(item)}
              type="button"
            >
              <Icon name={item} />
              <span>{viewMeta[item].label}</span>
            </button>
          ))}
        </nav>
        <p className="rail-note">所有结论都能回到原文核对</p>
      </aside>

      <main className="workspace">
        <header className="page-header">
          <div>
            <p className="eyebrow">{viewMeta[view].eyebrow}</p>
            <h1>{viewMeta[view].label}</h1>
          </div>
          <span className={connected ? 'connection is-online' : 'connection'}>
            <i />{connected === null ? '连接中' : connected ? '服务正常' : '服务未连接'}
          </span>
        </header>

        {globalError && <div className="message message-error" role="alert">{globalError}</div>}
        {toast && <div className="message message-success" role="status">{toast}</div>}

        {view === 'add' && (
          reviewNotice
            ? <ReviewForm
                extraction={extraction}
                formError={formError}
                includeTask={includeTask}
                matterMode={matterMode}
                matters={matters}
                newMatterName={newMatterName}
                existingMatterId={existingMatterId}
                notice={reviewNotice}
                saving={saving}
                onBack={() => setReviewNotice(null)}
                onConfirm={handleConfirm}
                onDiscard={() => void handleDiscard()}
                onExtractionChange={updateExtraction}
                onExistingMatterChange={setExistingMatterId}
                onIncludeTaskChange={setIncludeTask}
                onMatterModeChange={setMatterMode}
                onNewMatterNameChange={setNewMatterName}
              />
            : <AddNoticeForm
                error={formError}
                rawText={rawText}
                saving={saving}
                sourceName={sourceName}
                sourceUrl={sourceUrl}
                title={title}
                onRawTextChange={setRawText}
                onSourceNameChange={setSourceName}
                onSourceUrlChange={setSourceUrl}
                onSubmit={handleAdd}
                onTitleChange={setTitle}
              />
        )}

        {view === 'matters' && (
          <MattersView
            comparison={comparison}
            confirmedNotices={confirmedNotices}
            currentNoticeId={currentNoticeId}
            detail={matterDetail}
            loading={matterLoading}
            matters={matters}
            previousNoticeId={previousNoticeId}
            onCompare={handleCompare}
            onCurrentChange={setCurrentNoticeId}
            onOpenMatter={(id) => void openMatter(id)}
            onOpenNotice={(id) => void showNotice(id)}
            onPreviousChange={setPreviousNoticeId}
          />
        )}

        {view === 'week' && (
          <WeekView loading={tasksLoading} tasks={tasks} onToggle={(task) => void toggleTask(task)} />
        )}

        {view === 'search' && (
          <SearchView
            query={searchQuery}
            results={searchResults}
            searching={searching}
            onOpen={(id) => void showNotice(id)}
            onQueryChange={setSearchQuery}
            onSubmit={handleSearch}
          />
        )}
      </main>

      <nav className="bottom-nav" aria-label="主导航">
        {(Object.keys(viewMeta) as View[]).map((item) => (
          <button
            aria-current={view === item ? 'page' : undefined}
            className={view === item ? 'is-active' : ''}
            key={item}
            onClick={() => navigate(item)}
            type="button"
          >
            <Icon name={item} />
            <span>{viewMeta[item].label}</span>
          </button>
        ))}
      </nav>

      {openNotice && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setOpenNotice(null)}>
          <section className="notice-drawer" role="dialog" aria-modal="true" aria-labelledby="notice-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="drawer-handle" />
            <button className="text-button drawer-close" onClick={() => setOpenNotice(null)} type="button">关闭</button>
            <p className="eyebrow">通知原文</p>
            <h2 id="notice-title">{noticeTitle(openNotice)}</h2>
            <div className="source-row"><span>{openNotice.source_name || '未提供来源'}</span><StatusPill status={openNotice.parse_status} /></div>
            <pre className="raw-copy">{openNotice.raw_text}</pre>
            {openNotice.source_url && <a className="source-link" href={openNotice.source_url} rel="noreferrer" target="_blank">打开来源链接 ↗</a>}
          </section>
        </div>
      )}
    </div>
  )
}

function Brand({ connected }: { connected: boolean | null }) {
  return (
    <div className="brand">
      <span className="brand-mark">校</span>
      <div><strong>校事清</strong><small>{connected ? '已连接' : 'MVP'}</small></div>
    </div>
  )
}

type AddNoticeProps = {
  title: string
  sourceName: string
  sourceUrl: string
  rawText: string
  saving: boolean
  error: string
  onTitleChange: (value: string) => void
  onSourceNameChange: (value: string) => void
  onSourceUrlChange: (value: string) => void
  onRawTextChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
}

function AddNoticeForm(props: AddNoticeProps) {
  return (
    <section className="content-panel add-panel">
      <div className="section-intro">
        <span className="step-index">01</span>
        <div><h2>粘贴一条通知</h2><p>先保存原文，再提取事项、日期与材料。提取结果必须由你确认。</p></div>
      </div>
      <form onSubmit={props.onSubmit} noValidate>
        <div className="form-grid">
          <label><span>通知标题 <em>可空</em></span><input value={props.title} onChange={(event) => props.onTitleChange(event.target.value)} placeholder="例如：奖学金材料提交通知" /></label>
          <label><span>来源名称 <em>可空</em></span><input value={props.sourceName} onChange={(event) => props.onSourceNameChange(event.target.value)} placeholder="例如：电子信息学院" /></label>
          <label className="full-field"><span>来源链接 <em>可空</em></span><input inputMode="url" type="url" value={props.sourceUrl} onChange={(event) => props.onSourceUrlChange(event.target.value)} placeholder="https://..." /></label>
          <label className="full-field"><span>原文正文 <b>必填</b></span><textarea rows={12} value={props.rawText} onChange={(event) => props.onRawTextChange(event.target.value)} placeholder="请完整粘贴通知，不要只粘贴摘要……" /></label>
        </div>
        {props.error && <p className="field-error" role="alert">{props.error}</p>}
        <div className="form-actions"><p>系统不会自动登录或抓取学校平台</p><button className="primary-button" disabled={props.saving} type="submit">{props.saving ? '正在保存与提取…' : '保存并提取'}<span>→</span></button></div>
      </form>
    </section>
  )
}

type ReviewProps = {
  notice: NoticeDetail
  extraction: NoticeExtraction
  matters: MatterSummary[]
  matterMode: MatterMode
  newMatterName: string
  existingMatterId: string
  includeTask: boolean
  saving: boolean
  formError: string
  onExtractionChange: <K extends keyof NoticeExtraction>(key: K, value: NoticeExtraction[K]) => void
  onMatterModeChange: (value: MatterMode) => void
  onNewMatterNameChange: (value: string) => void
  onExistingMatterChange: (value: string) => void
  onIncludeTaskChange: (value: boolean) => void
  onConfirm: (event: FormEvent) => void
  onBack: () => void
  onDiscard: () => void
}

function ReviewForm(props: ReviewProps) {
  const { extraction } = props
  return (
    <section className="content-panel review-panel">
      <div className="section-intro">
        <span className="step-index">02</span>
        <div><h2>核对提取结果</h2><p>自动提取只是草稿。请对照原文修改后，再归入事项。</p></div>
      </div>
      <div className="review-progress"><span style={{ width: `${Math.round(extraction.confidence * 100)}%` }} /><p>已识别 {Math.round(extraction.confidence * 100)}% 的关键字段</p></div>
      <form onSubmit={props.onConfirm}>
        <div className="review-grid">
          <ReviewField label="事项名称" evidence={extraction.evidence} field="matter_name"><input value={extraction.matter_name} onChange={(event) => props.onExtractionChange('matter_name', event.target.value)} /></ReviewField>
          <ReviewField label="适用对象" evidence={extraction.evidence} field="audience"><input value={extraction.audience.join('、')} onChange={(event) => props.onExtractionChange('audience', splitList(event.target.value))} placeholder="多个对象用顿号分隔" /></ReviewField>
          <ReviewField label="办理阶段" evidence={extraction.evidence} field="stage"><input value={extraction.stage} onChange={(event) => props.onExtractionChange('stage', event.target.value)} placeholder="例如：学院初审" /></ReviewField>
          <ReviewField label="截止时间" evidence={extraction.evidence} field="deadline"><input type="datetime-local" value={extraction.deadline ?? ''} onChange={(event) => props.onExtractionChange('deadline', event.target.value || null)} />{!extraction.deadline && <p className="inline-warning">原文日期不完整，请确认；不会自动填当前年份。</p>}</ReviewField>
          <ReviewField label="提交入口" evidence={extraction.evidence} field="submit_channel"><input value={extraction.submit_channel} onChange={(event) => props.onExtractionChange('submit_channel', event.target.value)} /></ReviewField>
          <ReviewField label="材料要求" evidence={extraction.evidence} field="materials"><input value={extraction.materials.join('、')} onChange={(event) => props.onExtractionChange('materials', splitList(event.target.value))} placeholder="多个材料用顿号分隔" /></ReviewField>
          <ReviewField label="明确变更" evidence={extraction.evidence} field="explicit_change" full><textarea rows={3} value={extraction.explicit_change} onChange={(event) => props.onExtractionChange('explicit_change', event.target.value)} /></ReviewField>
        </div>

        <details className="raw-reference"><summary>展开完整原文</summary><pre>{props.notice.raw_text}</pre></details>

        <fieldset className="matter-choice">
          <legend>归入事项</legend>
          <div className="segmented-control">
            <label><input checked={props.matterMode === 'new'} name="matter-mode" onChange={() => props.onMatterModeChange('new')} type="radio" /><span>新建事项</span></label>
            <label><input checked={props.matterMode === 'existing'} name="matter-mode" onChange={() => props.onMatterModeChange('existing')} type="radio" /><span>关联已有事项</span></label>
          </div>
          {props.matterMode === 'new'
            ? <label><span>新事项名称</span><input value={props.newMatterName} onChange={(event) => props.onNewMatterNameChange(event.target.value)} /></label>
            : <label><span>选择事项</span><select value={props.existingMatterId} onChange={(event) => props.onExistingMatterChange(event.target.value)}><option value="">请选择</option>{props.matters.map((matter) => <option key={matter.id} value={matter.id}>{matter.name}</option>)}</select></label>}
        </fieldset>

        <label className="task-switch"><input checked={props.includeTask} onChange={(event) => props.onIncludeTaskChange(event.target.checked)} type="checkbox" /><span><strong>同时创建待办</strong><small>使用上方的阶段、时间、入口和材料</small></span></label>
        {props.formError && <p className="field-error" role="alert">{props.formError}</p>}
        <div className="form-actions"><button className="text-button" disabled={props.saving} onClick={props.onDiscard} type="button">放弃草稿</button><button className="secondary-button" onClick={props.onBack} type="button">返回修改原文</button><button className="primary-button" disabled={props.saving} type="submit">{props.saving ? '正在确认…' : '确认并保存'}<span>✓</span></button></div>
      </form>
    </section>
  )
}

function ReviewField({ label, evidence, field, full = false, children }: { label: string; evidence: Evidence[]; field: string; full?: boolean; children: ReactNode }) {
  return <label className={full ? 'review-field full-field' : 'review-field'}><span>{label}</span>{children}<EvidenceList field={field} items={evidence} /></label>
}

type MattersProps = {
  matters: MatterSummary[]
  detail: MatterDetail | null
  loading: boolean
  confirmedNotices: NoticeSummary[]
  previousNoticeId: string
  currentNoticeId: string
  comparison: VersionComparison | null
  onOpenMatter: (id: string) => void
  onOpenNotice: (id: string) => void
  onPreviousChange: (id: string) => void
  onCurrentChange: (id: string) => void
  onCompare: () => void
}

function MattersView(props: MattersProps) {
  if (!props.matters.length) return <EmptyState title="还没有事项" detail="先添加一条通知，核对后新建第一个事项。" />
  return (
    <div className="split-view">
      <section className="matter-list" aria-label="事项列表">
        <p className="list-kicker">全部事项 · {props.matters.length}</p>
        {props.matters.map((matter, index) => <button className={props.detail?.id === matter.id ? 'matter-row is-selected' : 'matter-row'} key={matter.id} onClick={() => props.onOpenMatter(matter.id)} type="button"><span>{String(index + 1).padStart(2, '0')}</span><strong>{matter.name}</strong><i>→</i></button>)}
      </section>
      <section className="matter-detail">
        {props.loading && <p className="loading-line">正在读取事项…</p>}
        {!props.loading && !props.detail && <EmptyState title="选择一个事项" detail="查看它的通知版本、办理环节和变化。" />}
        {props.detail && <>
          <div className="detail-title"><p className="eyebrow">事项详情</p><h2>{props.detail.name}</h2><p>{props.detail.notices.length} 个通知版本 · {props.detail.tasks.length} 个办理环节</p></div>
          <h3 className="subheading">通知版本</h3>
          <div className="version-list">{props.detail.notices.map((notice) => <article key={notice.id}><div><StatusPill status={notice.parse_status} /><strong>{noticeTitle(notice)}</strong><small>{notice.source_name || '未提供来源'}</small></div><button className="text-button" onClick={() => props.onOpenNotice(notice.id)} type="button">查看原文</button></article>)}</div>
          <div className="compare-block">
            <div><h3>对比两个版本</h3><p>只比较日期、对象、入口和材料，不判断哪一版更正确。</p></div>
            {props.confirmedNotices.length < 2
              ? <p className="inline-warning">至少需要两条已确认通知才能对比。</p>
              : <div className="compare-controls"><select aria-label="较早版本" value={props.previousNoticeId} onChange={(event) => props.onPreviousChange(event.target.value)}><option value="">选择原版本</option>{props.confirmedNotices.map((notice) => <option key={notice.id} value={notice.id}>{noticeTitle(notice)}</option>)}</select><span>→</span><select aria-label="较新版本" value={props.currentNoticeId} onChange={(event) => props.onCurrentChange(event.target.value)}><option value="">选择新版本</option>{props.confirmedNotices.map((notice) => <option key={notice.id} value={notice.id}>{noticeTitle(notice)}</option>)}</select><button className="secondary-button" disabled={!props.previousNoticeId || !props.currentNoticeId || props.previousNoticeId === props.currentNoticeId} onClick={props.onCompare} type="button">开始对比</button></div>}
            {props.comparison && <div className="diff-list">{props.comparison.changes.length ? props.comparison.changes.map((change) => <article key={change.field}><strong>{fieldLabels[change.field]}</strong><div><span>{displayValue(change.before)}</span><b>→</b><span>{displayValue(change.after)}</span></div></article>) : <p className="no-diff">四个关键字段没有变化。</p>}</div>}
          </div>
          <h3 className="subheading">办理环节</h3>
          <div className="task-list compact">{props.detail.tasks.length ? props.detail.tasks.map((task) => <article key={task.id}><time>{formatDeadline(task.deadline)}</time><div><strong>{task.stage}</strong><p>{task.submit_channel || '未填写提交入口'}</p></div><span className={task.completed ? 'done-tag' : 'pending-tag'}>{task.completed ? '已完成' : '待处理'}</span></article>) : <p>暂无待办。</p>}</div>
        </>}
      </section>
    </div>
  )
}

function WeekView({ tasks, loading, onToggle }: { tasks: Task[]; loading: boolean; onToggle: (task: Task) => void }) {
  if (loading) return <p className="loading-line">正在整理本周待办…</p>
  if (!tasks.length) return <EmptyState title="本周暂时清空" detail="只有日期明确、已经人工确认的任务才会出现在这里。" />
  return (
    <section className="week-board">
      <div className="week-summary"><div><span>{tasks.filter((task) => !task.completed).length}</span><p>项尚未完成</p></div><p>勾选完成后仍会保留记录，你可以随时取消。</p></div>
      <div className="task-list">{tasks.map((task) => <label className={task.completed ? 'task-card is-complete' : 'task-card'} key={task.id}><input checked={task.completed} onChange={() => onToggle(task)} type="checkbox" /><span className="checkmark">✓</span><time>{formatDeadline(task.deadline)}</time><div><strong>{task.stage}</strong><p>{task.submit_channel || '未填写提交入口'}</p>{task.materials.length > 0 && <small>材料：{task.materials.join('、')}</small>}</div></label>)}</div>
    </section>
  )
}

function SearchView({ query, results, searching, onQueryChange, onSubmit, onOpen }: { query: string; results: NoticeSummary[]; searching: boolean; onQueryChange: (value: string) => void; onSubmit: (event: FormEvent) => void; onOpen: (id: string) => void }) {
  return (
    <section className="search-view">
      <form className="search-box" onSubmit={onSubmit}><Icon name="search" /><input aria-label="搜索通知" autoFocus value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="输入通知标题或正文关键词" /><button type="submit">{searching ? '搜索中…' : '搜索'}</button></form>
      {!query && <div className="search-hint"><p>可以试试</p><button onClick={() => onQueryChange('奖学金')} type="button">奖学金</button><button onClick={() => onQueryChange('提交')} type="button">提交</button><button onClick={() => onQueryChange('截止')} type="button">截止</button></div>}
      {query && !searching && results.length === 0 && <EmptyState title="没有匹配结果" detail="换一个关键词，或检查通知是否已经保存。" />}
      <div className="search-results">{results.map((notice) => <button key={notice.id} onClick={() => onOpen(notice.id)} type="button"><div><StatusPill status={notice.parse_status} /><strong>{noticeTitle(notice)}</strong><small>{notice.source_name || '未提供来源'}</small></div><span>查看原文 →</span></button>)}</div>
    </section>
  )
}

function messageFrom(cause: unknown, fallback: string): string {
  if (!(cause instanceof Error) || !cause.message.trim()) return fallback
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(cause.message)) {
    return `${fallback}。请检查网络连接或稍后重试。`
  }
  return cause.message
}

export default App
