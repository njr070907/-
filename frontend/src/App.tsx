import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  confirmNotice,
  createNotice,
  extractNotice,
  getHealth,
  getMatters,
  type MatterSummary,
  type NoticeDetail,
  type NoticeExtraction,
} from './api'

type Stage = 'compose' | 'review' | 'success'
type MatterMode = 'new' | 'existing'

const fieldLabels: Record<string, string> = {
  matter_name: '事项名称',
  audience: '适用对象',
  stage: '办理阶段',
  deadline: '截止时间',
  submit_channel: '提交入口',
  materials: '材料要求',
  explicit_change: '明确变更',
}

const demoText = `关于开展2026年秋季学期家庭经济困难学生认定工作的通知

各学院：
为做好我校2026年秋季学期家庭经济困难学生认定工作，现将有关事项通知如下：

一、适用对象
我校全日制在校本科生、研究生。

二、办理时间
请于2026年9月25日18:00前完成网上申报并提交相关材料，逾期不予受理。

三、提交方式
登录“学生事务服务平台”，在“资助服务—困难认定”模块填写信息并上传材料。

四、材料要求
1. 家庭经济困难学生认定申请表；
2. 相关佐证材料。`

function splitItems(value: string): string[] {
  return value.split(/[\n；;]/).map((item) => item.trim()).filter(Boolean)
}

function AppHeader({ connected }: { connected: boolean }) {
  return (
    <header className="app-header">
      <div className="brand">
        <strong>校事清</strong>
        <span>让校园通知，变成可执行的事项</span>
      </div>
      <nav aria-label="主要功能">
        <button className="nav-item active" type="button">＋ 添加通知</button>
        <button className="nav-item" type="button" disabled>事项</button>
        <button className="nav-item" type="button" disabled>我的本周</button>
        <button className="nav-item" type="button" disabled>搜索</button>
      </nav>
      <div className={`connection ${connected ? 'online' : ''}`}>
        <span aria-hidden="true" />{connected ? '服务正常' : '服务未连接'}
      </div>
    </header>
  )
}

function Progress({ stage }: { stage: Stage }) {
  const current = stage === 'compose' ? 1 : stage === 'review' ? 2 : 4
  return (
    <ol className="progress" aria-label="处理进度">
      {['粘贴文本', '编辑字段', '核对依据', '确认保存'].map((label, index) => (
        <li className={current >= index + 1 ? 'active' : ''} key={label}>
          <span>{index + 1}</span><b>{label}</b>
        </li>
      ))}
    </ol>
  )
}

type ComposeProps = {
  rawText: string
  sourceName: string
  sourceUrl: string
  busy: boolean
  onRawText: (value: string) => void
  onSourceName: (value: string) => void
  onSourceUrl: (value: string) => void
  onSubmit: (event: FormEvent) => void
}

function ComposePanel(props: ComposeProps) {
  return (
    <div className="compose-layout">
      <form className="panel compose-panel" onSubmit={props.onSubmit}>
        <div className="section-heading">
          <span>01</span>
          <div><h1>粘贴通知文本</h1><p>从学校网站、学院通知或微信群复制正文</p></div>
        </div>
        <label className="field">
          <span>通知正文 <em>*</em></span>
          <textarea
            autoFocus
            required
            value={props.rawText}
            onChange={(event) => props.onRawText(event.target.value)}
            placeholder="请粘贴完整通知，保留日期、提交入口和材料要求……"
          />
          <small>{props.rawText.trim().length} 字</small>
        </label>
        <div className="source-grid">
          <label className="field"><span>来源名称</span><input value={props.sourceName} onChange={(event) => props.onSourceName(event.target.value)} placeholder="如：学校公文通" /></label>
          <label className="field"><span>原文链接</span><input type="url" value={props.sourceUrl} onChange={(event) => props.onSourceUrl(event.target.value)} placeholder="https://（可不填）" /></label>
        </div>
        <div className="actions">
          <button className="ghost-button" type="button" onClick={() => props.onRawText(demoText)}>填入演示通知</button>
          <button className="primary-button" type="submit" disabled={props.busy || !props.rawText.trim()}>{props.busy ? '正在提取…' : '提取关键信息 →'}</button>
        </div>
      </form>
      <aside className="panel explainer">
        <p className="eyebrow">只需要一分钟</p>
        <h2>我们只整理原文中明确写出的内容</h2>
        <div className="explainer-step"><b>1</b><div><strong>自动提取</strong><p>识别事项、对象、时间、入口和材料。</p></div></div>
        <div className="explainer-step"><b>2</b><div><strong>人工核对</strong><p>所有字段都可以修改，并能看到原文依据。</p></div></div>
        <div className="explainer-step"><b>3</b><div><strong>保存事项</strong><p>确认后生成任务，之后可归入“我的本周”。</p></div></div>
        <div className="boundary-note"><strong>信息边界</strong><p>系统不会猜测缺失日期，也不会自动登录学校公文通。</p></div>
      </aside>
    </div>
  )
}

