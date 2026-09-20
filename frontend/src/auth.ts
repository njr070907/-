import type { Session } from './user'

type Account = { id: string; email: string; salt: string; passwordHash: string }

export interface AuthAdapter {
  register(email: string, password: string): Promise<Session>
  login(email: string, password: string): Promise<Session>
  getSession(): Session | null
  logout(): void
}

const ACCOUNTS_KEY = 'xiaoshiqing.accounts.v1'
const SESSION_KEY = 'xiaoshiqing.session.v1'

function storage(): Storage | null {
  try { return window.localStorage } catch { return null }
}

function readAccounts(): Account[] {
  try {
    const parsed: unknown = JSON.parse(storage()?.getItem(ACCOUNTS_KEY) || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is Account => Boolean(item && typeof item.id === 'string' &&
      typeof item.email === 'string' && typeof item.salt === 'string' && typeof item.passwordHash === 'string'))
  } catch { return [] }
}

function writeAccounts(accounts: Account[]) {
  const target = storage()
  if (!target) throw new Error('浏览器存储不可用，无法保存演示账号')
  target.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
}

function writeSession(session: Session) {
  const target = storage()
  if (!target) throw new Error('浏览器存储不可用，无法保持登录状态')
  target.setItem(SESSION_KEY, JSON.stringify(session))
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bytes = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: Uint8Array.from(salt.match(/.{2}/g)!.map(x => parseInt(x, 16))), iterations: 100_000, hash: 'SHA-256' }, key, 256)
  return Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, '0')).join('')
}

export class LocalAuthAdapter implements AuthAdapter {
  async register(emailInput: string, password: string): Promise<Session> {
    const email = emailInput.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('请输入有效的邮箱地址')
    if (password.length < 6) throw new Error('密码至少需要 6 位')
    const accounts = readAccounts()
    if (accounts.some(account => account.email === email)) throw new Error('该邮箱已注册，请直接登录')
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)), x => x.toString(16).padStart(2, '0')).join('')
    const session = { userId: crypto.randomUUID(), email }
    const passwordHash = await hashPassword(password, salt)
    writeAccounts([...accounts, { id: session.userId, email, salt, passwordHash }])
    writeSession(session)
    return session
  }

  async login(emailInput: string, password: string): Promise<Session> {
    const email = emailInput.trim().toLowerCase()
    const account = readAccounts().find(item => item.email === email)
    if (!account || await hashPassword(password, account.salt) !== account.passwordHash) {
      throw new Error('邮箱或密码不正确')
    }
    const session = { userId: account.id, email: account.email }
    writeSession(session)
    return session
  }

  getSession(): Session | null {
    try {
      const parsed: unknown = JSON.parse(storage()?.getItem(SESSION_KEY) || 'null')
      if (!parsed || typeof parsed !== 'object' || !('userId' in parsed) || !('email' in parsed)) return null
      const session = parsed as Session
      return readAccounts().some(account => account.id === session.userId && account.email === session.email) ? session : null
    } catch { return null }
  }

  logout() { storage()?.removeItem(SESSION_KEY) }
}

export const authService: AuthAdapter = new LocalAuthAdapter()

export async function seedLocalDemoAccount(email: string, password: string): Promise<string> {
  const existing = readAccounts().find(account => account.email === email)
  if (existing) return existing.id
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)), x => x.toString(16).padStart(2, '0')).join('')
  const account = { id: crypto.randomUUID(), email, salt, passwordHash: await hashPassword(password, salt) }
  writeAccounts([...readAccounts(), account])
  return account.id
}
