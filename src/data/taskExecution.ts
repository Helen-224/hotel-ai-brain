import {businessTime,roomDeliveryReasons} from './businessWorkflow';
import {
  hasTaskAuthorization, bookings, currentBusinessTasks, currentMaintenanceOrders, employees, shifts,
  type BusinessContext, type OperationEvent, type TaskExecutionException,
  type TaskExecutionRecord, type ExecutionExceptionType,
} from './hotelDemo';
import type {HotelBusinessState} from './coordinationExecution';

export type TaskExecutionCommand = {
  eventId:string; taskId:string; actorEmployeeId:string; occurredAt:string;
} & ({action:'start'|'complete'; note?:string} | {
  action:'report_exception'; exceptionType:ExecutionExceptionType; note:string;
});
export interface ExceptionHandlingCommand {
  exceptionId:string; action:'acknowledge'|'close'; actorName:string; occurredAt:string; note:string;
}
export type TaskOperationResult = {ok:boolean; state:HotelBusinessState; message:string};
const date = (value:string)=>Date.parse(value);
const overlaps = (a:string,b:string,c:string,d:string)=>date(a)<date(d)&&date(c)<date(b);
export const exceptionTypeLabels:Record<ExecutionExceptionType,string> = {
  delay:'任务延迟', employee_unavailable:'人员不可用',
  conditions_changed:'业务条件变化', new_issue:'发现新问题',
};

// 基于当前有效安排检查；Demo 不以电脑时钟自动推进固定业务日期的任务。
export function taskStartBlockReasons(taskId:string,events:OperationEvent[],view:BusinessContext={}) {
  const tasks=currentBusinessTasks(events,view),task=tasks.find(t=>t.id===taskId);
  if(!task)return ['任务不存在'];
  const reasons:string[]=[];
  for(const exception of view.executionExceptions||[]) {
    if(exception.taskId===taskId&&exception.status!=='closed')reasons.push('尚未解除的执行异常：'+exception.exceptionId+'（'+(exception.status==='open'?'待处理':'已确认、未关闭')+'）');
  }
  for(const id of task.dependsOnTaskIds) {
    const prerequisite=tasks.find(t=>t.id===id);
    if(!prerequisite)reasons.push('前置任务不存在：'+id);
    else if(prerequisite.executionStatus!=='completed')reasons.push('前置任务尚未执行完成：'+id);
    else if(date(prerequisite.plannedEndAt)>date(task.plannedStartAt))reasons.push('前置任务计划时序冲突：'+id);
  }
  const orders=currentMaintenanceOrders(events,view);
  for(const id of task.blockedByMaintenanceOrderIds) {
    const order=orders.find(m=>m.id===id);
    if(!order||order.status!=='completed')reasons.push('维修阻塞尚未解除：'+id);
  }
  const employee=employees.find(e=>e.id===task.assignedEmployeeId);
  const skill=task.taskType==='breakfast'?(task.title.includes('迎宾')?'breakfast_greeting':'breakfast_service'):task.taskType;
  if(!employee?.skills.includes(skill))reasons.push('当前负责人不具备所需技能：'+skill);
  const shift=shifts.find(s=>s.employeeId===task.assignedEmployeeId&&date(s.startAt)<=date(task.plannedStartAt)&&date(s.endAt)>=date(task.plannedEndAt));
  if(!Number.isFinite(date(task.plannedStartAt))||!Number.isFinite(date(task.plannedEndAt))||date(task.plannedEndAt)<=date(task.plannedStartAt))reasons.push('任务计划时间无效');
  if(!shift)reasons.push('当前安排不在负责人班次内');
  else {
    if(shift.breakPeriods.some(b=>overlaps(task.plannedStartAt,task.plannedEndAt,b.startAt,b.endAt)))reasons.push('当前安排占用休息时间');
    if(employee?.departmentId!==task.departmentId&&(!employee?.supportRoles.includes(skill)||!shift.supportWindows.some(w=>date(w.startAt)<=date(task.plannedStartAt)&&date(w.endAt)>=date(task.plannedEndAt))))reasons.push('跨部门岗位授权或支援窗口不满足');
  }
  if(tasks.some(t=>t.id!==task.id&&t.assignedEmployeeId===task.assignedEmployeeId&&t.executionStatus==='in_progress'))reasons.push('负责人还有进行中的任务，不能同时开始另一项作业');
  if(tasks.some(t=>t.id!==task.id&&t.assignedEmployeeId===task.assignedEmployeeId&&overlaps(task.plannedStartAt,task.plannedEndAt,t.plannedStartAt,t.plannedEndAt)))reasons.push('负责人当前计划与其他业务任务重叠');
  const reservations=(view.supportReservations||[]).filter(r=>r.employeeId===task.assignedEmployeeId);
  if(reservations.some(r=>overlaps(task.plannedStartAt,task.plannedEndAt,r.startAt,r.endAt)))reasons.push('当前任务与已登记支援占用冲突');
  const workDate=task.plannedStartAt.slice(0,10);
  const dailyLoad=tasks.filter(t=>t.assignedEmployeeId===task.assignedEmployeeId&&t.plannedStartAt.startsWith(workDate)).reduce((n,t)=>n+(date(t.plannedEndAt)-date(t.plannedStartAt))/60000,0)+reservations.filter(r=>r.startAt.startsWith(workDate)).reduce((n,r)=>n+(date(r.endAt)-date(r.startAt))/60000,0);
  if(employee&&dailyLoad>employee.dailyCapacityMinutes)reasons.push('当前安排超出负责人每日工作容量');
  if(task.taskType==='maintenance') {
    const order=orders.find(m=>m.id===task.maintenanceOrderId);
    if(!order||order.accessArrangement.guestConsentStatus!=='confirmed'||date(order.accessArrangement.accessScheduledAt)!==date(task.plannedStartAt)||date(order.plannedStartAt)!==date(task.plannedStartAt)||date(order.estimatedCompletionAt)!==date(task.plannedEndAt)||order.assignedEmployeeId!==task.assignedEmployeeId)reasons.push('维修入房授权、预约时间或负责人不一致');
  }
  if(task.taskType==='cleaning'&&bookings.some(b=>b.roomId===task.roomId&&b.bookingStatus==='checked_in'&&date(b.checkOutAt)>date(task.plannedStartAt)))reasons.push('计划清洁时间早于住客退房时间');
  return [...new Set(reasons)];
}

