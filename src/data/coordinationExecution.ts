import {businessFingerprint,currentBusinessTasks,shifts,type OperationEvent,type BusinessContext,type TaskArrangement,type SupportReservation} from './hotelDemo';
import {validateProposal,type Proposal} from './resourceCoordination';
export interface AdjustmentRecord {taskId:string;before:{employeeId:string;startAt:string;endAt:string};after:{employeeId:string;startAt:string;endAt:string}}
export interface CoordinationExecutionPlan {executionPlanId:string;eventId:string;proposalId:string;proposalName:string;businessVersionBeforeApply:string;businessVersionAfterApply:string;approvedAt:string;appliedAt:string;appliedBy:string;status:'applied';affectedTaskIds:string[];adjustmentRecords:AdjustmentRecord[];supportReservations:SupportReservation[];executionTimeline:{id:string;at:string;actor:string;action:'applied';text:string}[]}
export interface HotelBusinessState extends BusinessContext {events:OperationEvent[];revision:number;taskOverrides:Record<string,TaskArrangement>;supportReservations:SupportReservation[];executionPlans:CoordinationExecutionPlan[]}
export function applicationEligibility(state:HotelBusinessState,proposal:Proposal){
 const existing=state.executionPlans.find(p=>p.proposalId===proposal.id);const reasons:string[]=[];
 if(existing)return {canApply:false,reasons:['该方案已应用，不重复生成计划'],existing};
 const event=state.events.find(e=>e.id===proposal.eventId);if(!event)reasons.push('来源事件不存在');else if(event.approval!=='approved')reasons.push('原事件审批尚未通过');
 if(proposal.approval!=='approved')reasons.push('资源方案尚未批准');if(!proposal.records.some(r=>r.action==='approved'))reasons.push('缺少资源方案批准记录');
 if(proposal.fingerprint!==businessFingerprint(state.events,state))reasons.push('方案业务版本已过期，请重新分析和审批');
 if(proposal.sourceReport.eventId!==proposal.eventId||proposal.sourceReport.fingerprint!==proposal.fingerprint)reasons.push('方案来源分析与业务版本不一致');
 const tasks=currentBusinessTasks(state.events,state);const taskIds=new Set(tasks.map(t=>t.id));
 for(const id of event?.businessRefs?.businessTaskIds||[])if(!taskIds.has(id))reasons.push('关联业务任务不存在：'+id);
 for(const a of proposal.adjustments)if(!event?.businessRefs?.businessTaskIds.includes(a.taskId))reasons.push('调整任务不属于来源事件：'+a.taskId);
 reasons.push(...validateProposal(proposal,state.events,state).violations);
 return {canApply:reasons.length===0,reasons:[...new Set(reasons)],existing:undefined};
}
export type ApplyResult={ok:true;state:HotelBusinessState;plan:CoordinationExecutionPlan;alreadyApplied:boolean}|{ok:false;state:HotelBusinessState;errors:string[]};
// 所有校验在提交前完成；调用方只用一次状态更新接收返回值。
export function applyApprovedProposal(state:HotelBusinessState,proposal:Proposal,meta:{appliedAt:string;appliedBy:string}):ApplyResult{
 if(state.currentEmployeeId||state.actorRole==='staff')return {ok:false,state,errors:['工作人员不能应用资源方案']};
 const check=applicationEligibility(state,proposal);
 if(check.existing)return {ok:true,state,plan:check.existing,alreadyApplied:true};
 if(!check.canApply)return {ok:false,state,errors:check.reasons};
 if(!Number.isFinite(Date.parse(meta.appliedAt))||!meta.appliedBy.trim()||!Number.isFinite(Date.parse(proposal.records.find(r=>r.action==='approved')!.at))||Date.parse(meta.appliedAt)<Date.parse(proposal.records.find(r=>r.action==='approved')!.at))return {ok:false,state,errors:['应用时间或操作者无效']};
 const tasks=currentBusinessTasks(state.events,state);const adjustments:AdjustmentRecord[]=proposal.adjustments.map(a=>{const before=tasks.find(t=>t.id===a.taskId)!;return {taskId:a.taskId,before:{employeeId:before.assignedEmployeeId,startAt:before.plannedStartAt,endAt:before.plannedEndAt},after:{employeeId:a.employeeId,startAt:a.startAt,endAt:a.endAt}}});
 const executionPlanId='execution-'+proposal.id;
 const reservations:SupportReservation[]=proposal.support.map((a,i)=>{const shift=shifts.find(s=>s.employeeId===a.employeeId&&s.supportWindows.some(w=>w.startAt<=a.startAt&&w.endAt>=a.endAt))!;const index=shift.supportWindows.findIndex(w=>w.startAt<=a.startAt&&w.endAt>=a.endAt);return {reservationId:executionPlanId+'-support-'+i,employeeId:a.employeeId,eventId:proposal.eventId,proposalId:proposal.id,roleId:a.role,serviceId:'BF-1101',slotId:a.slotId,shiftWindowId:shift.id+':support:'+index,startAt:a.startAt,endAt:a.endAt,status:'reserved'};});
 const overrides={...state.taskOverrides};for(const a of adjustments)overrides[a.taskId]={assignedEmployeeId:a.after.employeeId,plannedStartAt:a.after.startAt,plannedEndAt:a.after.endAt};
 const next:HotelBusinessState={...state,revision:state.revision+1,taskOverrides:overrides,supportReservations:[...state.supportReservations,...reservations],executionPlans:state.executionPlans};
 const plan:CoordinationExecutionPlan={executionPlanId,eventId:proposal.eventId,proposalId:proposal.id,proposalName:proposal.name,businessVersionBeforeApply:businessFingerprint(state.events,state),businessVersionAfterApply:businessFingerprint(next.events,next),approvedAt:proposal.records.find(r=>r.action==='approved')!.at,appliedAt:meta.appliedAt,appliedBy:meta.appliedBy,status:'applied',affectedTaskIds:adjustments.map(a=>a.taskId),adjustmentRecords:adjustments,supportReservations:reservations,executionTimeline:[{id:executionPlanId+'-applied',at:meta.appliedAt,actor:meta.appliedBy,action:'applied',text:'获批方案已原子应用到模拟安排；任务执行、业务验证与事件解决状态未改变。'}]};
 return {ok:true,state:{...next,executionPlans:[...state.executionPlans,plan]},plan,alreadyApplied:false};
}
