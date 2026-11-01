import type {OperationEvent} from './data/hotelDemo';
import type {Proposal} from './data/resourceCoordination';
import {validateProposal} from './data/resourceCoordination';
// 只读页面口径：事件审批与同事件/同业务版本的互斥资源选择事项不合并。
export function resourceDecisionSummary(events:OperationEvent[],plans:Record<string,Proposal[]>){
 const fingerprint=JSON.stringify(events);const unique=[...new Map(Object.values(plans).flat().map(p=>[p.id,p])).values()];
 const candidates=unique.filter(p=>p.approval==='pending'&&p.fingerprint===fingerprint&&events.some(e=>e.id===p.eventId)&&!unique.some(other=>other.eventId===p.eventId&&other.fingerprint===fingerprint&&other.approval==='approved'));
 const groups=events.map(event=>{const options=candidates.filter(p=>p.eventId===event.id);const feasible=options.filter(p=>validateProposal(p,events).feasible);return {event,candidates:options,feasible,infeasible:options.filter(p=>!feasible.some(f=>f.id===p.id))};}).filter(g=>g.candidates.length>0);
 return {groups,decisions:groups.filter(g=>g.feasible.length>0),candidateCount:candidates.length,feasibleCandidateCount:groups.reduce((n,g)=>n+g.feasible.length,0)};
}
