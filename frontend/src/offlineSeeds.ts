import type { NoticeDetail } from './api'
import archiveManifest from '../../data/notion_wechat/manifest.json'

type ArchiveRaw = {
  id: string
  title: string
  source_name: string | null
  source_url: string | null
  published_at: string | null
  collected_by: string | null
  collected_at: string | null
  raw_text: string
}

type ArchiveMetadata = {
  id: string
  type: string
  topics: string[]
  organization_status: string
  conclusion: string
  original_source_url: string | null
  published_at: string | null
}

const archiveRawModules = import.meta.glob('../../data/notion_wechat/raw/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, ArchiveRaw>

const archiveMetadata = new Map(
  (archiveManifest.records as ArchiveMetadata[]).map(record => [record.id, record]),
)

type Seed = {
  id: string
  title: string
  rawText: string
  audienceRoles?: string[]
  colleges?: string[]
  majors?: string[]
  grades?: string[]
  tags: string[]
  required?: boolean
  deadlineInDays: number
}

const seeds: Seed[] = [
  { id: 'demo_all_card', title: '【演示】校园卡年度信息核对', rawText: '演示事项：请师生核对校园卡联系方式与服务信息。此内容仅用于校事清功能演示，并非真实校方通知。', tags: ['校园事务'], required: true, deadlineInDays: 6 },
  { id: 'demo_undergrad_course', title: '【演示】本科生秋季课程确认', rawText: '演示事项：本科生请在截止前确认本学期课程安排。此内容并非真实校方通知。', audienceRoles: ['undergraduate'], tags: ['教务'], required: true, deadlineInDays: 3 },
  { id: 'demo_physics_competition', title: '【演示】工程物理学院智能感知创意竞赛', rawText: '演示事项：智能感知工程本科生可报名学院创意竞赛。此内容并非真实校方通知。', audienceRoles: ['undergraduate'], colleges: ['工程物理学院'], majors: ['智能感知工程'], tags: ['竞赛'], deadlineInDays: 4 },
  { id: 'demo_physics_scholarship', title: '【演示】工程物理学院本科奖学金材料提交', rawText: '演示事项：符合条件的本科同学可提交奖学金申请材料。此内容并非真实校方通知。', audienceRoles: ['undergraduate'], colleges: ['工程物理学院'], majors: ['智能感知工程'], tags: ['奖学金'], deadlineInDays: 8 },
  { id: 'demo_computer_research', title: '【演示】人工智能学院研究生科研课题征集', rawText: '演示事项：人工智能学院研究生可提交新学期科研课题意向。此内容并非真实校方通知。', audienceRoles: ['postgraduate'], colleges: ['人工智能学院'], majors: ['计算机技术'], tags: ['科研'], deadlineInDays: 5 },
  { id: 'demo_grad_lecture', title: '【演示】研究生学术讲座预约', rawText: '演示事项：研究生学术讲座开放预约，席位有限。此内容并非真实校方通知。', audienceRoles: ['postgraduate'], tags: ['讲座'], deadlineInDays: 2 },
  { id: 'demo_teacher_teaching', title: '【演示】人工智能学院教师教学材料确认', rawText: '演示事项：本学院教师请在截止前确认教学材料。此内容并非真实校方通知。', audienceRoles: ['teacher'], colleges: ['人工智能学院'], tags: ['教务'], required: true, deadlineInDays: 2 },
  { id: 'demo_robot_project', title: '【演示】智能感知机器人项目招募', rawText: '演示事项：智能感知工程本科生可报名机器人项目实践。此内容并非真实校方通知。', audienceRoles: ['undergraduate'], colleges: ['工程物理学院'], majors: ['智能感知工程'], tags: ['机器人'], deadlineInDays: 7 },
  { id: 'demo_stm32_workshop', title: '【演示】嵌入式技术工作坊', rawText: '演示事项：面向工程物理学院学生的嵌入式技术工作坊。此内容并非真实校方通知。', audienceRoles: ['undergraduate'], colleges: ['工程物理学院'], tags: ['STM32'], deadlineInDays: 9 },
  { id: 'demo_teacher_research', title: '【演示】教师科研项目申报说明会', rawText: '演示事项：面向教师的科研项目申报说明会，欢迎报名。此内容并非真实校方通知。', audienceRoles: ['teacher'], tags: ['科研', '讲座'], deadlineInDays: 9 },
  { id: 'demo_employment', title: '【演示】毕业生就业指导工作坊', rawText: '演示事项：毕业生就业指导工作坊开放报名。此内容并非真实校方通知。', audienceRoles: ['undergraduate', 'postgraduate'], tags: ['就业'], deadlineInDays: 12 },
  { id: 'demo_college_open', title: '【演示】工程物理学院开放实验室参观', rawText: '演示事项：学院开放实验室参观预约。此内容并非真实校方通知。', colleges: ['工程物理学院'], tags: ['校园事务'], deadlineInDays: 11 },
  { id: 'demo_major_project', title: '【演示】软件工程专业实践项目报名', rawText: '演示事项：软件工程专业实践项目接受报名。此内容并非真实校方通知。', majors: ['软件工程'], tags: ['竞赛'], deadlineInDays: 7 },
  { id: 'demo_public_lecture', title: '【演示】校园公开讲座：数字时代的学习方法', rawText: '演示事项：面向全校师生的公开讲座。此内容并非真实校方通知。', tags: ['讲座'], deadlineInDays: 10 },
  { id: 'demo_expired_competition', title: '【演示】已结束的创新设计赛报名', rawText: '演示历史事项：报名已截止，仅供完整信息浏览。此内容并非真实校方通知。', audienceRoles: ['undergraduate'], colleges: ['工程物理学院'], majors: ['智能感知工程'], tags: ['竞赛'], deadlineInDays: -5 },
]

const isoAtDayOffset = (offset: number, hour: number) => {
  const value = new Date()
  value.setHours(hour, 0, 0, 0)
  value.setDate(value.getDate() + offset)
  return value.toISOString()
}

export function createOfflineSeedNotices(): NoticeDetail[] {
  const demoNotices = seeds.map((seed, index) => ({
    id: seed.id,
    title: seed.title,
    raw_text: seed.rawText,
    source_name: '校事清脱敏演示数据',
    source_url: null,
    published_at: isoAtDayOffset(-(index % 6), 9),
    source_type: 'manual_copy',
    parse_status: 'raw',
    matter_id: null,
    audience_roles: seed.audienceRoles ?? null,
    colleges: seed.colleges ?? null,
    majors: seed.majors ?? null,
    grades: seed.grades ?? null,
    tags: seed.tags,
    category: seed.tags[0] ?? null,
    summary: seed.rawText,
    description: seed.rawText,
    deadline: isoAtDayOffset(seed.deadlineInDays, 18),
    importance: seed.required ? 'high' : 'normal',
    required: seed.required ?? false,
    collected_by: 'offline-demo',
    collected_at: isoAtDayOffset(0, 8),
    imported_at: isoAtDayOffset(0, 8),
    created_at: isoAtDayOffset(0, 8),
    extracted_json: null,
  })) satisfies NoticeDetail[]

  const archiveNotices = Object.values(archiveRawModules).map(raw => {
    const metadata = archiveMetadata.get(raw.id)
    const publishedAt = metadata?.published_at ?? raw.published_at
    const collectedAt = raw.collected_at ?? new Date(0).toISOString()
    return {
      id: raw.id,
      title: raw.title,
      raw_text: raw.raw_text,
      source_name: raw.source_name || '微信知识库归档',
      source_url: raw.source_url ?? metadata?.original_source_url ?? null,
      published_at: publishedAt,
      source_type: 'notion_wechat_archive',
      parse_status: 'raw' as const,
      matter_id: null,
      audience_roles: null,
      colleges: null,
      majors: null,
      grades: null,
      tags: metadata?.topics ?? [],
      category: metadata?.type ?? null,
      summary: metadata?.conclusion ?? null,
      description: raw.raw_text,
      deadline: null,
      importance: 'normal',
      required: false,
      collected_by: raw.collected_by,
      collected_at: raw.collected_at,
      imported_at: collectedAt,
      created_at: collectedAt,
      extracted_json: null,
    }
  }) satisfies NoticeDetail[]

  return [...demoNotices, ...archiveNotices]
}
