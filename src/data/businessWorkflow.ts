import {currentBusinessTasks,currentMaintenanceOrders,snapshot,type BusinessContext} from './hotelDemo';
import type {HotelBusinessState} from './coordinationExecution';
export const businessTime=(view:BusinessContext)=>view.simulatedAt||snapshot.at;
export const manager=(view:BusinessContext)=>!view.currentEmployeeId&&view.actorRole!=='staff';
export function advanceTime(state:HotelBusinessState,at:string){return manager(state)&&Number.isFinite(Date.parse(at))&&Date.parse(at)>Date.parse(businessTime(state))?{...state,simulatedAt:at,revision:state.revision+1}:state;}
export function dispatchTask(state:HotelBusinessState,eventId:string,taskId:string){
 const event=state.events.find(e=>e.id===eventId),task=currentBusinessTasks(state.events,state).find(t=>t.id===taskId);
 if(!manager(state)||event?.approval!=='approved'||!event.tasks.some(t=>t.id===taskId)||!task)return state;
 if(state.dispatches?.[taskId]?.employeeId===task.assignedEmployeeId)return state;
 const record={dispatchId:'dispatch-'+taskId+'-'+((state.dispatchHistory?.length||0)+1),eventId,taskId,employeeId:task.assignedEmployeeId,actor:'演示管理者',at:businessTime(state)};
 return {...state,dispatchHistory:[...state.dispatchHistory||[],record],revision:state.revision+1,dispatches:{...state.dispatches,[taskId]:record}};
}
export function roomDeliveryReasons(state:HotelBusinessState,roomId:string){
 const tasks=currentBusinessTasks(state.events,state),reasons:string[]=[];
 for(const order of currentMaintenanceOrders(state.events,state).filter(o=>o.roomId===roomId&&o.blocksRoomDelivery))if(order.status!=='completed'||order.verificationStatus!=='verified')reasons.push(order.id+'维修未完成或未验收通过');
 for(const task of tasks.filter(t=>t.roomId===roomId&&['cleaning','inspection'].includes(t.taskType)))if(task.executionStatus!=='completed'||task.verificationStatus!=='verified')reasons.push(task.id+'执行或验证未完成');
 for(const e of state.executionExceptions||[])if(e.status!=='closed'&&tasks.some(t=>t.id===e.taskId&&t.roomId===roomId))reasons.push(e.exceptionId+'异常未关闭');
 return reasons;
}
export function verifyTask(state:HotelBusinessState,taskId:string,passed:boolean,note:string){
 const tasks=currentBusinessTasks(state.events,state),task=tasks.find(t=>t.id===taskId);
 if(!manager(state)||!note.trim()||!task||task.executionStatus!=='completed')return state;
 const previous=state.verifications?.filter(v=>v.taskId===taskId).at(-1);
 if(passed&&previous&&!previous.passed&&(!task.actualCompletedAt||Date.parse(task.actualCompletedAt)<=Date.parse(previous.at)))return state;
 if(passed&&task.taskType==='delivery'&&task.roomId&&roomDeliveryReasons(state,task.roomId).length)return state;
 const record={id:'verification-'+((state.verifications?.length||0)+1),taskId,passed,note,actor:'演示管理者',at:businessTime(state)};
 return {...state,revision:state.revision+1,verifications:[...state.verifications||[],record]};
}

export function reopenFailedTask(state:HotelBusinessState,taskId:string){
 const latest=state.verifications?.filter(v=>v.taskId===taskId).at(-1);
 if(!manager(state)||!latest||latest.passed)return state;
 const task=currentBusinessTasks(state.events,state).find(t=>t.id===taskId);
 if(!task||task.executionStatus!=='completed')return state;
 return {...state,revision:state.revision+1,taskExecutions:{...state.taskExecutions,[taskId]:{executionStatus:'pending' as const}},events:state.events.map(e=>({...e,tasks:e.tasks.map(t=>t.id===taskId?{...t,status:'pending' as const}:t)}))};
}
export function eventResolutionReasons(state:HotelBusinessState,eventId:string){
 const event=state.events.find(e=>e.id===eventId);if(!event)return ['事件不存在'];
 const tasks=currentBusinessTasks(state.events,state),reasons:string[]=[];
 if(event.approval!=='approved'||!event.tasks.length)reasons.push('事件未批准或未创建任务');
 for(const id of event.businessRefs?.businessTaskIds||[]){const task=tasks.find(t=>t.id===id);if(!task||task.executionStatus!=='completed'||task.verificationStatus!=='verified')reasons.push(id+'执行或验收未通过');}
 for(const e of state.executionExceptions||[])if(e.relatedEventIds.includes(eventId)&&e.status!=='closed')reasons.push(e.exceptionId+'异常未关闭');
 return reasons;
}
export function resolveEvent(state:HotelBusinessState,eventId:string,note:string){
 if(!manager(state)||!note.trim()||eventResolutionReasons(state,eventId).length)return state;
 return {...state,revision:state.revision+1,events:state.events.map(e=>e.id===eventId?{...e,resolutionStatus:'resolved' as const,verificationStatus:'verified' as const,records:[...e.records,{id:eventId+'-resolved-'+e.records.length,time:businessTime(state),text:'演示管理者确认结果：'+note}]}:e)};
}