type ReviewProps = {
  extraction: NoticeExtraction
  rawText: string
  notice: NoticeDetail
  matters: MatterSummary[]
  matterMode: MatterMode
  newMatterName: string
  selectedMatterId: string
  createTask: boolean
  busy: boolean
  onExtraction: (next: NoticeExtraction) => void
  onMode: (mode: MatterMode) => void
  onNewMatterName: (value: string) => void
  onSelectedMatterId: (value: string) => void
  onCreateTask: (value: boolean) => void
  onBack: () => void
  onSubmit: (event: FormEvent) => void
}

function ReviewPanel(props: ReviewProps) {
  const update = <K extends keyof NoticeExtraction>(key: K, value: NoticeExtraction[K]) => props.onExtraction({ ...props.extraction, [key]: value })
  const evidence = useMemo(() => props.extraction.evidence.filter((item) => item.text.trim()), [props.extraction.evidence])
  return (
    <form className="review-grid" onSubmit={props.onSubmit}>
      <section className="panel review-fields">
        <div className="section-heading"><span>02</span><div><h1>核对并编辑字段</h1><p>请以原文为准，确认后再保存</p></div></div>
        <label className="field"><span>事项名称 <em>*</em></span><input required value={props.extraction.matter_name} onChange={(event) => update('matter_name', event.target.value)} /></label>
        <label className="field"><span>适用对象</span><textarea className="compact" value={props.extraction.audience.join('\n')} onChange={(event) => update('audience', splitItems(event.target.value))} placeholder="每行一项" /></label>
        <label className="field"><span>办理阶段 <em>*</em></span><input required value={props.extraction.stage} onChange={(event) => update('stage', event.target.value)} /></label>
        <label className="field"><span>截止时间</span><input value={props.extraction.deadline ?? ''} onChange={(event) => update('deadline', event.target.value || null)} placeholder="YYYY-MM-DD 或 YYYY-MM-DDTHH:mm" /></label>
        {!props.extraction.deadline && <p className="warning">未从原文识别到完整日期。你可以留空，系统不会猜测。</p>}
        <label className="field"><span>提交入口</span><input value={props.extraction.submit_channel} onChange={(event) => update('submit_channel', event.target.value)} /></label>
        <label className="field"><span>材料要求</span><textarea className="compact" value={props.extraction.materials.join('\n')} onChange={(event) => update('materials', splitItems(event.target.value))} placeholder="每行一项" /></label>
        <label className="field"><span>明确变更</span><input value={props.extraction.explicit_change} onChange={(event) => update('explicit_change', event.target.value)} placeholder="如：截止时间调整为……" /></label>
      </section>

      <section className="panel evidence-panel">
        <div className="section-heading"><span>03</span><div><h2>原文依据</h2><p>点击字段时，可在这里核对原句</p></div></div>
        {evidence.length ? evidence.map((item, index) => (
          <article className="evidence-card" key={`${item.field}-${index}`}>
            <strong>{fieldLabels[item.field] ?? item.field}</strong>
            <blockquote>“{item.text}”</blockquote>
          </article>
        )) : <p className="empty-note">本条通知暂无可定位的原文依据，请直接阅读下方原文核对。</p>}
        <details className="raw-details"><summary>查看完整原文</summary><pre>{props.rawText}</pre></details>
      </section>

      <section className="panel confirm-panel">
        <div className="section-heading"><span>04</span><div><h2>确认并保存</h2><p>归入事项，可选生成任务</p></div></div>
        <fieldset>
          <legend>归入事项</legend>
          <label className="choice"><input type="radio" checked={props.matterMode === 'new'} onChange={() => props.onMode('new')} /><span><b>新建事项</b><small>为这条通知创建一个事项</small></span></label>
          {props.matterMode === 'new' && <input required value={props.newMatterName} onChange={(event) => props.onNewMatterName(event.target.value)} placeholder="事项名称" />}
          <label className="choice"><input type="radio" checked={props.matterMode === 'existing'} onChange={() => props.onMode('existing')} /><span><b>添加到已有事项</b><small>适合补充通知或时间变更</small></span></label>
          {props.matterMode === 'existing' && (
            <select required value={props.selectedMatterId} onChange={(event) => props.onSelectedMatterId(event.target.value)}>
              <option value="">选择已有事项</option>
              {props.matters.map((matter) => <option value={matter.id} key={matter.id}>{matter.name}</option>)}
            </select>
          )}
        </fieldset>
        <fieldset>
          <legend>任务设置</legend>
          <label className="choice checkbox"><input type="checkbox" checked={props.createTask} onChange={(event) => props.onCreateTask(event.target.checked)} /><span><b>生成一条待办任务</b><small>{props.extraction.deadline ? `截止 ${props.extraction.deadline.replace('T', ' ')}` : '当前没有明确截止时间'}</small></span></label>
        </fieldset>
        <div className="confidence"><span>提取置信度</span><b>{Math.round(props.extraction.confidence * 100)}%</b></div>
        <div className="confirm-actions"><button className="text-button" type="button" onClick={props.onBack}>返回修改原文</button><button className="primary-button" type="submit" disabled={props.busy}>{props.busy ? '正在保存…' : '保存到我的事项'}</button></div>
      </section>
    </form>
  )
}

