import {hasTaskAuthorization,currentBusinessTasks,employees,type BusinessContext,type OperationEvent} from './hotelDemo';
import {executeTask,taskStartBlockReasons,type TaskExecutionCommand} from './taskExecution';
import type {HotelBusinessState} from './coordinationExecution';

export function staffTasks(events:OperationEvent[],view:BusinessContext) {
  if(!employees.some(e=>e.id===view.currentEmployeeId))return [];
  return currentBusinessTasks(events,view).filter(t=>t.assignedEmployeeId===view.currentEmployeeId&&hasTaskAuthorization(t.id,view)).map(task=>{
    const related=events.filter(e=>e.businessRefs?.businessTaskIds.includes(task.id));
    const event=related.find(e=>e.approval==='approved')||related[0];
    const reasons=taskStartBlockReasons(task.id,events,view);
    if(!event||event.approval!=='approved')reasons.unshift('关联事件尚未批准，等待管理人员授权');
    const category=task.executionStatus==='pending'&&reasons.length?'blocked':task.executionStatus;
    return {task,event,reasons,category};
  });
}

// 以 Platform 当前身份为边界，再调用 A 阶段接口；不信任页面提交的身份。
export function executeStaffTask(state:HotelBusinessState,command:TaskExecutionCommand) {
  if(!state.currentEmployeeId||command.actorEmployeeId!==state.currentEmployeeId)
    return {ok:false,state,message:'模拟员工身份已变化，请重新操作'};
  return executeTask(state,command);
}
