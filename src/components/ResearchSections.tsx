import {useState, type ReactNode} from 'react';
import {dataInputs, sources} from '../data/researchContent';
import '../research.css';

function Source({name}: {name: keyof typeof sources}) {
  const [label, url] = sources[name];
  return <a href={url}>{label} ↗</a>;
}

function ResearchSection({id, label, title, children}: {id: string; label: string; title: string; children: ReactNode}) {
  return <section id={id} className="research-section" aria-labelledby={id + '-title'}>
    <span className="eyebrow">{label}</span>
    <h2 id={id + '-title'}>{title}</h2>
    {children}
  </section>;
}

function Flow({steps}: {steps: string[]}) {
  return <ol className="research-flow">{steps.map(step => <li key={step}>{step}</li>)}</ol>;
}

export function IndustryContext() {
  return <ResearchSection id="industry" label="02 / 行业背景" title="有限人力下，单店运营效率也是竞争力。">
    <dl className="research-grid research-stats">
      <div><dt>中国大陆酒店业设施</dt><dd>374,694<small> 家</small></dd></div>
      <div><dt>面临客源流失与盈利压力的非连锁单体酒店</dt><dd><small>近 </small>58.2%</dd></div>
      <div><dt>酒店平均客房规模</dt><dd><small>约 </small>50<small> 间</small></dd></div>
    </dl>
    <p className="research-source"><Source name="industry"/> · 截至 2025 年 12 月 31 日</p>
    <div className="research-grid research-two">
      <article><h3>一线用工 · 2023 年调查</h3><p>734 份问卷覆盖 45 家国内酒店集团、15 家国际酒店集团和 73 家单体酒店。人才紧缺反馈比例为餐饮部 60%、前厅部 53%、客房部 50%，统计口径为受访反馈。70% 的受访酒店将人员流动推高招聘需求列为挑战。</p><Source name="staffing"/></article>
      <article><h3>数字化成熟度 · 2026 年行业报告</h3><p>数字化成熟度持续提高，企业之间的能力差距仍明显。领先企业开始布局 AI 驱动的决策，许多企业仍需解决数据获取、准确性和应用问题。</p><Source name="digital"/></article>
    </div>
    <p className="research-note">客源和规模之外，酒店还要在有限人力下提高单店效率和服务质量。这些数据界定研究背景，产品效果需由试点验证。</p>
  </ResearchSection>;
}

export function FieldResearch() {
  return <ResearchSection id="field" label="03 / 用户研究" title="从一次前厅交接，追问信息在哪里断开。">
    <p className="research-note">探索性访谈（N=1）记录了一位匿名五星级酒店前厅从业者的工作体验。其他酒店是否面临类似问题，仍需进一步访谈验证。</p>
    <div className="research-grid">
      <article><h3>一线工作观察</h3><ul><li>现有系统有学习成本，新员工需要同事带教。</li><li>内部沟通较多依赖微信群和口头交接。</li><li>传递中会出现信息不清、遗漏和反复确认。</li><li>外宾沟通中的语言表达差异可能影响服务信息准确性。</li></ul></article>
      <article><h3>初步问题归纳</h3><p>任务背景散落在系统与沟通渠道里，接收人可能需要补问需求、优先级和完成标准。</p></article>
      <article><h3>待验证的产品假设</h3><p>将必要信息、责任人、前置任务和反馈要求随任务交接，能否减少补问与遗漏，并让管理者更早发现交付风险？</p></article>
    </div>
    <Flow steps={['业务发生','信息传递','部门确认','任务分派','执行反馈','结果确认']}/>
    <p>后续研究关注四个节点：信息是否完整、责任是否明确、任务是否衔接、结果是否得到确认。</p>
  </ResearchSection>;
}

export function MarketLandscape() {
  return <ResearchSection id="market" label="04 / 市场与竞品" title="现有工具已覆盖运营，机会在于如何联动。">
    <div className="research-grid research-market">
      <article><h3><Source name="mews"/></h3><p>酒店 PMS、预订、房态、支付及业务集成，为酒店提供共享的运营数据与工作流。</p></article>
      <article><h3><Source name="flexkeeping"/></h3><p>覆盖客房、维修、员工协作、任务派发、检查与服务流程，支持与 PMS 集成。</p></article>
      <article><h3><Source name="optii"/></h3><p>支持客房清洁排程、员工路线优化和房态跟踪，并提供服务协作与维修能力。</p></article>
    </div>
    <div className="research-note"><strong>Hotel AI Brain 的产品机会假设</strong><p>在现有系统与协作工具之上，围绕经营目标理解跨部门状态，识别任务依赖和资源约束，比较协调方案，经管理者授权后推动执行并验证业务结果。需要通过酒店客户访谈和实际试点验证。</p></div>
  </ResearchSection>;
}