function fail(state:HotelBusinessState,message:string):TaskOperationResult {return {ok:false,state,message};}
function eventRecord(events:OperationEvent[],eventId:string,id:string,time:string,text:string) {
  return events.map(event=>event.id===eventId?{...event,records:[...event.records,{id,time,text}]}:event);
}

// 所有失败均返回原引用；成功一次性返回状态、事件投影和唯一任务记录。
export function executeTask(state:HotelBusinessState,command:TaskExecutionCommand):TaskOperationResult {
  if(!state.currentEmployeeId||state.currentEmployeeId!==command.actorEmployeeId)return fail(state,'缺少当前模拟员工身份或执行人身份不一致');
  if(!['start','complete','report_exception'].includes(command.action))return fail(state,'不支持的任务操作');
  const task=currentBusinessTasks(state.events,state).find(t=>t.id===command.taskId);
  if(!task)return fail(state,'任务不存在');
  const event=state.events.find(e=>e.id===command.eventId);
  if(!event?.businessRefs?.businessTaskIds.includes(task.id))return fail(state,'任务不属于指定运营事件');
  if(!employees.some(e=>e.id===command.actorEmployeeId)||task.assignedEmployeeId!==command.actorEmployeeId)return fail(state,'只有当前有效负责人可以执行或报告该任务');
  if(!hasTaskAuthorization(task.id,state))return fail(state,'任务尚未正式派发给当前员工');
  if(command.occurredAt!==businessTime(state))return fail(state,'操作时间必须使用当前模拟业务时间');
  if(command.action==='start'&&date(businessTime(state))<date(task.plannedStartAt))return fail(state,'尚未到计划执行时间');
  if(command.action==='complete'&&task.taskType==='delivery'&&task.roomId&&roomDeliveryReasons(state,task.roomId).length)return fail(state,'客房交付条件尚未满足');
  if(!Number.isFinite(date(command.occurredAt)))return fail(state,'操作时间无效');
  const records=state.executionRecords||[],exceptions=state.executionExceptions||[];
  const latest=records.filter(r=>r.taskId===task.id).at(-1);
  if(latest&&date(command.occurredAt)<date(latest.occurredAt))return fail(state,'操作时间不能早于该任务已有执行记录');
  const relatedEventIds=state.events.filter(e=>e.businessRefs?.businessTaskIds.includes(task.id)).map(e=>e.id);
  const plan=[...state.executionPlans].reverse().find(p=>p.affectedTaskIds.includes(task.id));
  const recordId=`task-execution-${task.id}-${records.length+1}`;
  const common={recordId,taskId:task.id,eventId:event.id,relatedEventIds,executionPlanId:plan?.executionPlanId,actorEmployeeId:command.actorEmployeeId,occurredAt:command.occurredAt,note:command.note?.trim()||''};
  let record:TaskExecutionRecord;
  let next:HotelBusinessState;
  if(command.action==='report_exception') {
    if(!Object.hasOwn(exceptionTypeLabels,command.exceptionType)||!command.note.trim())return fail(state,'请选择有效异常类型并填写异常说明');
    const duplicate=exceptions.find(e=>e.taskId===task.id&&e.reportedBy===command.actorEmployeeId&&e.exceptionType===command.exceptionType&&e.description===command.note.trim()&&e.status!=='closed');
    if(duplicate)return {ok:true,state,message:'相同未关闭异常已记录，不重复提交'};
    const exception:TaskExecutionException={exceptionId:`task-exception-${task.id}-${exceptions.length+1}`,taskId:task.id,eventId:event.id,relatedEventIds,executionPlanId:plan?.executionPlanId,reportedBy:command.actorEmployeeId,exceptionType:command.exceptionType,description:command.note.trim(),status:'open',createdAt:command.occurredAt,updatedAt:command.occurredAt,handlingRecords:[]};
    record={...common,action:'exception_reported',exceptionId:exception.exceptionId};
    next={...state,executionExceptions:[...exceptions,exception]};
  } else {
    if(event.approval!=='approved')return fail(state,'原事件审批尚未通过，不能执行任务');
    const expected=command.action==='start'?'pending':'in_progress';
    if(task.executionStatus!==expected)return fail(state,command.action==='start'?'仅待执行任务可以开始，不重复开始':'仅进行中任务可以完成，不重复完成');
    if(command.action==='start') {
      const reasons=taskStartBlockReasons(task.id,state.events,state);
      if(reasons.length)return fail(state,reasons.join('；'));
    }
    if(task.actualStartedAt&&date(command.occurredAt)<date(task.actualStartedAt))return fail(state,'完成时间不能早于实际开始时间');
    const status=command.action==='start'?'in_progress':'completed';
    const execution={...state.taskExecutions?.[task.id],executionStatus:status as 'in_progress'|'completed',...(command.action==='start'?{actualStartedAt:command.occurredAt,startedBy:command.actorEmployeeId}:{actualCompletedAt:command.occurredAt,completedBy:command.actorEmployeeId})};
    record={...common,action:command.action==='start'?'started':'completed'};
    next={...state,taskExecutions:{...state.taskExecutions,[task.id]:execution},events:state.events.map(e=>({...e,tasks:e.tasks.map(t=>t.id===task.id?{...t,status}:t)}))};
  }
  const text=record.action==='started'?'开始执行':record.action==='completed'?'执行完成（结果未验证）':'报告异常：'+exceptionTypeLabels[(command as Extract<TaskExecutionCommand,{action:'report_exception'}>).exceptionType];
  return {ok:true,state:{...next,revision:state.revision+1,executionRecords:[...records,record],events:eventRecord(next.events,event.id,recordId,command.occurredAt,`${task.id} · ${command.actorEmployeeId} · ${text}${common.note?' · '+common.note:''}`)},message:record.action==='exception_reported'?'异常已记录，任务安排和执行状态未改变':text};
}

