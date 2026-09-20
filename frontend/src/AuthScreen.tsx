import { useState, type FormEvent } from 'react'
import { authService } from './auth'
import type { Session } from './user'

export function AuthScreen({ onAuthenticated }: { onAuthenticated: (session: Session) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      onAuthenticated(mode === 'register' ? await authService.register(email, password) : await authService.login(email, password))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作失败，请重试')
    } finally { setBusy(false) }
  }

  return <main className="auth-layout">
    <section className="auth-intro">
      <div className="brand-mark">清</div>
      <span className="eyebrow">校事清 · CAMPUS DESK</span>
      <h1>校园事务，<br /><em>清楚一点。</em></h1>
      <p>把散落的校园通知收在一起，按你的身份与关注方向，把需要先处理的事放到前面。</p>
      <div className="auth-points"><span>信息归集</span><span>截止提醒</span><span>与你相关</span></div>
    </section>
    <section className="auth-card" aria-label={mode === 'login' ? '登录' : '注册'}>
      <div className="auth-switch"><button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError('') }}>登录</button><button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError('') }}>注册</button></div>
      <h2>{mode === 'login' ? '欢迎回来' : '创建演示账号'}</h2>
      <p className="muted">{mode === 'login' ? '登录后查看你的校园信息优先顺序。' : '只需邮箱和密码，下一步设置你的关注方向。'}</p>
      <form onSubmit={event => void submit(event)}>
        <label>邮箱<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" /></label>
        <label>密码<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} required value={password} onChange={e => setPassword(e.target.value)} placeholder="至少 6 位" /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button full-width" disabled={busy} type="submit">{busy ? '请稍候…' : mode === 'login' ? '登录校事清' : '注册并继续'}</button>
      </form>
      <p className="demo-note">本地演示账号，不使用校园统一身份认证。请勿填写真实校园密码。</p>
      <div className="demo-hint"><strong>快速体验</strong><span>student@demo.test / Demo1234<br />graduate@demo.test / Demo1234<br />teacher@demo.test / Demo1234</span></div>
    </section>
  </main>
}