export function DataInputMap() {
  const [selected, setSelected] = useState(0);
  const [name, ...details] = dataInputs[selected];
  return <ResearchSection id="data-inputs" label="05 / 业务数据输入" title="从五类业务数据，形成可执行的判断。">
    <div className="research-inputs" role="group" aria-label="选择业务数据类别">
      {dataInputs.map(([title], index) => <button key={title} type="button" aria-pressed={index === selected} aria-controls="input-detail" onClick={() => setSelected(index)}><small>0{index + 1}</small>{title}</button>)}
    </div>
    <div id="input-detail" className="research-input-detail" aria-live="polite">
      <h3>{name}</h3>
      <dl>{['数据来源','数据字段','对应专业 Agent','AI 判断','影响的运营决策'].map((label, index) =>
        <div key={label}><dt>{label}</dt><dd>{details[index]}</dd></div>)}</dl>
    </div>
    <Flow steps={['业务数据','酒店业务认知','专业 Agent 分析','智能协调','执行反馈']}/>
    <p>五类数据从<a href="#architecture">五层架构</a>的采集与集成层进入，经业务认知层关联房间、任务和人员，支撑专业分析与协调。</p>
    <p className="research-note">以上是目标接入架构。当前 Demo 使用虚构酒店数据，真实 PMS、CRM、财务及员工系统接入属于未来工作。</p>
  </ResearchSection>;
}

const metricGroups = [
  ['运营效率', '问题发现至正式派发时间', '客房周转时间', '客房准时交付率', '管理者人工追踪次数'],
  ['协同质量', '跨部门信息遗漏率', '重复沟通次数', '任务责任人明确率', '交接成功率'],
  ['业务结果', '维修验收通过率', '客房交付达成率', '早餐平均等待时间', 'VIP 服务需求按时完成率'],
];

const metricDefinitions = [
  ['客房准时交付率', '目标时间前满足交付条件的客房数 ÷ 当期应交付客房数'],
  ['客房周转时间', '从空脏房到空净且完成检查的时长'],
  ['任务派发耗时', '从问题确认到正式派发任务的时长，与发现至派发的总时长分别记录'],
  ['维修验收通过率', '验收通过的维修工单数 ÷ 提交验收的维修工单数'],
  ['交接成功率', '被接收并完成必要反馈的跨部门交接数 ÷ 总交接数'],
];

export function ValidationFramework() {
  return <ResearchSection id="validation" label="09 / 效果验证" title="用流程、协同与服务结果验证价值。">
    <p className="research-note">未来试点指标 · 当前 Demo 尚无真实酒店试点数据。</p>
    <div className="research-grid">{metricGroups.map(([title, ...metrics]) => <article key={title}><h3>{title}</h3><ul>{metrics.map(metric => <li key={metric}>{metric}</li>)}</ul></article>)}</div>
    <h3>关键指标的计算口径</h3>
    <dl className="research-definitions">{metricDefinitions.map(([name, definition]) => <div key={name}><dt>{name}</dt><dd>{definition}</dd></div>)}</dl>
    <h3>未来试点设计</h3>
    <p>在同一家酒店先记录传统流程基线，再开展智能协调试点。选择入住率、员工人数、班次和特殊活动尽可能相近的观察窗口，比较流程时间、人员负荷、客房交付及服务结果。</p>
  </ResearchSection>;
}

export function ResearchSources() {
  return <ResearchSection id="sources" label="资料索引" title="研究资料与出处">
    <p>外部资料包括行业统计、行业调查与趋势报告、供应商产品资料。一线探索性访谈、产品假设、Demo 模拟数据及未来试点指标均在对应板块单独标注。</p>
    <details className="research-disclosure"><summary>展开全部资料链接</summary><ul className="research-links">{(Object.keys(sources) as (keyof typeof sources)[]).map(name => <li key={name}><Source name={name}/></li>)}</ul></details>
  </ResearchSection>;
}
