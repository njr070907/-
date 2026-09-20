import { needsProgram } from './sztuAcademicData'

export type UserRole = 'undergraduate' | 'postgraduate' | 'teacher'

export type UserProfile = {
  id: string
  displayName: string
  email: string
  role: UserRole
  college: string
  major: string
  grade: string
  interests: string[]
  customKeywords: string[]
  collegeId?: string
  majorId?: string
}

export type Session = { userId: string; email: string }

export const roleLabels: Record<UserRole, string> = {
  undergraduate: '本科生',
  postgraduate: '研究生',
  teacher: '教师',
}

export const interestOptions = ['教务', '竞赛', '奖学金', '科研', '就业', '讲座', '校园事务', '其他']

export function isProfileComplete(profile: UserProfile | null): profile is UserProfile {
  return Boolean(profile?.displayName.trim() && profile.college.trim() &&
    (profile.role === 'teacher' || ((!needsProgram(profile.role, profile.college) || profile.major.trim()) && profile.grade.trim())))
}
