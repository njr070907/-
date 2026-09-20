import type { NoticeSummary } from './api'
import { roleLabels, type UserProfile } from './user'
import { normalizeKeyword } from './keywordUtils'

export type Recommendation = {
  notice: NoticeSummary
  score: number
  priority: 'HIGH' | 'MEDIUM' | 'NORMAL'
  reasons: string[]
  applies: boolean
  expired: boolean
  requiredForUser: boolean
}

const day = 86_400_000
const matches = (scope: string[] | null | undefined, value: string) => !scope?.length || scope.includes(value)
const timestamp = (value: string | null | undefined) => value ? Date.parse(value) : NaN

export function calculateRelevance(profile: UserProfile, notice: NoticeSummary, now = new Date()): Recommendation {
  const roleMatch = matches(notice.audience_roles, profile.role)
  const collegeMatch = matches(notice.colleges, profile.college)
  const majorMatch = matches(notice.majors, profile.major)
  const gradeMatch = matches(notice.grades, profile.grade)
  const applies = roleMatch && collegeMatch && majorMatch && gradeMatch
  const deadlineTime = timestamp(notice.deadline)
  const daysLeft = Number.isNaN(deadlineTime) ? null : Math.ceil((deadlineTime - now.getTime()) / day)
  const expired = daysLeft !== null && daysLeft < 0
  const reasons: string[] = []
  let score = 40 // Public notices are useful even without audience metadata.

  if (notice.audience_roles?.length && roleMatch) { score += 20; reasons.push(`${roleLabels[profile.role]}适用`) }
  if (notice.colleges?.length && collegeMatch) { score += 20; reasons.push('与你的学院相关') }
  if (notice.majors?.length && majorMatch) { score += 25; reasons.push('与你的专业相关') }
  if (notice.grades?.length && gradeMatch) { score += 8; reasons.push('适用于你的年级') }
  const interest = notice.tags?.find(tag => profile.interests.includes(tag))
  const searchable = normalizeKeyword([
    notice.title, ...(notice.tags ?? []), notice.category, notice.summary, notice.description,
  ].filter(Boolean).join(' '))
  const customHit = profile.customKeywords?.find(keyword => {
    const normalized = normalizeKeyword(keyword)
    return normalized.length >= 2 && searchable.includes(normalized)
  })
  if (interest || customHit) score += 15 // Shared interest dimension, never stacks past 15.
  if (interest) reasons.push(`你关注了“${interest}”`)
  if (customHit) reasons.push(`匹配你的关注关键词“${customHit}”`)
  if (daysLeft !== null && daysLeft >= 0) {
    score += daysLeft <= 3 ? 15 : daysLeft <= 7 ? 11 : daysLeft <= 14 ? 6 : 0
    if (daysLeft <= 14) reasons.push(daysLeft === 0 ? '今天截止' : `${daysLeft}天后截止`)
  }
  const published = timestamp(notice.published_at)
  if (!Number.isNaN(published) && published <= now.getTime() && now.getTime() - published <= 7 * day) score += 5
  if (notice.importance === 'high') score += 8
  const requiredForUser = Boolean(notice.required && applies && !expired)
  if (requiredForUser) { score += 60; reasons.unshift('必须办理') }
  if (!applies) score -= 100
  if (expired) score -= 200
  if (!applies) reasons.splice(0, reasons.length, '不在当前适用范围')
  if (!reasons.length) reasons.push(notice.audience_roles?.length || notice.colleges?.length ? '其他校园信息' : '面向全校')
  const reasonRank = (reason: string) => reason === '必须办理' ? 0 :
    reason.startsWith('匹配你的关注关键词') ? 1 : reason.startsWith('你关注了') ? 2 :
    reason.includes('专业') ? 3 : reason.includes('截止') ? 4 : reason.includes('学院') ? 5 :
    reason.includes('适用') ? 6 : 7
  reasons.sort((a, b) => reasonRank(a) - reasonRank(b))
  const priority = applies && !expired && (requiredForUser || score >= 70) ? 'HIGH' :
    applies && !expired && score >= 45 ? 'MEDIUM' : 'NORMAL'
  return { notice, score, priority, reasons: reasons.slice(0, 3), applies, expired, requiredForUser }
}

const priorityRank = { HIGH: 2, MEDIUM: 1, NORMAL: 0 }
const deadlineOrder = (notice: NoticeSummary) => {
  const time = timestamp(notice.deadline)
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time
}

export function rankNotices(profile: UserProfile, notices: NoticeSummary[], now = new Date()): Recommendation[] {
  return notices.map(notice => calculateRelevance(profile, notice, now)).sort((a, b) =>
    Number(b.requiredForUser) - Number(a.requiredForUser) ||
    priorityRank[b.priority] - priorityRank[a.priority] ||
    b.score - a.score ||
    deadlineOrder(a.notice) - deadlineOrder(b.notice) ||
    (timestamp(b.notice.published_at) || 0) - (timestamp(a.notice.published_at) || 0) ||
    a.notice.id.localeCompare(b.notice.id))
}

export function upcomingNotices(items: Recommendation[], now = new Date()): Recommendation[] {
  return items.filter(item => {
    const deadline = timestamp(item.notice.deadline)
    return !Number.isNaN(deadline) && deadline >= now.getTime() && deadline <= now.getTime() + 14 * day
  }).sort((a, b) => deadlineOrder(a.notice) - deadlineOrder(b.notice) || b.score - a.score || a.notice.id.localeCompare(b.notice.id))
}
