import './HotelVisual.css';

const departments = [
  { name: '前厅', task: '接待与需求承接', kind: 'front' },
  { name: '客房', task: '房间准备与交付', kind: 'rooms' },
  { name: '工程', task: '维修与故障处理', kind: 'engineering' },
  { name: '餐饮', task: '早餐服务与排班', kind: 'dining' },
];

export function HotelVisual() {
  return <figure className="coordination-map hub-map" aria-label="酒店系统汇集运营信息，智能运营大脑辅助分析协调，管理者确认后向部门分发任务并接收执行反馈">
    <figcaption><span>产品工作方式</span><strong>让信息、判断与行动连起来</strong></figcaption>
    <div className="hub-sources">
      <div><small>信息汇集</small><strong>酒店业务信息</strong><span>预订 · 房态 · 维修 · 排班 · 服务需求</span></div>
      <b aria-hidden="true">↓</b>
    </div>
    <div className="hub-brain"><small>HOTEL AI BRAIN</small><strong>智能运营协同大脑</strong><div><span>理解关联</span><i>→</i><span>发现问题</span><i>→</i><span>协调任务</span></div></div>
    <div className="hub-human"><span>管理者判断 · 审批与授权</span></div>
    <div className="hub-departments">{departments.map(d => <div className={'hub-dept '+d.kind} key={d.kind}><strong>{d.name}</strong><span>{d.task}</span></div>)}</div>
    <div className="hub-feedback"><span>任务分发 ↓</span><span>执行反馈 ↑ · 持续跟进</span></div>
    <p className="hub-note">辅助员工协作，支持更及时、连续的住客服务</p>
  </figure>;
}
