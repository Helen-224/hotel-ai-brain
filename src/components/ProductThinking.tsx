export function ProductThinking() {
  const links = [
    ['系统各自记录', '预订、房态、维修和排班分散在不同业务环节。'],
    ['工作彼此关联', '一间房的维修进度会影响清洁安排与交房确认。'],
    ['需要中心协调', '管理者要看清影响、安排先后，并跟进执行反馈。'],
  ];
  return <section id="why" className="collaboration-thinking">
    <span className="eyebrow">01 / 产品构想</span>
    <h2>让酒店信息汇成全局，让协作围绕同一目标。</h2>
    <div className="thinking-intro">
      <p>我希望 Hotel AI Brain 成为酒店的智能辅助大脑：汇集各部门运营信息，帮助管理者看清问题与任务之间的关系，再把需要处理的工作协调到相关岗位。</p>
      <p>员工能更快获得清楚的任务和必要上下文，减少查找与交接成本；酒店也能更及时地回应住客需求。人仍负责判断、审批和重要决策。</p>
    </div>
    <div className="positioning-problems">{links.map(([title, copy], i) => <article key={title}><span>0{i + 1}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
    <div className="idea-flow" aria-label="产品构想流程">
      <div><small>输入</small><strong>酒店信息</strong><span>预订、房态、维修、排班</span></div><b aria-hidden="true">→</b>
      <div className="idea-flow-core"><small>中心枢纽</small><strong>分析与协调</strong><span>关联问题，组织任务</span></div><b aria-hidden="true">→</b>
      <div><small>行动</small><strong>部门执行</strong><span>接收任务，反馈进度</span></div>
    </div>
    <p className="idea-caption">信息汇入中心，任务走向岗位，执行情况回到管理视图。</p>
  </section>;
}
