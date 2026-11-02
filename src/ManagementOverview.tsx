import {useState} from 'react';
import {hotelDemo as hotel, snapshot, bookings, rooms, businessSummary, currentBusinessTasks, currentMaintenanceOrders, breakfastCoverage, breakfastDemand, type OperationEvent, type BusinessContext} from './data/hotelDemo';
import './management.css';

export function ManagementOverview({events,view}:{events:OperationEvent[];view:BusinessContext}) {
 const [period,setPeriod]=useState<'today'|'tomorrow'>('tomorrow');
 const s=businessSummary(events,view);
 const date=period==='today'?hotel.date:snapshot.tomorrowAt.slice(0,10);
 const valid=bookings.filter(b=>['confirmed','checked_in','checked_out'].includes(b.bookingStatus));
 const arrivals=valid.filter(b=>b.checkInAt.startsWith(date));
 const departures=valid.filter(b=>b.checkOutAt.startsWith(date));
 const tasks=currentBusinessTasks(events,view);
 const repairs=currentMaintenanceOrders(events,view);
 const blockers=repairs.filter(m=>m.blocksRoomDelivery&&m.verificationStatus!=='verified');
 const coverage=breakfastCoverage(undefined,view);
 const gaps=coverage.filter(c=>c.gap>0);
 const pendingRequests=valid.flatMap(b=>b.specialRequests).filter(r=>r.status==='hotel_pending');
 const open=events.filter(e=>e.resolutionStatus!=='resolved').sort((a,b)=>Number(b.risk==='高')-Number(a.risk==='高'));
 const facts:Record<string,string>={arrival:`${s.unprepared} 间客房待准备，${blockers.length} 项维修影响交付准备。`,breakfast:gaps.length?`${gaps.length} 个岗位时段覆盖不足，需核对早餐支援安排。`:'早餐岗位覆盖已满足，继续跟进到岗与服务准备。',vip:`明日 ${s.vip} 间 VIP 预订，${pendingRequests.length} 项服务需求待酒店确认。`};
 const periodTasks=tasks.filter(t=>t.plannedStartAt.startsWith(date));
 return <div className="management-overview">
  <div className="overview-date"><span>业务快照 · {hotel.date} 18:00</span><span>共 {s.totalRooms} 间客房</span></div>
  <section className="overview-kpis" aria-label="入住与接待概况">
   {[['当前入住率',`${s.todayRate}%`,`${s.today} 间在住 / ${s.totalRooms} 间客房`],['明日预计入住率',`${s.tomorrowRate}%`,`较当前增加 ${s.tomorrow-s.today} 间在住`],['明日到店',`${valid.filter(b=>b.checkInAt.startsWith(snapshot.tomorrowAt.slice(0,10))).length}`,`间客房 · 含 ${s.vip} 间 VIP 预订`],['明日离店',`${valid.filter(b=>b.checkOutAt.startsWith(snapshot.tomorrowAt.slice(0,10))).length}`,'间客房 · 关注退房后的清洁衔接']].map(([label,value,note])=><article key={label}><p>{label}</p><strong>{value}</strong><small>{note}</small></article>)}
  </section>
  <section className="platform-card"><h2>AI 运营判断 · 模拟业务摘要</h2>{open[0]?<><h3>{open[0].title}</h3><p>{facts[open[0].id]||open[0].summary}</p><p>依据：{open[0].evidence[0]||open[0].summary}</p><a href={import.meta.env.BASE_URL+'app/coordination?event='+open[0].id+'&tab=analysis'}>查看专业分析 →</a></>:<p>当前没有未解决运营事件。</p>}<small>按现有事件风险优先展示，不代表新增实时模型分析。</small></section><div className="overview-columns">
   <section className="platform-card overview-attention"><div className="overview-section-heading"><h2>需要关注</h2><span>{open.length} 项未解决</span></div>
    {open.length?open.map(e=><article className="overview-event" key={e.id}><div><span className={e.risk==='高'?'overview-priority':'overview-normal'}>{e.risk==='高'?'优先关注':'待跟进'}</span><h3>{e.title}</h3></div><p>{facts[e.id]||e.summary}</p><footer><small>{hotel.departments.filter(d=>e.departmentIds.includes(d.id)).map(d=>d.name).join(' · ')}</small><a href={`/app/coordination?event=${e.id}&tab=analysis`}>查看并处理 →</a></footer></article>):<p>暂无未解决的运营事项。</p>}
   </section>
   <section className="platform-card overview-preparation"><div className="overview-section-heading"><h2>客房准备</h2><span>明日接待</span></div><div className="overview-room-number"><strong>{s.unprepared}</strong><span>间待准备</span></div><p>先完成维修、清洁与检查，再确认客房交付。</p><dl><div><dt>清洁作业已完成</dt><dd>{tasks.filter(t=>t.taskType==='cleaning'&&t.executionStatus==='completed').length} / {tasks.filter(t=>t.taskType==='cleaning').length} 项</dd></div><div><dt>检查作业已完成</dt><dd>{tasks.filter(t=>t.taskType==='inspection'&&t.executionStatus==='completed').length} / {tasks.filter(t=>t.taskType==='inspection').length} 项</dd></div><div><dt>影响交付的维修待验证</dt><dd className="overview-warning">{blockers.length} 项</dd></div></dl><a className="overview-action" href="/app/coordination?event=arrival&tab=tracking">查看客房准备进展 →</a><small className="overview-note">待准备间数按房态快照统计，作业完成后仍需确认交付。</small></section>
  </div>
  <section className="platform-card overview-daily"><div className="overview-section-heading"><div><h2>接待与执行安排</h2><p>{date} · {period==='tomorrow'?'预订与计划安排':'当前业务快照'}</p></div><div className="overview-switch" aria-label="查看安排日期"><button aria-pressed={period==='today'} onClick={()=>setPeriod('today')}>今日</button><button aria-pressed={period==='tomorrow'} onClick={()=>setPeriod('tomorrow')}>明日</button></div></div><div className="overview-day-stats"><div><span>到店客房</span><strong>{arrivals.length}<small> 间</small></strong></div><div><span>离店客房</span><strong>{departures.length}<small> 间</small></strong></div><div><span>VIP 到店</span><strong>{arrivals.filter(b=>b.isVip).length}<small> 间</small></strong></div><div><span>计划作业</span><strong>{periodTasks.length}<small> 项</small></strong></div></div>
   <div className="overview-departments">{hotel.departments.map(d=>{const own=periodTasks.filter(t=>t.departmentId===d.id);return <div key={d.id}><strong>{d.name}</strong><span>{own.length?`${own.filter(t=>t.executionStatus==='completed').length} / ${own.length} 项已执行`:'暂无计划作业'}</span><progress aria-label={`${d.name}作业完成进度`} max={own.length||1} value={own.filter(t=>t.executionStatus==='completed').length}/></div>})}</div>
   {period==='tomorrow'&&<p className="overview-breakfast">早餐预选人数：{breakfastDemand().map(d=>`${d.slotId==='early'?'07:00–08:00':'08:00–09:00'} ${d.persons} 人`).join('；')}。<a href="/app/coordination?event=breakfast&tab=analysis">查看服务安排 →</a></p>}
  </section>
  <details className="overview-method"><summary>数据说明与统计范围</summary><p>全部为虚构演示数据。当前入住与明日预计入住分别取两日 18:00 的有效预订，分母为 {rooms.length} 间客房。未入住客房不等于可售客房。到离店按所选日期的有效预订客房统计；作业按计划开始日期归属，完成不等于验收。</p><p>当前没有每日营收、平均房价（ADR）和每间可售房收入（RevPAR）数据，因此本页暂不展示这些指标。明日以外的预测也未提供。</p></details>
 </div>;
}