export function handleExecutionException(state:HotelBusinessState,command:ExceptionHandlingCommand):TaskOperationResult {
  if(state.currentEmployeeId||state.actorRole==='staff')return fail(state,'工作人员不能处理管理异常');
  if(!['acknowledge','close'].includes(command.action))return fail(state,'不支持的异常处理操作');
  const exception=state.executionExceptions?.find(e=>e.exceptionId===command.exceptionId);
  if(!exception)return fail(state,'执行异常不存在');
  if(!command.actorName.trim()||!command.note.trim()||!Number.isFinite(date(command.occurredAt))||date(command.occurredAt)<date(exception.updatedAt))return fail(state,'请填写处理人、处理说明和有效操作时间');
  if(exception.status==='closed'||command.action==='acknowledge'&&exception.status!=='open')return fail(state,'异常状态已变化，不重复处理');
  const status=command.action==='acknowledge'?'acknowledged':'closed';
  const handlingRecord:TaskExecutionException['handlingRecords'][number]={status,actorName:command.actorName.trim(),occurredAt:command.occurredAt,note:command.note.trim()};
  const updated:TaskExecutionException={...exception,status,updatedAt:command.occurredAt,handlingRecords:[...exception.handlingRecords,handlingRecord]};
  return {ok:true,state:{...state,revision:state.revision+1,executionExceptions:state.executionExceptions!.map(e=>e.exceptionId===exception.exceptionId?updated:e)},message:status==='closed'?'异常已处理；任务执行及业务验证状态未改变':'异常已确认；没有批准或应用资源调整'};
}
