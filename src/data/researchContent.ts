export const sources = {
  industry: ['中国饭店协会 · 2026年中国酒店业发展报告', 'https://www.chinahotel.org.cn/articles/17733'],
  staffing: ['中国旅游饭店业协会 · 酒店人力资源现状调查报告（2024）解读', 'https://npo012020.npoall.com/news/itemid-72461.html'],
  digital: ['石基集团 · 2026年中国酒店业数字化转型趋势报告', 'https://www.shijigroup.cn/news/press20260327.html'],
  mews: ['Mews', 'https://www.mews.com/'],
  flexkeeping: ['Flexkeeping', 'https://flexkeeping.com/'],
  optii: ['Optii', 'https://www.optiisolutions.com/'],
} as const;

export const dataInputs = [
  ['经营与收益', 'PMS、RMS、财务系统', '入住率、ADR、RevPAR、GOP、预订预测、经营目标', '前厅 Agent（到店需求）与酒店业务认知层（经营目标）', '理解经营目标和经营压力', '确定优先保障的交付时段与服务目标'],
  ['预订与客房', 'PMS、客房管理系统', '预订、预计入住、退房、房态、客房清洁、检查进度', '前厅 Agent、客房 Agent', '识别入住准备风险和客房交付条件', '安排清洁检查顺序与交房优先级'],
  ['工程维修', '工程维修系统', '维修工单、故障等级、维修预约、入房授权、验收状态', '工程 Agent', '判断维修是否阻塞交付及其前置依赖', '确定维修、验收和清洁的衔接顺序'],
  ['员工与排班', 'HR、排班系统', '岗位、技能、班次、休息时间、任务容量、支援窗口', '人力 Agent', '判断资源可用性、技能匹配和人员负荷', '比较调班和跨部门支援方案'],
  ['住客与服务', 'CRM、住客服务系统、餐饮系统', 'VIP 需求、住客偏好、服务请求、早餐权益、服务时段', '前厅 Agent、客房 Agent、人力 Agent', '识别服务优先级、交接需求及岗位覆盖风险', '安排 VIP 服务交接与早餐岗位覆盖'],
] as const;
