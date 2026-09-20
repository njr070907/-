import type { UserRole } from './user'

// Source: Shenzhen Technology University official school, admissions and graduate sites; checked 2026-09.
// College IDs are stable for future database migration. Profile labels remain for legacy Notice compatibility.
export type AcademicOption = { id: string; displayName: string; kind?: 'specialProgram' }
export const COLLEGES: AcademicOption[] = [
  { id: 'sino_german_manufacturing', displayName: '中德智能制造学院' },
  { id: 'artificial_intelligence', displayName: '人工智能学院' },
  { id: 'new_materials_energy', displayName: '新材料与新能源学院' },
  { id: 'urban_transport_logistics', displayName: '城市交通与物流学院' },
  { id: 'health_environment', displayName: '健康与环境工程学院' },
  { id: 'engineering_physics', displayName: '工程物理学院' },
  { id: 'quality_standards', displayName: '质量和标准学院' },
  { id: 'pharmacy', displayName: '药学院' },
  { id: 'stomatology', displayName: '口腔学院' },
  { id: 'future_technology', displayName: '未来技术学院' },
  { id: 'creative_design', displayName: '创意设计学院' },
  { id: 'business', displayName: '商学院' },
  { id: 'foreign_languages', displayName: '外国语学院' },
  { id: 'integrated_circuits', displayName: '集成电路与光电芯片学院' },
  { id: 'marxism_humanities', displayName: '马克思主义学院（人文社科学院）' },
  { id: 'sports_arts', displayName: '体育与艺术学院' },
  { id: 'music', displayName: '音乐学院' },
]
const programs = (rows: [string, string][], kind?: 'specialProgram'): AcademicOption[] =>
  rows.map(([id, displayName]) => ({ id, displayName, ...(kind ? { kind } : {}) }))

export const UNDERGRAD_MAJOR_MAP: Record<string, AcademicOption[]> = {
  sino_german_manufacturing: programs([['mechanical_design', '机械设计制造及其自动化'], ['automation', '自动化'], ['electronic_science', '电子科学与技术'], ['robotics', '机器人工程'], ['industrial_software', '工业软件']]),
  artificial_intelligence: programs([['internet_of_things', '物联网工程'], ['computer_science', '计算机科学与技术'], ['data_science', '数据科学与大数据技术'], ['artificial_intelligence', '人工智能'], ['cyberspace_security', '网络空间安全']]),
  new_materials_energy: programs([['lighting', '光源与照明'], ['new_energy', '新能源科学与工程'], ['materials_science', '材料科学与工程']]),
  urban_transport_logistics: programs([['transportation', '交通运输'], ['automotive_service', '汽车服务工程'], ['vehicle_engineering', '车辆工程'], ['logistics', '物流管理'], ['unmanned_aircraft', '无人驾驶航空器系统工程']]),
  health_environment: programs([['biomedical_engineering', '生物医学工程'], ['intelligent_medical', '智能医学工程']]),
  engineering_physics: programs([['applied_physics', '应用物理学'], ['optoelectronic_science', '光电信息科学与工程'], ['intelligent_perception', '智能感知工程']]),
  pharmacy: programs([['pharmacy', '药学'], ['chinese_medicine', '中药学'], ['biopharmaceutical', '生物制药']]),
  stomatology: programs([['dental_technology', '口腔医学技术']]),
  integrated_circuits: programs([['microelectronics', '微电子科学与工程'], ['integrated_circuit_design', '集成电路设计与集成系统']]),
  creative_design: programs([['industrial_design', '工业设计'], ['environmental_design', '环境设计'], ['art_and_technology', '艺术与科技'], ['fashion_design', '服装与服饰设计'], ['new_media_art', '新媒体艺术']]),
  business: programs([['international_business', '国际商务'], ['financial_management', '财务管理'], ['marketing', '市场营销']]),
  foreign_languages: programs([['english', '英语'], ['business_english', '商务英语'], ['german', '德语']]),
  music: programs([['music_performance', '音乐表演']]),
}
export const SPECIAL_PROGRAM_MAP: Record<string, AcademicOption[]> = {
  // Future Technology College calls these directions within its selective program, not new degree majors.
  future_technology: programs([['future_electronic_science', '电子科学与技术'], ['future_automation', '自动化'], ['future_materials', '材料科学与工程'], ['future_energy', '新能源科学与工程'], ['future_industrial_design', '工业设计']], 'specialProgram'),
  // Quality and Standards offers X + Quality and Standards across home majors, not a standalone major.
  quality_standards: [],
}
export const GRADUATE_PROGRAM_MAP: Record<string, AcademicOption[]> = {
  engineering_physics: programs([['070200', '物理学'], ['085408_physics', '光电信息工程']]),
  foreign_languages: programs([['055100', '翻译']]),
  artificial_intelligence: programs([['085404', '计算机技术'], ['085411', '大数据技术与工程']]),
  health_environment: programs([['085409', '生物医学工程']]),
  sino_german_manufacturing: programs([['085501', '机械工程']]),
  new_materials_energy: programs([['085601', '材料工程'], ['085601_energy_lab', '材料工程（未来能源与环境安全实验室）']]),
  urban_transport_logistics: programs([['086100', '交通运输']]),
  pharmacy: programs([['105500', '药学']]),
  integrated_circuits: programs([['085403', '集成电路工程'], ['085408_integrated_center', '光电信息工程（集成光电子工程中心）']]),
}

export const getCollege = (name: string) => COLLEGES.find(item => item.displayName === name)
export function getPrograms(role: UserRole, collegeName: string): AcademicOption[] {
  if (role === 'teacher') return []
  const id = getCollege(collegeName)?.id
  if (!id) return []
  return role === 'postgraduate'
    ? GRADUATE_PROGRAM_MAP[id] ?? []
    : [...(UNDERGRAD_MAJOR_MAP[id] ?? []), ...(SPECIAL_PROGRAM_MAP[id] ?? [])]
}
export const needsProgram = (role: UserRole, collegeName: string) =>
  role !== 'teacher' && getPrograms(role, collegeName).length > 0
export const getProgram = (role: UserRole, collegeName: string, majorName: string) =>
  getPrograms(role, collegeName).find(item => item.displayName === majorName)
