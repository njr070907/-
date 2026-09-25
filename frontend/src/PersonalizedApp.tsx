import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import WorkflowApp from './App'
import { getHealth, getNotice, getNotices, isDraftNotice, type NoticeDetail, type NoticeSummary } from './api'
import { authService } from './auth'
import { AuthScreen } from './AuthScreen'
import { ensureDemoUsers } from './demo'
import { ProfileForm } from './ProfileForm'
import { ScrollToTop } from './ScrollToTop'
import { SlidingIndicator } from './SlidingIndicator'
import { profileRepository } from './profiles'
import { calculateRelevance, rankNotices, upcomingNotices, type Recommendation } from './recommendation'
import { isProfileComplete, roleLabels, type Session, type UserProfile } from './user'

type Tab = 'recommended' | 'all' | 'upcoming'
type Screen = 'feed' | 'workflow'
type HeaderScreen = Screen | 'profile'
const tabLabels: Record<Tab, string> = { recommended: '为你推荐', all: '全部信息', upcoming: '即将截止' }
const priorityLabels = { HIGH: '优先处理', MEDIUM: '与你相关', NORMAL: '一般信息' }

function dateLabel(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

function NoticeCard({ item, onOpen, index, animate }: { item: Recommendation; onOpen: (id: string) => void; index: number; animate: boolean }) {
  const { notice, priority, reasons, expired } = item
  return <article className={'notice-card ' + (priority === 'HIGH' ? 'notice-high ' : '') + (animate ? 'card-enter' : '')}
    style={animate ? { '--card-index': Math.min(index, 7) } as CSSProperties : undefined}>
    <div className="notice-top"><span className={'priority priority-' + priority.toLowerCase()}>{priorityLabels[priority]}</span><span className="notice-source">{notice.source_name || '来源未提供'}</span></div>
    <button className="notice-title" onClick={() => onOpen(notice.id)}>{notice.title || '未提供标题'} <span aria-hidden="true">↗</span></button>
    <div className="notice-meta">{notice.tags?.slice(0, 2).map(tag => <span className="tag" key={tag}>{tag}</span>)}<span>{dateLabel(notice.published_at) ? `发布于 ${dateLabel(notice.published_at)}` : '发布时间未提供'}</span></div>
    <div className="notice-bottom"><div className="reasons">{reasons.map(reason => <span key={reason}>✓ {reason}</span>)}</div>{notice.deadline && <span className={'deadline ' + (expired ? 'expired' : '')}>{expired ? '已截止' : '截止'} · {dateLabel(notice.deadline)}</span>}</div>
  </article>
}

function SiteHeader({ profile, active, onBrowse, onWorkflow, onProfile, onLogout }: {
  profile: UserProfile
  active: HeaderScreen
  onBrowse: () => void
  onWorkflow: () => void
  onProfile: () => void
  onLogout: () => void
}) {
  return <header className="site-header"><div className="header-inner">
    <button className="brand" onClick={onBrowse} type="button"><span className="brand-mark small">清</span><span>校事清</span></button>
    <nav aria-label="主导航">
      <SlidingIndicator activeKey={active} className="site-nav-indicator" />
      <button aria-current={active === 'feed' ? 'page' : undefined} className={active === 'feed' ? 'nav-active' : ''} data-motion-key="feed" onClick={onBrowse} type="button">信息广场</button>
      <button aria-current={active === 'workflow' ? 'page' : undefined} className={active === 'workflow' ? 'nav-active' : ''} data-motion-key="workflow" onClick={onWorkflow} type="button">办事工作台</button>
      <button aria-current={active === 'profile' ? 'page' : undefined} className={active === 'profile' ? 'nav-active' : ''} data-motion-key="profile" onClick={onProfile} type="button">个人中心</button>
    </nav>
    <div className="header-user"><span className="avatar">{profile.displayName.slice(0, 1)}</span><span>{profile.displayName}</span><button className="logout" onClick={onLogout} type="button">退出</button></div>
  </div></header>
}

export default function PersonalizedApp() {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [editing, setEditing] = useState(false)
  const [screen, setScreen] = useState<Screen>('feed')
  const [notices, setNotices] = useState<NoticeSummary[]>([])
  const [selected, setSelected] = useState<NoticeDetail | null>(null)
  const [tab, setTab] = useState<Tab>('recommended')
  const [renderedTab, setRenderedTab] = useState<Tab>('recommended')
  const [tabPhase, setTabPhase] = useState<'in' | 'out'>('in')
  const [hasSwitchedTab, setHasSwitchedTab] = useState(false)
  const [animateCards, setAnimateCards] = useState(true)
  const tabTimer = useRef<number | null>(null)
  const listScroll = useRef(0)
  const [query, setQuery] = useState('')
  const [connected, setConnected] = useState(false)
  const [loadingNotices, setLoadingNotices] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void ensureDemoUsers().then(() => {
      if (!active) return
      const current = authService.getSession()
      setSession(current)
      setProfile(current ? profileRepository.get(current.userId) : null)
      setReady(true)
    })
    void getHealth().then(value => { if (active) setConnected(value.status === 'ok') }).catch(() => { if (active) setConnected(false) })
    return () => { active = false }
  }, [])

  useEffect(() => () => { if (tabTimer.current !== null) window.clearTimeout(tabTimer.current) }, [])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setLoadingNotices(true)
      void getNotices(query.trim()).then(items => { if (active) { setNotices(items.filter(item => !isDraftNotice(item))); setError('') } }).catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : '无法读取通知')
      }).finally(() => { if (active) setLoadingNotices(false) })
    }, query ? 250 : 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [query])

  const ranked = useMemo(() => profile ? rankNotices(profile, notices) : [], [profile, notices])
  const visible = useMemo(() => {
    if (!profile) return []
    if (renderedTab === 'recommended') return ranked
    if (renderedTab === 'upcoming') return upcomingNotices(ranked)
    return notices.map(notice => calculateRelevance(profile, notice))
  }, [profile, notices, ranked, renderedTab])

  function switchTab(next: Tab) {
    if (next === tab) return
    if (tabTimer.current !== null) window.clearTimeout(tabTimer.current)
    setTab(next)
    setTabPhase('out')
    setHasSwitchedTab(true)
    setAnimateCards(true)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRenderedTab(next)
      setTabPhase('in')
      return
    }
    tabTimer.current = window.setTimeout(() => {
      setRenderedTab(next)
      setTabPhase('in')
      tabTimer.current = null
    }, 140)
  }

  function resetToBrowse() {
    if (tabTimer.current !== null) window.clearTimeout(tabTimer.current)
    tabTimer.current = null
    setTab('recommended')
    setRenderedTab('recommended')
    setTabPhase('in')
    setHasSwitchedTab(false)
    setAnimateCards(true)
    setSelected(null)
    setEditing(false)
    setScreen('feed')
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  function returnFromDetail() {
    setSelected(null)
    window.requestAnimationFrame(() => window.scrollTo({ top: listScroll.current, behavior: 'auto' }))
  }

  async function openNotice(id: string) {
    setError('')
    try { const detail = await getNotice(id); listScroll.current = window.scrollY; setSelected(detail); window.scrollTo({ top: 0, behavior: 'auto' }) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '无法读取通知详情') }
  }

  if (!ready) return <div className="personalized-root"><main className="loading-screen">正在打开校事清…</main></div>
  if (!session) return <div className="personalized-root"><AuthScreen onAuthenticated={value => { setSession(value); setProfile(profileRepository.get(value.userId)); resetToBrowse() }} /></div>
  if (!isProfileComplete(profile)) return <div className="personalized-root"><ProfileForm session={session} initial={profile} onSave={value => { setProfile(value); resetToBrowse() }} /></div>

  const logout = () => {
    authService.logout()
    setSession(null)
    setProfile(null)
    setSelected(null)
    setScreen('feed')
  }

  const openWorkflow = () => { setSelected(null); setEditing(false); setScreen('workflow'); window.scrollTo({ top: 0, behavior: 'auto' }) }
  const openProfile = () => { setSelected(null); setEditing(true); window.scrollTo({ top: 0, behavior: 'auto' }) }

  const activeScreen: HeaderScreen = editing ? 'profile' : screen

  return <div className={'personalized-root ' + (screen === 'workflow' && !editing ? 'suite-workflow' : '')}><div className="app-shell">
    <SiteHeader profile={profile} active={activeScreen} onBrowse={resetToBrowse} onWorkflow={openWorkflow} onProfile={openProfile} onLogout={logout} />
    {editing ? <div className="page-surface" key="profile">
      <ProfileForm session={session} initial={profile} inApp onSave={value => { setProfile(value); resetToBrowse() }} onCancel={resetToBrowse} />
    </div> : screen === 'workflow' ? <main className="workflow-dashboard page-surface" key="workflow"><WorkflowApp embedded /></main> : <main className="dashboard page-surface" key="feed">
      {selected ? <><button className="back-button" onClick={returnFromDetail}>← 返回信息列表</button><article className="detail-card"><span className="eyebrow">NOTICE DETAIL</span><h1>{selected.title || '未提供标题'}</h1><div className="detail-meta"><span>来源：{selected.source_name || '未提供'}</span><span>发布时间：{dateLabel(selected.published_at) || '未提供'}</span>{selected.deadline && <span>截止日期：{dateLabel(selected.deadline)}</span>}</div><pre>{selected.raw_text}</pre>{selected.source_url && <a href={selected.source_url} target="_blank" rel="noreferrer">查看原始来源 ↗</a>}</article></> : <>
        <section className="welcome"><div><span className="eyebrow">YOUR CAMPUS, IN FOCUS</span><h1>你好，{profile.displayName}<span className="wave"> ✦</span></h1><p>根据你的{roleLabels[profile.role]}身份、{profile.college}和关注方向，为你整理今天值得留意的校园信息。</p></div><div className="welcome-stat"><strong>{notices.length}</strong><span>条校园信息</span><small className={connected ? 'online' : 'offline'}>● {connected ? '数据已连接' : '数据暂未连接'}</small></div></section>
        <section className="browse-heading"><div><span className="eyebrow">CAMPUS UPDATES</span><h2>信息浏览</h2></div><button className="profile-link" onClick={() => setEditing(true)}>调整我的关注 →</button></section>
        <div className="toolbar"><div className="tabs" role="tablist" aria-label="信息视图" style={{ '--tab-index': (Object.keys(tabLabels) as Tab[]).indexOf(tab) } as CSSProperties}>{(Object.keys(tabLabels) as Tab[]).map(value => <button role="tab" aria-selected={tab === value} className={tab === value ? 'active' : ''} key={value} onClick={() => switchTab(value)}>{tabLabels[value]}</button>)}</div><label className="search-box"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={event => { setAnimateCards(false); setQuery(event.target.value) }} placeholder="搜索标题或通知内容" aria-label="搜索通知" /></label></div>
        <div className={'tab-panel ' + (tabPhase === 'out' ? 'is-exiting ' : '') + (hasSwitchedTab ? 'switch-panel' : 'initial-panel')} key={renderedTab} role="tabpanel">
          {renderedTab === 'recommended' && <p className="list-note">优先展示与你相关且需要及时处理的信息。所有通知都可以在「全部信息」中查看。</p>}
          {error && <p role="alert" className="form-error">{error}</p>}
          {loadingNotices ? <div className="empty-state">正在整理校园信息…</div> : visible.length ? <div className="notice-list">{visible.map((item, index) => <NoticeCard key={item.notice.id} item={item} index={index} animate={animateCards} onOpen={id => void openNotice(id)} />)}</div> : <div className="empty-state"><strong>{query ? '没有找到相关信息' : renderedTab === 'upcoming' ? '近期暂无截止事项' : '暂无校园信息'}</strong><p>可以调整搜索词，或切换到「全部信息」查看。</p></div>}
        </div>
      </>}
    </main>}
    {!editing && <footer>校事清 · 本地演示版本 · 历史归档不代表当前有效通知，请核对原文</footer>}
    <ScrollToTop />
  </div></div>
}
