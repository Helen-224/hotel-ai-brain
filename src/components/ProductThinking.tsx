export function ProductThinking() {
  const links = [
    ['看清全局', '汇集预订、房态、维修和排班信息，将经营目标、现场问题与具体任务关联起来。'],
    ['组织协作', '识别异常与潜在风险，分析影响和任务依赖，规划跨部门协作方案，由管理者判断与授权。'],
    ['跟进结果', '让员工获得清晰且有上下文的任务，持续跟进执行、交接和结果验证，让住客需求得到连贯响应。'],
  ];
  return <section id="why" className="collaboration-thinking">
    <span className="eyebrow">01 / 产品构想</span>
    <h2>一个理解全局、<br className="vision-break"/>推动协作的智能运营大脑。</h2>
    <p className="vision-origin">酒店并不缺少系统、数据和岗位，难的是让信息与行动真正连接起来。</p>
    <div className="thinking-intro">
      <p>这个想法源于我对酒店日常运营的观察：信息分散在不同部门、系统和沟通渠道中，经营目标、现场问题与具体任务之间缺少有效关联。管理者难以及时掌握全局，员工也需要反复确认任务背景、优先级和交接信息。很多问题并非没有人负责，而是缺少看清全局、发现问题并组织协作的机制。</p>
      <p>因此，我提出 <strong>Hotel AI Brain（酒店智能运营大脑）</strong>：在酒店现有业务系统之上，建立一层智能运营协调能力。汇集运营信息，理解业务状态与任务依赖，识别风险、分析影响、规划协作，并在获得授权后推动执行、持续跟进与结果验证。让管理者、员工和不同部门围绕同一经营目标，形成共同的运营认知。</p>
    </div>
    <div className="positioning-problems">{links.map(([title, copy], i) => <article key={title}><span>0{i + 1}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
    <div className="idea-flow" aria-label="产品构想流程">
      <div><small>感知</small><strong>汇集业务信息</strong><span>预订、房态、维修、排班</span></div><b aria-hidden="true">→</b>
      <div className="idea-flow-core"><small>理解与协调</small><strong>关联问题与行动</strong><span>专业分析、方案规划、人工授权</span></div><b aria-hidden="true">→</b>
      <div><small>执行与验证</small><strong>协同跟进结果</strong><span>清晰任务、执行反馈、结果确认</span></div>
    </div>
    <p className="vision-belief">让数据成为判断的依据，让 AI 成为协作的推动者，<br className="vision-break"/>让人与团队专注于更有价值的服务和决策。</p>
    <p className="idea-caption">以上是产品构想与目标流程。当前 Demo 使用模拟数据展示设计思路，业务闭环仍在完善；判断、审批和重要决策由人负责。</p>
  </section>;
}
