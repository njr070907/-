import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { COLLEGES, getCollege, getProgram, getPrograms, needsProgram, type AcademicOption } from './sztuAcademicData'
import { validateKeyword } from './keywordUtils'
import { profileRepository } from './profiles'
import { ThemedSelect } from './ThemedSelect'
import { interestOptions, roleLabels, type Session, type UserProfile, type UserRole } from './user'

const roleOptions: AcademicOption[] = Object.entries(roleLabels).map(([id, displayName]) => ({ id, displayName }))

export function ProfileForm({ session, initial, onSave, onCancel, inApp = false }: {
  session: Session
  initial: UserProfile | null
  onSave: (profile: UserProfile) => void
  onCancel?: () => void
  inApp?: boolean
}) {
  const [name, setName] = useState(initial?.displayName ?? '')
  const [role, setRole] = useState<UserRole>(initial?.role ?? 'undergraduate')
  const [college, setCollege] = useState(initial?.college ?? '')
  const [major, setMajor] = useState(initial?.major ?? '')
  const [grade, setGrade] = useState(initial?.grade ?? '')
  const [interests, setInterests] = useState<string[]>(initial?.interests?.filter(item => item !== '其他') ?? [])
  const [customKeywords, setCustomKeywords] = useState<string[]>(initial?.customKeywords ?? [])
  const [otherOpen, setOtherOpen] = useState(Boolean(initial?.customKeywords?.length || initial?.interests.includes('其他')))
  const [keywordDraft, setKeywordDraft] = useState('')
  const [keywordError, setKeywordError] = useState('')
  const [error, setError] = useState('')

  const knownPrograms = getPrograms(role, college)
  const legacyCollege = initial?.college && !getCollege(initial.college) && college === initial.college
    ? [{ id: 'legacy_college', displayName: initial.college }] : []
  const legacyMajor = initial?.major && major === initial.major &&
    college === initial.college && role === initial.role &&
    !knownPrograms.some(item => item.displayName === initial.major)
    ? [{ id: 'legacy_major', displayName: initial.major }] : []
  const programOptions = [...knownPrograms, ...legacyMajor]
  const otherActive = otherOpen || customKeywords.length > 0

  function changeCollege(next: string) {
    setCollege(next)
    if (!getPrograms(role, next).some(item => item.displayName === major)) setMajor('')
    setError('')
  }

  function changeRole(next: UserRole) {
    setRole(next)
    if (!getPrograms(next, college).some(item => item.displayName === major)) setMajor('')
    setError('')
  }

  function addKeyword(input = keywordDraft): string[] | null {
    const pieces = input.split(/[,，]/).map(part => part.trim()).filter(Boolean)
    let next = [...customKeywords]
    for (const keyword of pieces) {
      const message = validateKeyword(keyword, next)
      if (message) {
        setKeywordError(message)
        if (message === '这个关键词已经添加过了') setKeywordDraft('')
        return null
      }
      next.push(keyword)
    }
    if (!pieces.length) { setKeywordError('请输入关键词'); return null }
    setCustomKeywords(next)
    setKeywordDraft('')
    setKeywordError('')
    setOtherOpen(true)
    return next
  }

  function onKeywordKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',' || event.key === '，') {
      event.preventDefault()
      addKeyword()
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (!name.trim() || !college || (role !== 'teacher' && (!grade.trim() || (needsProgram(role, college) && !major)))) {
      setError('请填写称呼、学院及适用的专业和年级')
      return
    }
    let keywords = customKeywords
    if (keywordDraft.trim()) {
      const added = addKeyword()
      if (!added) return
      keywords = added
    }
    try {
      const profile = profileRepository.save({
        id: session.userId, email: session.email, displayName: name.trim(), role, college,
        collegeId: getCollege(college)?.id,
        major: role === 'teacher' ? '' : major,
        majorId: role === 'teacher' ? undefined : getProgram(role, college, major)?.id,
        grade: role === 'teacher' ? '' : grade,
        interests, customKeywords: keywords,
      })
      onSave(profile)
    } catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败') }
  }

  return <main className={'profile-layout' + (inApp ? ' in-app' : '')}><section className="profile-card">
    {!inApp && <div className="brand-line"><div className="brand-mark small">清</div><span>校事清</span></div>}
    <span className="eyebrow">{initial ? 'PERSONAL PROFILE' : 'FIRST TIME SETUP'}</span>
    <h1>{initial ? '修改个人资料' : '先认识一下你'}</h1>
    <p className="muted">身份、学院和专业用于排列与你相关的校园信息。资料只保存在此浏览器中。</p>
    <form onSubmit={submit} className="profile-form">
      <label>称呼<input required value={name} onChange={event => setName(event.target.value)} placeholder="怎么称呼你" /></label>
      <ThemedSelect label="身份" value={roleLabels[role]} options={roleOptions} placeholder="请选择身份"
        onChange={value => changeRole(roleOptions.find(item => item.displayName === value)?.id as UserRole)} />
      <ThemedSelect label="学院" value={college} options={[...COLLEGES, ...legacyCollege]} placeholder="请选择学院"
        required onChange={changeCollege} />
      {role !== 'teacher' && (programOptions.length > 0
        ? <ThemedSelect label={college === '未来技术学院' && role === 'undergraduate' ? '培养方向' : role === 'postgraduate' ? '研究生项目' : '专业'}
            value={major} options={programOptions} placeholder={role === 'postgraduate' ? '请选择研究生项目' : '请选择专业'}
            required={needsProgram(role, college)} onChange={value => setMajor(value)} />
        : college && <p className="profile-hint">该学院暂无独立的{role === 'postgraduate' ? '研究生招生项目' : '普通本科招生专业'}可选，专业可以留空。</p>)}
      {role !== 'teacher' && <label>年级<input required value={grade} onChange={event => setGrade(event.target.value)} placeholder="例如 2024 级" /></label>}
      <fieldset><legend>关注方向 <span className="muted">可多选</span></legend>
        <div className="interest-grid">{interestOptions.filter(item => item !== '其他').map(item =>
          <label className={'interest-chip ' + (interests.includes(item) ? 'selected' : '')} key={item}>
            <input type="checkbox" checked={interests.includes(item)}
              onChange={() => setInterests(current => current.includes(item) ? current.filter(value => value !== item) : [...current, item])} />{item}
          </label>)}
          <button type="button" className={'interest-chip other-chip ' + (otherActive ? 'selected' : '')}
            aria-expanded={otherActive} onClick={() => setOtherOpen(current => customKeywords.length > 0 || !current)}>其他</button>
        </div>
        {otherActive && <div className="custom-keywords">
          <label htmlFor="keyword-input">其他关注关键词</label>
          <p>输入你希望优先看到的信息关键词，例如：机器人、单片机、交换生、考研。</p>
          <div className="keyword-entry"><input id="keyword-input" value={keywordDraft} onChange={event => { setKeywordDraft(event.target.value); setKeywordError('') }}
            onKeyDown={onKeywordKeyDown} placeholder="输入关键词后按 Enter 添加" maxLength={40} />
            <button type="button" className="keyword-add" onClick={() => addKeyword()}>添加</button></div>
          {keywordError && <p className="keyword-error" role="alert">{keywordError}</p>}
          {customKeywords.length > 0 && <div className="keyword-chips">{customKeywords.map(keyword => <span className="keyword-chip" key={keyword}>{keyword}
            <button type="button" aria-label={`删除关键词${keyword}`} onClick={() => { setCustomKeywords(current => { const next = current.filter(item => item !== keyword); if (!next.length) setOtherOpen(false); return next }) }}>×</button>
          </span>)}</div>}
          <small>{customKeywords.length}/10 个关键词，每个 2–20 字符</small>
        </div>}
      </fieldset>
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="form-actions">{onCancel && <button type="button" className="text-button" onClick={onCancel}>返回首页</button>}
        <button className="primary-button" type="submit">保存资料，查看推荐</button></div>
    </form>
  </section></main>
}
