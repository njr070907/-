import { interestOptions, type UserProfile, type UserRole } from './user'
import { getCollege, getProgram } from './sztuAcademicData'

export interface ProfileRepository {
  get(userId: string): UserProfile | null
  save(profile: UserProfile): UserProfile
}

const KEY = 'xiaoshiqing.profiles.v1'
const roles: UserRole[] = ['undergraduate', 'postgraduate', 'teacher']

function validProfile(value: unknown): value is UserProfile {
  if (!value || typeof value !== 'object') return false
  const p = value as Partial<UserProfile>
  return typeof p.id === 'string' && typeof p.email === 'string' &&
    typeof p.displayName === 'string' && roles.includes(p.role as UserRole) &&
    typeof p.college === 'string' && typeof p.major === 'string' &&
    typeof p.grade === 'string' && Array.isArray(p.interests) &&
    p.interests.every(item => typeof item === 'string' && interestOptions.includes(item))
}

function normalizeProfile(profile: UserProfile): UserProfile {
  const customKeywords = Array.isArray(profile.customKeywords)
    ? profile.customKeywords.filter((item): item is string => typeof item === 'string').slice(0, 10)
    : []
  return {
    ...profile,
    customKeywords,
    collegeId: getCollege(profile.college)?.id ?? profile.collegeId,
    majorId: getProgram(profile.role, profile.college, profile.major)?.id ?? profile.majorId,
  }
}

function readAll(): Record<string, UserProfile> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) || '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed)
      .filter(([, value]) => validProfile(value))
      .map(([id, value]) => [id, normalizeProfile(value as UserProfile)]))
  } catch { return {} }
}

export class LocalProfileRepository implements ProfileRepository {
  get(userId: string): UserProfile | null { return readAll()[userId] ?? null }

  save(profile: UserProfile): UserProfile {
    if (!validProfile(profile)) throw new Error('资料格式不完整，请检查填写内容')
    if (profile.customKeywords.length > 10 || profile.customKeywords.some(item => item.length < 2 || item.length > 20)) {
      throw new Error('关注关键词最多 10 个，每个需要 2–20 个字符')
    }
    const normalized = normalizeProfile(profile)
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [profile.id]: normalized }))
    } catch { throw new Error('浏览器存储不可用，资料未能保存') }
    return normalized
  }
}

export const profileRepository: ProfileRepository = new LocalProfileRepository()