function SuccessPanel({ notice, onAgain }: { notice: NoticeDetail; onAgain: () => void }) {
  return (
    <section className="panel success-panel">
      <span className="success-icon">✓</span>
      <p className="eyebrow">保存成功</p>
      <h1>这条通知已经变成可执行的事项</h1>
      <p>已保留原文、确认后的字段和关联事项，后续通知可以继续归入同一事项。</p>
      <dl><div><dt>通知状态</dt><dd>已确认</dd></div><div><dt>事项编号</dt><dd>{notice.matter_id}</dd></div></dl>
      <button className="primary-button" type="button" onClick={onAgain}>继续添加通知</button>
    </section>
  )
}

export default function App() {
  const [stage, setStage] = useState<Stage>('compose')
  const [connected, setConnected] = useState(false)
  const [rawText, setRawText] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [notice, setNotice] = useState<NoticeDetail | null>(null)
  const [extraction, setExtraction] = useState<NoticeExtraction | null>(null)
  const [matters, setMatters] = useState<MatterSummary[]>([])
  const [matterMode, setMatterMode] = useState<MatterMode>('new')
  const [newMatterName, setNewMatterName] = useState('')
  const [selectedMatterId, setSelectedMatterId] = useState('')
  const [createTask, setCreateTask] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    Promise.allSettled([getHealth(), getMatters()]).then(([health, matterList]) => {
      if (!active) return
      setConnected(health.status === 'fulfilled' && health.value.status === 'ok')
      if (matterList.status === 'fulfilled') setMatters(matterList.value)
    })
    return () => { active = false }
  }, [])

  async function handleExtract(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const created = await createNotice({ raw_text: rawText.trim(), source_name: sourceName.trim() || null, source_url: sourceUrl.trim() || null })
      const extracted = await extractNotice(created.id)
      if (!extracted.extracted_json) throw new Error('没有收到提取结果，请重试')
      setNotice(extracted)
      setExtraction(extracted.extracted_json)
      setNewMatterName(extracted.extracted_json.matter_name)
      setStage('review')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '提取失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirm(event: FormEvent) {
    event.preventDefault()
    if (!notice || !extraction) return
    if (matterMode === 'existing' && !selectedMatterId) {
      setError('请选择要归入的已有事项')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const confirmed = await confirmNotice(notice.id, {
        extraction,
        ...(matterMode === 'new' ? { new_matter_name: newMatterName.trim() } : { matter_id: selectedMatterId }),
        ...(createTask ? { task: { stage: extraction.stage, deadline: extraction.deadline, submit_channel: extraction.submit_channel, materials: extraction.materials } } : {}),
      })
      setNotice(confirmed)
      setStage('success')
      const refreshed = await getMatters()
      setMatters(refreshed)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setStage('compose')
    setRawText('')
    setSourceName('')
    setSourceUrl('')
    setNotice(null)
    setExtraction(null)
    setMatterMode('new')
    setNewMatterName('')
    setSelectedMatterId('')
    setCreateTask(true)
    setError(null)
  }

  return (
    <div className="app-shell">
      <AppHeader connected={connected} />
      <Progress stage={stage} />
      {error && <div className="error-banner" role="alert"><b>暂时没有完成：</b>{error}<button type="button" onClick={() => setError(null)} aria-label="关闭提示">×</button></div>}
      <main>
        {stage === 'compose' && <ComposePanel rawText={rawText} sourceName={sourceName} sourceUrl={sourceUrl} busy={busy} onRawText={setRawText} onSourceName={setSourceName} onSourceUrl={setSourceUrl} onSubmit={handleExtract} />}
        {stage === 'review' && notice && extraction && <ReviewPanel extraction={extraction} rawText={rawText} notice={notice} matters={matters} matterMode={matterMode} newMatterName={newMatterName} selectedMatterId={selectedMatterId} createTask={createTask} busy={busy} onExtraction={setExtraction} onMode={setMatterMode} onNewMatterName={setNewMatterName} onSelectedMatterId={setSelectedMatterId} onCreateTask={setCreateTask} onBack={() => setStage('compose')} onSubmit={handleConfirm} />}
        {stage === 'success' && notice && <SuccessPanel notice={notice} onAgain={reset} />}
      </main>
      <footer>校事清 MVP · 所有结论均可回看原文</footer>
    </div>
  )
}
