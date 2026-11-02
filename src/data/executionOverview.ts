import {currentBusinessTasks,currentMaintenanceOrders,snapshot,type OperationEvent} from './hotelDemo';
import type {HotelBusinessState} from './coordinationExecution';
import {taskStartBlockReasons} from './taskExecution';

export type ExecutionScope='event'|'all';
export function executionOverview(events:OperationEvent[],view:HotelBusinessState,eventId:string,scope:ExecutionScope,at=view.simulatedAt||snapshot.at) {
  const selectedEvents=events.filter(e=>scope==='all'||e.id===eventId);
  const ids=new Set(selectedEvents.flatMap(e=>e.businessRefs?.businessTaskIds||[]));
  const all=currentBusinessTasks(events,view),byId=new Map(all.map(t=>[t.id,t]));
  const orders=currentMaintenanceOrders(events,view);
  const exceptions=[...new Map((view.executionExceptions||[]).filter(e=>ids.has(e.taskId)).map(e=>[e.exceptionId,e])).values()];
  const describe=(task:(typeof all)[number])=>{
    const relatedEvents=events.filter(e=>e.businessRefs?.businessTaskIds.includes(task.id));
    const actionEvent=relatedEvents.find(e=>e.approval==='approved')||relatedEvents[0];
    const reasons=taskStartBlockReasons(task.id,events,view);
    if(!actionEvent||actionEvent.approval!=='approved')reasons.unshift('关联事件尚未批准');
    const knownTime=[at,task.plannedStartAt,task.deadlineAt].every(value=>Number.isFinite(Date.parse(value)));
    const reached=knownTime&&Date.parse(at)>=Date.parse(task.plannedStartAt);
    const blocked=task.executionStatus==='pending'&&reasons.length>0&&reached;
    const waiting=task.executionStatus==='pending'&&reasons.length>0&&!reached;
    const late=knownTime&&task.executionStatus!=='completed'&&Date.parse(at)>Date.parse(task.deadlineAt);
    const sourceIds=new Set(task.dependsOnTaskIds.filter(id=>byId.get(id)?.executionStatus!=='completed'));
    for(const orderId of task.blockedByMaintenanceOrderIds){if(orders.find(o=>o.id===orderId)?.status!=='completed')for(const t of all.filter(t=>t.maintenanceOrderId===orderId&&t.taskType==='maintenance'))sourceIds.add(t.id);}
    const sources=[...sourceIds].map(id=>({id,task:byId.get(id)}));
    return {task,relatedEvents,actionEvent,reasons,blocked,waiting,late,knownTime,sources,exceptions:exceptions.filter(e=>e.taskId===task.id)};
  };
  const items=all.filter(t=>ids.has(t.id)).map(describe);
  const metrics={pending:items.filter(i=>i.task.executionStatus==='pending').length,in_progress:items.filter(i=>i.task.executionStatus==='in_progress').length,completed:items.filter(i=>i.task.executionStatus==='completed').length,blocked:items.filter(i=>i.blocked).length,openExceptions:exceptions.filter(e=>e.status!=='closed').length};
  const departments=['engineering','rooms','front','dining'].map(id=>{
    const tasks=items.filter(i=>i.task.departmentId===id),taskIds=new Set(tasks.map(i=>i.task.id));
    const activeExceptions=exceptions.filter(e=>taskIds.has(e.taskId)&&e.status!=='closed');
    const blocked=tasks.filter(i=>i.blocked).length,inProgress=tasks.filter(i=>i.task.executionStatus==='in_progress').length;
    const late=tasks.filter(i=>i.late).length;
    return {id,items:tasks,total:tasks.length,pending:tasks.filter(i=>i.task.executionStatus==='pending').length,in_progress:inProgress,completed:tasks.filter(i=>i.task.executionStatus==='completed').length,blocked,openExceptions:activeExceptions.length,late,status:!tasks.length?'暂无协调任务':activeExceptions.length?'存在待处理异常':blocked?'部分受阻':late?'存在延迟风险':inProgress?'执行中':'正常推进'};
  });
  // 依赖图仅用于解释影响范围，不替代 A 阶段的启动判定。
  const downstream=(sourceId:string)=>{
    const seen=new Set([sourceId]),result:string[]=[],queue=[sourceId];
    while(queue.length){const id=queue.shift()!,source=byId.get(id);for(const {task} of items){if(!seen.has(task.id)&&(task.dependsOnTaskIds.includes(id)||!!source?.maintenanceOrderId&&source.taskType==='maintenance'&&task.blockedByMaintenanceOrderIds.includes(source.maintenanceOrderId))){seen.add(task.id);result.push(task.id);queue.push(task.id);}}}
    return result;
  };
  const plans=[...new Map(view.executionPlans.filter(p=>selectedEvents.some(e=>e.id===p.eventId)||p.affectedTaskIds.some(id=>ids.has(id))).map(p=>[p.executionPlanId,p])).values()].map(plan=>{
    const taskIds=[...new Set(plan.affectedTaskIds)],tasks=taskIds.flatMap(id=>byId.get(id)?[byId.get(id)!]:[]);
    return {plan,total:taskIds.length,done:tasks.filter(t=>t.executionStatus==='completed').length,missing:taskIds.filter(id=>!byId.has(id)),tasks,checks:tasks.map(describe),exceptions:[...new Map((view.executionExceptions||[]).map(e=>[e.exceptionId,e])).values()].filter(e=>e.executionPlanId===plan.executionPlanId||taskIds.includes(e.taskId))};
  });
  return {at,items,metrics,departments,exceptions,plans,downstream,missing:[...ids].filter(id=>!byId.has(id)),records:[...new Map((view.executionRecords||[]).filter(r=>ids.has(r.taskId)).map(r=>[r.recordId,r])).values()]};
}
