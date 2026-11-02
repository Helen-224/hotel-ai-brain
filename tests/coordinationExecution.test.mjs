// Run with: node --test tests/coordinationExecution.test.mjs (Node 24; no extra dependencies).
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {resolve,dirname} from 'node:path';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const modules=new Map();
function moduleUrl(file){
 file=resolve(file);if(modules.has(file))return modules.get(file);
 let source=stripTypeScriptTypes(readFileSync(file,'utf8'),{disableExperimentalWarning:true});
 source=source.replace(/from\s+(['"])(\.\/[^'"]+)\1/g,(_,quote,path)=>'from '+JSON.stringify(moduleUrl(resolve(dirname(file),path+'.ts'))));
 const url='data:text/javascript;base64,'+Buffer.from(source).toString('base64');modules.set(file,url);return url;
}
const h=await import(moduleUrl('src/data/hotelDemo.ts'));
const r=await import(moduleUrl('src/data/resourceCoordination.ts'));
const a=await import(moduleUrl('src/data/agentAnalysis.ts'));
const x=await import(moduleUrl('src/data/coordinationExecution.ts'));
const execution=await import(moduleUrl('src/data/taskExecution.ts'));
const seedSnapshot=JSON.stringify([h.businessTasks,h.rooms,h.bookings,h.maintenanceOrders,h.employees,h.shifts,h.operationEvents]);
const initial=()=>({events:structuredClone(h.operationEvents),revision:0,taskOverrides:{},supportReservations:[],executionPlans:[]});
const command=(state,eventId,action,taskId)=>{
 if(action!=='advance')return {...state,events:h.transitionEvents(state.events,eventId,action,taskId,state)};
 const task=h.currentBusinessTasks(state.events,state).find(t=>t.id===taskId);
 const result=execution.executeTask(state,{eventId,taskId,action:task.executionStatus==='pending'?'start':'complete',actorEmployeeId:task.assignedEmployeeId,occurredAt:new Date().toISOString()});
 assert.ok(result.ok,result.message);return result.state;
};
function fixture(){
 const state=command(initial(),'breakfast','approve');const event=state.events.find(e=>e.id==='breakfast');
 const report=a.analyzeOperations(event,state.events,state);const candidates=r.generateProposals(event,state.events,report,state);
 const candidate=candidates.find(p=>p.support.length&&p.adjustments.length&&r.validateProposal(p,state.events,state).feasible);
 assert.ok(candidate,'Breakfast must produce a feasible real reassignment plus support');
 const proposal=r.approveProposal(candidate,state.events,'approved',candidates,'test approval',undefined,state);
 assert.equal(proposal.approval,'approved');return {state,proposal,candidates,report};
}
const meta=()=>({appliedAt:new Date(Date.now()+1000).toISOString(),appliedBy:'验收管理者'});
function rejects(state,proposal,reason){
 const before=JSON.stringify(state),pBefore=JSON.stringify(proposal);const result=x.applyApprovedProposal(state,proposal,meta());
 assert.equal(result.ok,false,reason);assert.match(result.errors.join(';'),reason);
 assert.strictEqual(result.state,state);assert.equal(JSON.stringify(state),before);assert.equal(JSON.stringify(proposal),pBefore);
 assert.equal(JSON.stringify([h.businessTasks,h.rooms,h.bookings,h.maintenanceOrders,h.employees,h.shifts,h.operationEvents]),seedSnapshot);
}
function freshen(proposal,state){return {...proposal,fingerprint:h.businessFingerprint(state.events,state),sourceReport:a.analyzeOperations(state.events.find(e=>e.id===proposal.eventId),state.events,state)};}
test('dual independent approvals and stale version reject atomically',()=>{
 const {state,proposal}=fixture();rejects({...state,events:h.operationEvents},proposal,/原事件审批/);
 rejects(state,{...proposal,approval:'pending',records:[]},/资源方案尚未批准/);
 rejects({...state,revision:1},proposal,/过期/);
 rejects(state,{...proposal,records:[]},/批准记录/);
 rejects(state,{...proposal,sourceReport:{...proposal.sourceReport,eventId:'vip'}},/来源分析/);
});
test('missing task, started or completed adjustment reject atomically',()=>{
 const {state,proposal}=fixture();rejects(state,{...proposal,adjustments:[...proposal.adjustments,{...proposal.adjustments[0],taskId:'NOT-EXIST'}]},/不存在/);
 const missing=structuredClone(state);missing.events.find(e=>e.id==='breakfast').businessRefs.businessTaskIds.push('MISSING');rejects(missing,freshen(proposal,missing),/关联业务任务不存在/);
 let running=command(state,'breakfast','create');running=command(running,'breakfast','advance',proposal.adjustments[0].taskId);
 rejects(running,freshen(proposal,running),/进行中或已完成/);
 const done=command(running,'breakfast','advance',proposal.adjustments[0].taskId);rejects(done,freshen(proposal,done),/进行中或已完成/);
});
test('skill, shift, rest, deadline, support authorization and conflict constraints',()=>{
 const {state,proposal}=fixture();
 const edit=(change)=>({...proposal,adjustments:proposal.adjustments.map((v,i)=>i? v:{...v,...change})});
 rejects(state,edit({employeeId:'E-ENG-1'}),/技能|员工不存在/);
 rejects(state,edit({startAt:'2026-11-01T02:00:00+08:00',endAt:'2026-11-01T02:30:00+08:00'}),/班次/);
 const shift=h.shifts.find(s=>s.employeeId===proposal.adjustments[0].employeeId);const rest=shift.breakPeriods[0];
 rejects(state,edit({startAt:rest.startAt,endAt:new Date(Date.parse(rest.startAt)+8*3600000+30*60000).toISOString().replace('Z','+08:00')}),/休息|班次/);
 rejects(state,edit({startAt:'2026-11-01T18:00:00+08:00',endAt:'2026-11-01T18:30:00+08:00'}),/截止时间/);
 rejects(state,{...proposal,support:[{...proposal.support[0],employeeId:'E-HK-1'}]},/技能|窗口|员工不存在/);
 rejects(state,{...proposal,support:[{...proposal.support[0],startAt:'2026-11-01T08:00:00+08:00',endAt:'2026-11-01T09:00:00+08:00',slotId:'peak'}]},/窗口/);
 rejects(state,{...proposal,adjustments:[]},/时间冲突/);
 rejects(state,{...proposal,support:[...proposal.support,...proposal.support]},/时间冲突/);
 rejects(state,{...proposal,support:Array.from({length:8},()=>({...proposal.support[0]}))},/每日作业容量/);
});
test('dependency, checkout and maintenance appointment constraints remain enforced',()=>{
 const state=command(initial(),'arrival','approve');const event=state.events.find(e=>e.id==='arrival');
 const report=a.analyzeOperations(event,state.events,state);const base=r.generateProposals(event,state.events,report,state)[0];
 const task=h.currentBusinessTasks(state.events,state).find(t=>t.taskType==='cleaning'&&t.dependsOnTaskIds.length);
 assert.ok(task);const p={...base,approval:'approved',records:[{action:'approved',at:new Date().toISOString(),actor:'test',reason:'test'}],adjustments:[{taskId:task.id,employeeId:task.assignedEmployeeId,startAt:'2026-11-01T07:00:00+08:00',endAt:'2026-11-01T07:30:00+08:00'}]};
 rejects(state,p,/前置时序|退房/);
 const repair=h.currentBusinessTasks(state.events,state).find(t=>t.taskType==='maintenance');
 rejects(state,{...p,adjustments:[{taskId:repair.id,employeeId:repair.assignedEmployeeId,startAt:'2026-11-01T07:00:00+08:00',endAt:'2026-11-01T07:45:00+08:00'}]},/维修预约/);
});
test('successful application updates only arrangements; audit, support, readers and idempotency',()=>{
 const {state,proposal,candidates,report}=fixture();const before=JSON.stringify(state);const result=x.applyApprovedProposal(state,proposal,meta());assert.ok(result.ok);
 const next=result.state;assert.equal(JSON.stringify(state),before);assert.strictEqual(next.events,state.events);
 assert.equal(next.executionPlans.length,1);assert.equal(next.supportReservations.length,proposal.support.length);
 assert.equal(h.currentBusinessTasks(next.events,next).length,h.businessTasks.length);
 const oldTasks=h.currentBusinessTasks(state.events,state),newTasks=h.currentBusinessTasks(next.events,next);
 for(const t of newTasks){assert.equal(t.executionStatus,oldTasks.find(v=>v.id===t.id).executionStatus);assert.equal(t.verificationStatus,oldTasks.find(v=>v.id===t.id).verificationStatus);}
 for(const edit of proposal.adjustments){const task=newTasks.find(t=>t.id===edit.taskId);assert.equal(task.assignedEmployeeId,edit.employeeId);assert.equal(task.plannedStartAt,edit.startAt);assert.equal(task.plannedEndAt,edit.endAt);assert.equal(result.plan.adjustmentRecords.find(v=>v.taskId===edit.taskId).before.employeeId,oldTasks.find(t=>t.id===edit.taskId).assignedEmployeeId);}
 assert.notEqual(result.plan.businessVersionBeforeApply,result.plan.businessVersionAfterApply);assert.equal(result.plan.businessVersionAfterApply,h.businessFingerprint(next.events,next));
 assert.notEqual(report.fingerprint,h.businessFingerprint(next.events,next));assert.equal(r.recommendProposal(candidates,next.events,next.events[1],report,next),null);
 assert.equal(r.validateProposal(candidates[0],next.events,next).feasible,false);
 const reservation=next.supportReservations[0];assert.ok(h.employeeLoad(reservation.employeeId,undefined,next.events,next).reservedMinutes>0);
 const coverage=h.breakfastCoverage(undefined,next);assert.equal(coverage.find(c=>c.slotId==='early'&&c.role===reservation.roleId).gap,0);assert.equal(coverage.find(c=>c.slotId==='peak'&&c.role===reservation.roleId).gap,1);
 const latest=a.analyzeOperations(next.events.find(e=>e.id==='breakfast'),next.events,next);assert.ok(latest.agents.find(a=>a.agent==='人力 Agent').evidence.some(e=>e.includes(reservation.reservationId)));
 assert.ok(latest.agents.find(a=>a.agent==='前厅 Agent').evidence.some(e=>e.includes('T-FRONT-CHECK')&&e.includes('E-FLEX-1')));
 assert.equal(r.recommendProposal([proposal],next.events,next.events.find(e=>e.id==='breakfast'),latest,next),null);
 let shared=command(next,'breakfast','create');shared=command(shared,'arrival','approve');shared=command(shared,'arrival','create');
 assert.equal(h.currentBusinessTasks(shared.events,shared).filter(t=>t.id==='T-FRONT-CHECK').length,1);
 assert.equal(h.currentBusinessTasks(shared.events,shared).find(t=>t.id==='T-FRONT-CHECK').assignedEmployeeId,'E-FLEX-1');
 shared=command(shared,'breakfast','advance','T-FRONT-CHECK');
 assert.equal(shared.events.find(e=>e.id==='arrival').tasks.find(t=>t.id==='T-FRONT-CHECK').status,'in_progress');
 const duplicate=x.applyApprovedProposal(next,proposal,meta());assert.ok(duplicate.ok&&duplicate.alreadyApplied);assert.strictEqual(duplicate.state,next);assert.strictEqual(duplicate.plan,result.plan);
 const held=initial();held.supportReservations=structuredClone(next.supportReservations);held.revision=1;const conflict=freshen(proposal,held);held.events=structuredClone(state.events);rejects(held,freshen(conflict,held),/时间冲突/);
 assert.equal(JSON.stringify([h.businessTasks,h.rooms,h.bookings,h.maintenanceOrders,h.employees,h.shifts,h.operationEvents]),seedSnapshot);
});
test('frozen input is not mutated and invalid application metadata leaves no partial state',()=>{
 const {state,proposal}=fixture();const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};freeze(state);freeze(proposal);
 const before=JSON.stringify(state);const invalid=x.applyApprovedProposal(state,proposal,{appliedAt:'invalid',appliedBy:''});assert.equal(invalid.ok,false);assert.strictEqual(invalid.state,state);
 const result=x.applyApprovedProposal(state,proposal,meta());assert.equal(result.ok,true);assert.equal(JSON.stringify(state),before);
});
test('original shared tasks, maintenance realtime state and result verification remain independent',()=>{
 let state=command(initial(),'arrival','approve');state=command(state,'arrival','create');
 const repair=h.currentBusinessTasks(state.events,state).find(t=>t.maintenanceOrderId==='M-1'&&t.taskType==='maintenance');assert.ok(repair);
 state=command(state,'arrival','advance',repair.id);state=command(state,'arrival','advance',repair.id);
 assert.equal(h.businessSummary(state.events,state).unfinishedMaintenance,5);assert.equal(h.currentMaintenanceOrders(state.events,state).find(m=>m.id==='M-1').verificationStatus,'unverified');
 const blocked=h.currentBusinessTasks(state.events,state).find(t=>t.roomId==='R-2'&&t.taskType==='cleaning');assert.ok(h.isBusinessTaskBlocked(blocked.id,state.events,state));
 const clean=h.currentBusinessTasks(state.events,state).find(t=>t.roomId==='R-1'&&t.taskType==='cleaning');state=command(state,'arrival','advance',clean.id);state=command(state,'arrival','advance',clean.id);
 assert.equal(h.currentBusinessTasks(state.events,state).find(t=>t.id===clean.id).verificationStatus,'unverified');assert.equal(h.businessSummary(state.events,state).unprepared,18);assert.notEqual(state.events[0].resolutionStatus,'resolved');
 state=command(state,'breakfast','approve');state=command(state,'breakfast','create');const count=state.events.find(e=>e.id==='breakfast').records.length;const again=command(state,'breakfast','create');assert.equal(again.events.find(e=>e.id==='breakfast').records.length,count);
 assert.equal(new Set(h.currentBusinessTasks(state.events,state).map(t=>t.id)).size,h.businessTasks.length);
});

// 0.4.2.2-A: unified execution, actor validation, exceptions and immutable verification.
const taskCommand=(state,taskId,action,extra={})=>({eventId:'arrival',taskId,action,actorEmployeeId:h.currentBusinessTasks(state.events,state).find(t=>t.id===taskId)?.assignedEmployeeId||'E-ENG-1',occurredAt:new Date(Date.now()+2000).toISOString(),...extra});
const approved=()=>command(initial(),'arrival','approve');
function taskRejects(state,input,pattern){
 const snapshot=JSON.stringify(state);const result=execution.executeTask(state,input);assert.equal(result.ok,false,result.message);assert.match(result.message,pattern);assert.strictEqual(result.state,state);assert.equal(JSON.stringify(state),snapshot);
}
function taskSuccess(state,input){const snapshot=JSON.stringify(state);const result=execution.executeTask(state,input);assert.ok(result.ok,result.message);assert.equal(JSON.stringify(state),snapshot);return result.state;}
test('A: dependencies, maintenance blockers, owner, approval and invalid context deny without writes',()=>{
 const state=approved();taskRejects(state,taskCommand(state,'T-CLEAN-2','start'),/前置任务|维修阻塞/);
 taskRejects(state,taskCommand(state,'T-M-1','start',{actorEmployeeId:'E-HK-1'}),/有效负责人/);
 taskRejects(state,taskCommand(state,'missing','start'),/不存在/);
 taskRejects(state,taskCommand(state,'T-M-1','start',{eventId:'vip'}),/不属于/);
 const pending=initial();taskRejects(pending,taskCommand(pending,'T-M-1','start'),/审批/);
 taskRejects(state,taskCommand(state,'T-M-1','start',{occurredAt:'invalid'}),/时间无效/);
 taskRejects(state,taskCommand(state,'T-M-1','bypass'),/不支持/);
 assert.strictEqual(h.transitionEvents(state.events,'arrival','advance','T-M-1',state),state.events,'legacy no-actor advance cannot bypass unified engine');
});
test('A: begin/complete are one-way, deduplicated and capture real caller timestamps',()=>{
 const state=approved();taskRejects(state,taskCommand(state,'T-M-1','complete'),/仅进行中/);
 const start=taskCommand(state,'T-M-1','start',{occurredAt:'2026-11-02T09:00:00+08:00',note:'已核对预约'});const running=taskSuccess(state,start);
 assert.equal(running.executionRecords.length,1);taskRejects(running,start,/不重复开始/);
 taskRejects(running,taskCommand(running,'T-M-1','complete',{occurredAt:'2026-11-02T08:00:00+08:00'}),/时间不能早于/);
 taskRejects(running,taskCommand(running,'T-M-1','complete',{actorEmployeeId:'E-HK-1'}),/负责人/);
 const done=taskSuccess(running,taskCommand(running,'T-M-1','complete',{occurredAt:'2026-11-02T09:20:00+08:00'}));
 const task=h.currentBusinessTasks(done.events,done).find(t=>t.id==='T-M-1');assert.equal(task.actualStartedAt,start.occurredAt);assert.equal(task.actualCompletedAt,'2026-11-02T09:20:00+08:00');assert.equal(task.completedBy,'E-ENG-1');assert.equal(task.verificationStatus,'unverified');assert.equal(done.executionRecords.length,2);assert.equal(h.businessSummary(done.events,done).unfinishedMaintenance,5);
 taskRejects(done,taskCommand(done,'T-M-1','complete',{occurredAt:'2026-11-02T09:21:00+08:00'}),/仅进行中/);taskRejects(done,taskCommand(done,'T-M-1','start',{occurredAt:'2026-11-02T09:21:00+08:00'}),/仅待执行/);
 assert.equal(done.events[0].resolutionStatus,'open');assert.equal(done.events[0].verificationStatus,'unverified');
});
test('A: per-room dependency chain and independent parallel work are preserved',()=>{
 let state=approved();state=command(state,'arrival','create');state=taskSuccess(state,taskCommand(state,'T-M-1','start'));
 state=taskSuccess(state,taskCommand(state,'T-FRONT-CHECK','start')); // independent employee / independent chain
 taskRejects(state,taskCommand(state,'T-M-2','start'),/还有进行中/);
 state=taskSuccess(state,taskCommand(state,'T-M-1','complete'));state=taskSuccess(state,taskCommand(state,'T-CLEAN-1','start'));
 taskRejects(state,taskCommand(state,'T-CHECK-1','start'),/前置任务/);
 taskRejects(state,taskCommand(state,'T-CLEAN-2','start'),/前置任务|维修阻塞/);
 state=taskSuccess(state,taskCommand(state,'T-CLEAN-1','complete'));state=taskSuccess(state,taskCommand(state,'T-CHECK-1','start'));
 state=taskSuccess(state,taskCommand(state,'T-CHECK-1','complete'));assert.equal(h.businessSummary(state.events,state).unprepared,18);
 taskRejects(state,taskCommand(state,'T-DELIVER-1','start'),/还有进行中/);
 state=taskSuccess(state,taskCommand(state,'T-FRONT-CHECK','complete'));state=taskSuccess(state,taskCommand(state,'T-DELIVER-1','start'));state=taskSuccess(state,taskCommand(state,'T-DELIVER-1','complete'));
 assert.equal(h.rooms[0].housekeepingStatus,'dirty');assert.equal(h.currentBusinessTasks(state.events,state).find(t=>t.id==='T-DELIVER-1').verificationStatus,'unverified');assert.equal(state.events[0].resolutionStatus,'open');
});
test('A: shared task has one status and operation history, even before other event links it',()=>{
 let state=approved();state=command(state,'arrival','create');state=command(state,'breakfast','approve');
 state=taskSuccess(state,taskCommand(state,'T-FRONT-CHECK','start'));state=command(state,'breakfast','create');
 for(const event of state.events.filter(e=>['arrival','breakfast'].includes(e.id)))assert.equal(event.tasks.find(t=>t.id==='T-FRONT-CHECK').status,'in_progress');
 state=taskSuccess(state,taskCommand(state,'T-FRONT-CHECK','complete',{eventId:'breakfast'}));
 assert.equal(state.executionRecords.filter(r=>r.taskId==='T-FRONT-CHECK').length,2);assert.deepEqual(state.executionRecords[0].relatedEventIds,['arrival','breakfast']);
 assert.equal(state.events.find(e=>e.id==='arrival').tasks.find(t=>t.id==='T-FRONT-CHECK').status,'completed');assert.equal(h.currentBusinessTasks(state.events,state).length,h.businessTasks.length);
});
test('A: reports do not alter task arrangement, status, approval, support or verification',()=>{
 let state=approved();const before=h.currentBusinessTasks(state.events,state),version=h.businessFingerprint(state.events,state);
 state=taskSuccess(state,taskCommand(state,'T-M-1','report_exception',{exceptionType:'new_issue',note:'发现新的异响，需人工复核'}));
 assert.deepEqual(h.currentBusinessTasks(state.events,state),before);assert.notEqual(h.businessFingerprint(state.events,state),version);assert.deepEqual(state.taskOverrides,{});assert.deepEqual(state.executionPlans,[]);assert.deepEqual(state.supportReservations,[]);assert.equal(state.events[0].approval,'approved');assert.equal(state.executionRecords[0].action,'exception_reported');taskRejects(state,taskCommand(state,'T-M-1','start'),/尚未解除的执行异常/);
 const duplicate=execution.executeTask(state,taskCommand(state,'T-M-1','report_exception',{exceptionType:'new_issue',note:'发现新的异响，需人工复核'}));assert.strictEqual(duplicate.state,state);assert.equal(state.executionRecords.length,1);
 taskRejects(state,taskCommand(state,'T-M-1','report_exception',{exceptionType:'delay',note:'  '}),/说明/);taskRejects(state,taskCommand(state,'T-M-1','report_exception',{exceptionType:'invented',note:'test'}),/类型/);
});
test('A: manager acknowledgement/close are independent and retain actor, note and time',()=>{
 let state=approved();state=taskSuccess(state,taskCommand(state,'T-M-1','report_exception',{exceptionType:'employee_unavailable',note:'临时无法到岗',occurredAt:'2026-11-02T09:00:00+08:00'}));const exceptionId=state.executionExceptions[0].exceptionId;const tasks=h.currentBusinessTasks(state.events,state);
 const handling={exceptionId,action:'acknowledge',actorName:'演示管理者',note:'已联系工程负责人核实，暂不调整安排',occurredAt:'2026-11-02T09:01:00+08:00'};
 const before=JSON.stringify(state);const invalid=execution.handleExecutionException(state,{...handling,note:' '});assert.equal(invalid.ok,false);assert.strictEqual(invalid.state,state);assert.equal(JSON.stringify(state),before);
 let result=execution.handleExecutionException(state,handling);assert.ok(result.ok);state=result.state;assert.equal(state.executionExceptions[0].status,'acknowledged');taskRejects(state,taskCommand(state,'T-M-1','start',{occurredAt:'2026-11-02T09:01:30+08:00'}),/尚未解除的执行异常/);
 result=execution.handleExecutionException(state,handling);assert.equal(result.ok,false);assert.strictEqual(result.state,state);
 result=execution.handleExecutionException(state,{...handling,action:'close',note:'确认可按原安排执行；未调整资源',occurredAt:'2026-11-02T09:02:00+08:00'});assert.ok(result.ok);state=result.state;
 assert.deepEqual(h.currentBusinessTasks(state.events,state),tasks);assert.equal(state.executionExceptions[0].handlingRecords.length,2);assert.equal(state.executionExceptions[0].status,'closed');assert.equal(state.executionRecords.length,1);assert.equal(state.events[0].resolutionStatus,'open');
 result=execution.handleExecutionException(state,{...handling,action:'close'});assert.equal(result.ok,false);assert.strictEqual(result.state,state);const resumed=taskSuccess(state,taskCommand(state,'T-M-1','start',{occurredAt:'2026-11-02T09:03:00+08:00'}));assert.equal(h.currentBusinessTasks(resumed.events,resumed).find(t=>t.id==='T-M-1').executionStatus,'in_progress');
});
test('A: applied arrangement is authoritative; execution links plan and invalidates old analysis',()=>{
 const {state,proposal}=fixture();const applied=x.applyApprovedProposal(state,proposal,meta());assert.ok(applied.ok);let next=applied.state;const report=a.analyzeOperations(next.events.find(e=>e.id==='breakfast'),next.events,next);
 taskRejects(next,taskCommand(next,'T-FRONT-CHECK','start',{eventId:'breakfast',actorEmployeeId:'E-FRONT-1'}),/负责人/);
 const input=taskCommand(next,'T-FRONT-CHECK','start',{eventId:'breakfast',actorEmployeeId:'E-FLEX-1'});next=taskSuccess(next,input);
 assert.equal(next.executionRecords[0].executionPlanId,applied.plan.executionPlanId);assert.notEqual(report.fingerprint,h.businessFingerprint(next.events,next));assert.equal(next.executionPlans[0].status,'applied');assert.deepEqual(next.taskOverrides,applied.state.taskOverrides);assert.deepEqual(next.supportReservations,applied.state.supportReservations);
 assert.equal(x.applyApprovedProposal(next,proposal,meta()).state,next);assert.equal(h.currentBusinessTasks(next.events,next).find(t=>t.id==='T-FRONT-CHECK').verificationStatus,'unverified');
});
test('A: invalid current arrangement and frozen state cannot bypass checks or mutate seeds',()=>{
 let state=approved();state.taskOverrides={'T-M-1':{assignedEmployeeId:'E-HK-1',plannedStartAt:'2026-11-01T06:00:00+08:00',plannedEndAt:'2026-11-01T06:30:00+08:00'}};
 taskRejects(state,taskCommand(state,'T-M-1','start'),/技能|维修入房/);
 state=approved();const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};freeze(state);const running=taskSuccess(state,taskCommand(state,'T-M-1','start'));assert.equal(running.executionRecords.length,1);
 assert.equal(JSON.stringify([h.businessTasks,h.rooms,h.bookings,h.maintenanceOrders,h.employees,h.shifts,h.operationEvents]),seedSnapshot);
});

const staff=await import(moduleUrl('src/data/staffExecution.ts'));
test('B: identity filters only current assigned tasks; no identity/unknown gives empty list',()=>{
 const state=initial();assert.deepEqual(staff.staffTasks(state.events,state),[]);
 for(const employee of h.employees){const view={...state,currentEmployeeId:employee.id};const tasks=staff.staffTasks(view.events,view);assert.deepEqual(tasks.map(i=>i.task.id),h.currentBusinessTasks(view.events,view).filter(t=>t.assignedEmployeeId===employee.id).map(t=>t.id));assert.equal(new Set(tasks.map(i=>i.task.id)).size,tasks.length);}
 assert.deepEqual(staff.staffTasks(state.events,{...state,currentEmployeeId:'invalid'}),[]);
});
test('B: applied reassignment removes original owner, support never creates staff tasks',()=>{
 const {state,proposal}=fixture();const result=x.applyApprovedProposal(state,proposal,meta());assert.ok(result.ok);const next=result.state;
 const original=staff.staffTasks(next.events,{...next,currentEmployeeId:'E-FRONT-1'});const moved=staff.staffTasks(next.events,{...next,currentEmployeeId:'E-FLEX-1'});
 assert.ok(!original.some(i=>i.task.id==='T-FRONT-CHECK'));assert.equal(moved.filter(i=>i.task.id==='T-FRONT-CHECK').length,1);assert.equal(original.some(i=>next.supportReservations.some(r=>r.reservationId===i.task.id)),false);
 assert.equal(staff.staffTasks(next.events,{...next,currentEmployeeId:'E-HK-7'}).length,0);
});
test('B: selected identity enforced at dispatch and A engine; shared records remain unique',()=>{
 let state={...approved(),currentEmployeeId:'E-HK-1'};const request=taskCommand(state,'T-M-1','start');let result=staff.executeStaffTask(state,request);assert.equal(result.ok,false);assert.strictEqual(result.state,state);
 result=staff.executeStaffTask(state,{...request,actorEmployeeId:'E-HK-1'});assert.equal(result.ok,false);assert.strictEqual(result.state,state);
 state={...state,currentEmployeeId:'E-ENG-1'};result=staff.executeStaffTask(state,request);assert.ok(result.ok);state=result.state;
 assert.equal(staff.staffTasks(state.events,state).find(i=>i.task.id==='T-M-1').category,'in_progress');
 const repeat=staff.executeStaffTask(state,request);assert.equal(repeat.ok,false);assert.strictEqual(repeat.state,state);
 result=staff.executeStaffTask(state,taskCommand(state,'T-M-1','complete'));assert.ok(result.ok);state=result.state;assert.equal(state.executionRecords.length,2);assert.equal(staff.staffTasks(state.events,state).find(i=>i.task.id==='T-M-1').category,'completed');
 const housekeeper={...state,currentEmployeeId:'E-HK-2'};assert.equal(staff.staffTasks(housekeeper.events,housekeeper).find(i=>i.task.id==='T-CLEAN-2').category,'blocked');
 assert.equal(h.currentBusinessTasks(state.events,state).find(t=>t.id==='T-M-1').verificationStatus,'unverified');
});

const tracking=await import(moduleUrl('src/data/executionOverview.ts'));
test('C: scope references, shared task uniqueness and department totals use current view only',()=>{
 const state=initial(),before=JSON.stringify(state);const current=tracking.executionOverview(state.events,state,'breakfast','event');const all=tracking.executionOverview(state.events,state,'arrival','all');
 assert.deepEqual(current.items.map(i=>i.task.id).sort(),[...new Set(state.events.find(e=>e.id==='breakfast').businessRefs.businessTaskIds)].sort());
 assert.equal(all.items.length,new Set(state.events.flatMap(e=>e.businessRefs.businessTaskIds)).size);assert.equal(all.items.filter(i=>i.task.id==='T-FRONT-CHECK').length,1);assert.equal(all.departments.reduce((n,d)=>n+d.total,0),all.items.length);assert.equal(all.items.find(i=>i.task.id==='T-FRONT-CHECK').relatedEvents.length,2);
 const narrow=structuredClone(state);for(const e of narrow.events)e.businessRefs.businessTaskIds=e.id==='arrival'?['T-M-1']:['T-FRONT-CHECK'];assert.equal(tracking.executionOverview(narrow.events,narrow,'arrival','all').items.length,2,'unreferenced daily tasks excluded');assert.equal(JSON.stringify(state),before);
});
test('C: waiting vs current blockage vs deadline risk uses explicit business time, not host clock',()=>{
 const state=approved();const future=tracking.executionOverview(state.events,state,'arrival','event');const clean=future.items.find(i=>i.task.id==='T-CLEAN-2');assert.ok(clean.waiting&&!clean.blocked&&!clean.late);assert.equal(future.metrics.blocked,0);
 const due=tracking.executionOverview(state.events,state,'arrival','event','2026-11-01T12:00:00+08:00');assert.ok(due.items.find(i=>i.task.id==='T-CLEAN-2').blocked);assert.ok(!due.items.find(i=>i.task.id==='T-CLEAN-2').late);
 const late=tracking.executionOverview(state.events,state,'arrival','event','2026-11-01T18:00:00+08:00');assert.ok(late.items.find(i=>i.task.id==='T-CLEAN-2').late);
 const unknown=tracking.executionOverview(state.events,state,'arrival','event','unknown');assert.ok(unknown.items.find(i=>i.task.id==='T-CLEAN-2').waiting);assert.equal(unknown.metrics.blocked,0);assert.ok(unknown.items.every(i=>!i.late));
});
test('C: cross-department repair chain identifies real sources and transitive affected tasks',()=>{
 const state=approved();const report=tracking.executionOverview(state.events,state,'arrival','event','2026-11-01T12:00:00+08:00');const clean=report.items.find(i=>i.task.id==='T-CLEAN-1');assert.equal(clean.sources.filter(s=>s.id==='T-M-1').length,1);assert.equal(clean.sources.find(s=>s.id==='T-M-1').task.departmentId,'engineering');assert.equal(clean.task.departmentId,'rooms');const downstream=report.downstream('T-M-1');assert.ok(downstream.includes('T-CLEAN-1')&&downstream.includes('T-CHECK-1')&&downstream.includes('T-DELIVER-1'));assert.ok(!downstream.includes('T-CLEAN-2'));
});
test('C: staff execution dynamically updates scope and department status without extra state',()=>{
 let state={...approved(),currentEmployeeId:'E-ENG-1'};state=staff.executeStaffTask(state,taskCommand(state,'T-M-1','start')).state;
 let report=tracking.executionOverview(state.events,state,'arrival','event');assert.equal(report.metrics.in_progress,1);assert.equal(report.departments.find(d=>d.id==='engineering').status,'执行中');
 state=staff.executeStaffTask(state,taskCommand(state,'T-M-1','complete')).state;report=tracking.executionOverview(state.events,state,'arrival','all');assert.equal(report.metrics.completed,1);assert.equal(report.metrics.pending+report.metrics.in_progress+report.metrics.completed,report.items.length);assert.equal(report.records.filter(r=>r.taskId==='T-M-1').length,2);assert.equal(report.items.find(i=>i.task.id==='T-M-1').task.verificationStatus,'unverified');
});
test('C: exceptions are scoped/deduplicated; acknowledgement stays active, close does not release repair',()=>{
 let state=approved();state=taskSuccess(state,taskCommand(state,'T-CLEAN-2','report_exception',{exceptionType:'delay',note:'等待维修，反馈给管理人员'}));const exceptionId=state.executionExceptions[0].exceptionId;
 state={...state,executionExceptions:[...state.executionExceptions,...state.executionExceptions]};let report=tracking.executionOverview(state.events,state,'arrival','event','2026-11-01T12:00:00+08:00');assert.equal(report.metrics.openExceptions,1);assert.equal(report.departments.find(d=>d.id==='rooms').status,'存在待处理异常');assert.equal(tracking.executionOverview(state.events,state,'breakfast','event').exceptions.length,0);
 const handle={exceptionId,actorName:'验收管理者',note:'核实维修进度，不修改资源',occurredAt:new Date(Date.now()+5000).toISOString()};state=execution.handleExecutionException(state,{...handle,action:'acknowledge'}).state;assert.equal(tracking.executionOverview(state.events,state,'arrival','event').metrics.openExceptions,1);
 state=execution.handleExecutionException(state,{...handle,action:'close'}).state;report=tracking.executionOverview(state.events,state,'arrival','event','2026-11-01T12:00:00+08:00');assert.equal(report.metrics.openExceptions,0);assert.equal(report.departments.find(d=>d.id==='rooms').status,'部分受阻');assert.ok(report.items.find(i=>i.task.id==='T-CLEAN-2').blocked);assert.equal(h.currentMaintenanceOrders(state.events,state).find(m=>m.id==='M-2').status,'pending');assert.equal(report.exceptions[0].handlingRecords.length,2);
});
test('C: plan progress deduplicates task IDs, excludes support and remains applied after execution',()=>{
 const {state,proposal}=fixture();const applied=x.applyApprovedProposal(state,proposal,meta());assert.ok(applied.ok);let next={...applied.state,currentEmployeeId:'E-FLEX-1'};next={...next,executionPlans:next.executionPlans.map(p=>({...p,affectedTaskIds:[...p.affectedTaskIds,...p.affectedTaskIds]}))};
 let report=tracking.executionOverview(next.events,next,'arrival','all');assert.equal(report.plans[0].total,1);assert.equal(report.plans[0].done,0);const count=report.items.length;next=staff.executeStaffTask(next,taskCommand(next,'T-FRONT-CHECK','start',{eventId:'breakfast'})).state;next=staff.executeStaffTask(next,taskCommand(next,'T-FRONT-CHECK','complete',{eventId:'breakfast'})).state;report=tracking.executionOverview(next.events,next,'arrival','all');assert.equal(report.plans[0].done,1);assert.equal(report.plans[0].plan.status,'applied');assert.equal(report.items.length,count);assert.equal(report.plans[0].plan.supportReservations.length,1);assert.equal(report.items.filter(i=>i.task.id==='T-FRONT-CHECK').length,1);assert.ok(tracking.executionOverview(next.events,next,'arrival','event').plans.some(p=>p.plan.proposalId===proposal.id));
 const snapshot=JSON.stringify(next);tracking.executionOverview(next.events,next,'arrival','all');assert.equal(JSON.stringify(next),snapshot);
});
test('C: missing referenced tasks and support-only plans are explicit, never a false 100%',()=>{
 const state=initial();state.events[0].businessRefs.businessTaskIds.push('MISSING');const report=tracking.executionOverview(state.events,state,'arrival','event');assert.deepEqual(report.missing,['MISSING']);
 const {state:source,proposal}=fixture();const applied=x.applyApprovedProposal(source,proposal,meta());assert.ok(applied.ok);const changed={...applied.state,executionPlans:applied.state.executionPlans.map(p=>({...p,affectedTaskIds:['MISSING']}))};const missing=tracking.executionOverview(changed.events,changed,'breakfast','event').plans[0];assert.equal(missing.total,1);assert.equal(missing.done,0);assert.deepEqual(missing.missing,['MISSING']);const supportOnly={...applied.state,executionPlans:applied.state.executionPlans.map(p=>({...p,affectedTaskIds:[]}))};assert.equal(tracking.executionOverview(supportOnly.events,supportOnly,'breakfast','event').plans[0].total,0);
});
