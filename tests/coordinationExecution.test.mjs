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
const seedSnapshot=JSON.stringify([h.businessTasks,h.rooms,h.bookings,h.maintenanceOrders,h.employees,h.shifts,h.operationEvents]);
const initial=()=>({events:structuredClone(h.operationEvents),revision:0,taskOverrides:{},supportReservations:[],executionPlans:[]});
const command=(state,eventId,action,taskId)=>({...state,events:h.transitionEvents(state.events,eventId,action,taskId,state)});
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
