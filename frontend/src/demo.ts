import { seedLocalDemoAccount } from './auth'
import { profileRepository } from './profiles'
import type { UserProfile } from './user'

const demos: Omit<UserProfile, 'id'>[] = [
  { email: 'student@demo.test', displayName: '陈同学', role: 'undergraduate', college: '工程物理学院', major: '智能感知工程', grade: '2024级', interests: ['竞赛', '奖学金'], customKeywords: [] },
  { email: 'graduate@demo.test', displayName: '林同学', role: 'postgraduate', college: '人工智能学院', major: '计算机技术', grade: '2025级', interests: ['科研', '讲座'], customKeywords: [] },
  { email: 'teacher@demo.test', displayName: '周老师', role: 'teacher', college: '人工智能学院', major: '', grade: '', interests: ['教务', '科研'], customKeywords: [] },
]

let setup: Promise<void> | null = null
export function ensureDemoUsers(): Promise<void> {
  setup ??= Promise.all(demos.map(async demo => {
    const id = await seedLocalDemoAccount(demo.email, 'Demo1234')
    const current = profileRepository.get(id)
    if (!current) profileRepository.save({ ...demo, id })
    // Upgrade only untouched legacy demo presets; never overwrite user edits.
    else if (demo.email === 'graduate@demo.test' && current.college === '计算机科学与技术学院' && current.major === '计算机科学与技术') {
      profileRepository.save({ ...current, college: '人工智能学院', major: '计算机技术' })
    } else if (demo.email === 'teacher@demo.test' && current.college === '信息与通信工程学院' && current.major === '') {
      profileRepository.save({ ...current, college: '人工智能学院' })
    }
  })).then(() => undefined).catch(() => undefined)
  return setup
}
