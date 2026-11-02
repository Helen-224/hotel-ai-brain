import {businessTime} from './data/businessWorkflow';
import {businessText} from './data/businessLabels';
import {useState} from 'react';
import {employees,type TaskExecutionException,type ExecutionExceptionType} from './data/hotelDemo';
import type {HotelBusinessState} from './data/coordinationExecution';
import {currentBusinessTasks} from './data/hotelDemo';
import {taskStartBlockReasons,exceptionTypeLabels,type TaskExecutionCommand,type ExceptionHandlingCommand} from './data/taskExecution';

export interface TaskExecutionFeedback {taskId:string;message:string}
export function ExceptionReview({exception,onHandle,readOnly=false}:{readOnly?:boolean;exception:TaskExecutionException;onHandle:(command:ExceptionHandlingCommand)=>void}) {
  const [note,setNote]=useState('');
  const handle=(action:'acknowledge'|'close')=>onHandle({exceptionId:exception.exceptionId,action,actorName:'演示管理者',occurredAt:exception.updatedAt,note});
  return <div className="coord-task-exception">
    <p><strong>{exceptionTypeLabels[exception.exceptionType]}</strong> · {{open:'待处理',acknowledged:'已确认',closed:'已处理'}[exception.status]}</p>
    <p>报告人 {businessText(exception.reportedBy)} · {businessText(exception.createdAt)}</p>
    <p>{exception.description}</p>
    {!readOnly&&exception.status!=='closed'&&<><label>处理办法（必填）<input aria-label={'处理说明 '+exception.exceptionId} value={note} onChange={e=>setNote(e.target.value)}/></label><div className="coord-controls"><button disabled={exception.status!=='open'||!note.trim()} onClick={()=>handle('acknowledge')}>接手处理</button><button disabled={!note.trim()} onClick={()=>handle('close')}>问题已处理，保存说明</button></div></>}
    {exception.handlingRecords.length>0&&<ol>{exception.handlingRecords.map((record,i)=><li key={i}>{record.occurredAt} · {record.actorName} · {record.status==='closed'?'已处理':'已确认'} · {record.note}</li>)}</ol>}
    <small>这里记录问题的处理情况。需要换人或调整时间，请返回方案安排；任务完成情况仍需单独更新。</small>
  </div>;
}

// 复用统一执行控件；员工模式采用显式身份，异常处理只读。
export function TaskExecutionActions({view,eventId,taskId,onExecute,onHandle,feedback,employeeId,showExceptions=true}:{showExceptions?:boolean;employeeId?:string;view:HotelBusinessState;eventId:string;taskId:string;onExecute:(command:TaskExecutionCommand)=>void;onHandle:(command:ExceptionHandlingCommand)=>void;feedback?:TaskExecutionFeedback}) {
  const [note,setNote]=useState('');const [exceptionType,setExceptionType]=useState<ExecutionExceptionType>('delay');
  const task=currentBusinessTasks(view.events,view).find(t=>t.id===taskId);
  if(!task)return <p>任务不存在，无法执行。</p>;
  const event=view.events.find(e=>e.id===eventId);
  const blockers=taskStartBlockReasons(taskId,view.events,view);
  const records=(view.executionRecords||[]).filter(r=>r.taskId===taskId);
  const exceptions=(view.executionExceptions||[]).filter(e=>e.taskId===taskId);
  const actorEmployeeId=employeeId;
  if(!actorEmployeeId)return <div className="coord-task-operations"><p>执行状态：{task.executionStatus} · 业务验证：{task.verificationStatus}</p><p>负责人：{task.assignedEmployeeId}</p>{exceptions.map(exception=><ExceptionReview key={exception.exceptionId} exception={exception} onHandle={onHandle}/>)}<ol>{records.map(record=><li key={record.recordId}>{record.occurredAt} · {record.actorEmployeeId} · {record.action} · {record.note}</li>)}</ol></div>;
  if(actorEmployeeId!==task.assignedEmployeeId)return <p>该任务未分配给当前模拟员工。</p>;
  const execute=(action:'start'|'complete')=>onExecute({action,taskId,eventId,actorEmployeeId,occurredAt:businessTime(view),note});
  return <div className="coord-task-operations">
    <small>{employeeId?'员工演示：':'管理演示：以当前负责人 '}{employees.find(e=>e.id===actorEmployeeId)?.name}（{actorEmployeeId}）身份模拟，并记录操作人。</small>
    {task.executionStatus==='pending'&&blockers.length>0&&<ul aria-label="开始任务的阻塞原因">{blockers.map(reason=><li key={reason}>{reason}</li>)}</ul>}
    {task.actualStartedAt&&<p>实际开始：{task.actualStartedAt} · {task.startedBy}</p>}
    {task.actualCompletedAt&&<p>实际完成：{task.actualCompletedAt} · {task.completedBy} · 业务结果未自动验证</p>}
    {task.executionStatus!=='completed'&&<button key={task.executionStatus} disabled={event?.approval!=='approved'||task.executionStatus==='pending'&&blockers.length>0} onClick={()=>execute(task.executionStatus==='pending'?'start':'complete')}>{task.executionStatus==='pending'?'开始模拟执行':'标记执行完成'}</button>}
    {feedback?.taskId===taskId&&<p role="status">{feedback.message}</p>}
    <details><summary>执行反馈、异常与操作记录</summary>
      <label>执行反馈 / 异常说明<textarea aria-label={'执行反馈 '+taskId} value={note} onChange={e=>setNote(e.target.value)}/></label>
      <label>异常类型<select aria-label={'异常类型 '+taskId} value={exceptionType} onChange={e=>setExceptionType(e.target.value as ExecutionExceptionType)}>{Object.entries(exceptionTypeLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
      <button disabled={!note.trim()} onClick={()=>onExecute({action:'report_exception',taskId,eventId,actorEmployeeId,occurredAt:businessTime(view),exceptionType,note})}>报告执行异常</button>
      <small>异常报告保留执行状态；未关闭异常会阻止待执行任务启动。需要资源调整时，重新进入分析和协调方案流程。</small>
      {showExceptions&&exceptions.map(exception=><ExceptionReview key={exception.exceptionId} exception={exception} onHandle={onHandle} readOnly={!!employeeId}/>)}
      <h4>唯一任务执行记录 · {records.length} 条</h4>
      {records.length?<ol>{records.map(record=><li key={record.recordId}>{record.occurredAt} · {record.actorEmployeeId} · {{started:'开始执行',completed:'执行完成（未自动验证）',exception_reported:'报告异常'}[record.action]} · {record.note||'无补充说明'}<small>记录 {record.recordId} · 关联事件 {record.relatedEventIds.join('、')} · 执行计划 {record.executionPlanId||'未关联资源应用计划'}</small></li>)}</ol>:<p>尚无任务执行记录。</p>}
    </details>
  </div>;
}
