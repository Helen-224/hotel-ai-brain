import {useState} from 'react';
import {employees,hotelDemo,rooms} from './data/hotelDemo';
import type {HotelBusinessState} from './data/coordinationExecution';
import {staffTasks} from './data/staffExecution';
import type {TaskExecutionCommand} from './data/taskExecution';
import {TaskExecutionActions,type TaskExecutionFeedback} from './TaskExecutionActions';

const categories=[['all','全部'],['pending','待执行'],['in_progress','进行中'],['completed','已完成'],['blocked','执行受阻']];
export function StaffExecution({view,onSelect,onExecute,feedback}:{view:HotelBusinessState;onSelect:(id:string)=>void;onExecute:(command:TaskExecutionCommand)=>void;feedback?:TaskExecutionFeedback}) {
  const [category,setCategory]=useState('all');
  const employee=employees.find(e=>e.id===view.currentEmployeeId);
  const items=staffTasks(view.events,view);
  const ownedIds=new Set(items.map(i=>i.task.id));
  const records=(view.executionRecords||[]).filter(r=>ownedIds.has(r.taskId));
  const dept=(id:string)=>hotelDemo.departments.find(d=>d.id===id)?.name||id;
  return <section className="platform-card coord-staff" aria-label="工作人员执行视图">
    <h2>工作人员执行视图</h2><p>运营协调的辅助执行入口 · 身份切换仅用于 Demo，不代表真实认证。</p>
    <label>当前模拟员工<select aria-label="选择模拟员工" value={employee?.id||''} onChange={e=>{onSelect(e.target.value);setCategory('all')}}><option value="">请选择员工</option>{employees.map(e=><option key={e.id} value={e.id}>{e.name} · {e.id} · {dept(e.departmentId)} · {e.position}</option>)}</select></label>
    {!employee?<p role="status">选择员工后，查看当前有效安排中由本人负责的任务。</p>:<>
      <p>{employee.name} · {employee.id} · {dept(employee.departmentId)} · {employee.position}</p>
      <div className="coord-staff-filters" aria-label="我的任务分类">{categories.map(([id,label])=><button key={id} aria-pressed={category===id} onClick={()=>setCategory(id)}>{label} · {id==='all'?items.length:items.filter(i=>i.category===id).length}</button>)}</div>
      <small>分类互斥：受阻为待执行任务的派生分类，包含授权及执行条件；支援占用不计为本人任务。</small>
      <div className="coord-staff-tasks" key={employee.id}>
        {!items.filter(i=>category==='all'||i.category===category).length&&<p role="status">此分类暂无本人负责任务。</p>}
        {items.filter(i=>category==='all'||i.category===category).map(({task,event,reasons,category:taskCategory})=><article key={task.id} className="coord-action coord-staff-task" data-task-id={task.id}>
          <h3>{task.title}</h3><p>{task.id} · {dept(task.departmentId)} · {categories.find(([id])=>id===taskCategory)?.[1]}</p>
          <small>当前负责人 {task.assignedEmployeeId} · 计划 {task.plannedStartAt} — {task.plannedEndAt}</small>
          <details><summary>任务详情与执行条件</summary><dl><dt>截止时间</dt><dd>{task.deadlineAt}</dd><dt>房间</dt><dd>{task.roomId?`${rooms.find(r=>r.id===task.roomId)?.roomNumber||task.roomId}（${task.roomId}）`:'无关联房间'}</dd><dt>业务记录</dt><dd>{[task.bookingId,task.maintenanceOrderId,task.serviceRequestId].filter(Boolean).join('、')||'无可选关联记录'}</dd><dt>前置任务</dt><dd>{task.dependsOnTaskIds.join('、')||'无'}</dd><dt>维修依赖</dt><dd>{task.blockedByMaintenanceOrderIds.join('、')||'无'}</dd><dt>结果验证</dt><dd>{task.verificationStatus==='verified'?'已验证':'未验证'}</dd></dl>
            <p>授权来源：{event?.title||'暂无关联事件'} · {event?.approval==='approved'?'已批准':'未批准'}</p>
            {task.executionStatus==='pending'?<p>启动条件：{reasons.join('；')||'已满足，可开始模拟执行'}</p>:<p>当前执行状态：{task.executionStatus==='completed'?'已完成，不能重复完成':'进行中，可提交完成反馈'}</p>}
          </details>
          {event&&<TaskExecutionActions view={view} eventId={event.id} taskId={task.id} employeeId={employee.id} onExecute={onExecute} onHandle={()=>{}} feedback={feedback}/>}
        </article>)}
      </div>
      <details className="coord-staff-history"><summary>本人负责任务的执行历史 · {records.length} 条</summary>{records.length?<ol>{records.map(record=><li key={record.recordId}>{items.find(i=>i.task.id===record.taskId)?.task.title} · {record.taskId} · {{started:'开始执行',completed:'执行完成',exception_reported:'报告异常'}[record.action]} · {record.actorEmployeeId} · {record.occurredAt} · {record.note||'无备注'}</li>)}</ol>:<p>暂无执行历史。</p>}</details>
    </>}
  </section>;
}
