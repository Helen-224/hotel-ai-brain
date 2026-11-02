import {rooms,bookings,businessTasks,maintenanceOrders,employees,shifts} from './hotelDemo';

// Presentation only: preserve source IDs and analysis data for internal joins.
const roomName=(id:string)=>`${rooms.find(r=>r.id===id)?.roomNumber||id} 房`;
const labels:Record<string,string>={};
rooms.forEach(r=>labels[r.id]=`${r.roomNumber} 房`);
employees.forEach(e=>labels[e.id]=e.name);
maintenanceOrders.forEach(m=>labels[m.id]=`${roomName(m.roomId)}${m.maintenanceType}维修`);
bookings.forEach(b=>{labels[b.id]=`${roomName(b.roomId)}${b.isVip?' VIP':''}预订`;b.specialRequests.forEach(r=>labels[r.id]=r.description)});
businessTasks.forEach(t=>labels[t.id]=t.title.replace(/M-\d+\s*/g,'').replace(/B-ARR-\d+\s*/g, t.roomId?roomName(t.roomId)+' ':''));
shifts.forEach(s=>labels[s.id]=`${employees.find(e=>e.id===s.employeeId)?.name||'员工'}${s.shiftType}`);
Object.assign(labels,{early:'07:00–08:00',peak:'08:00–09:00',breakfast_greeting:'早餐迎宾',breakfast_service:'餐饮服务',inspection_pending:'待检查',in_progress:'进行中',unverified:'待验收',verified:'已验收',pending:'待开始',completed:'已完成',checked_in:'已入住',confirmed:'已确认',guest_confirmed:'客人已确认',hotel_pending:'酒店待确认',department_received:'部门已接收',cleaning:'客房清洁',inspection:'客房检查',vip_service:'VIP 服务',front_check:'接待核对',maintenance:'维修',delivery:'交房确认',rooms:'客房部',front:'前厅部',engineering:'工程部',dining:'餐饮部','BF-1101':'11月1日早餐服务'});
const escaped=Object.keys(labels).sort((a,b)=>b.length-a.length).map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
const pattern=new RegExp(`(?<![A-Za-z0-9_-])(${escaped.join('|')})(?![A-Za-z0-9_-])`,'g');
export function businessText(text:string){return text.replace(pattern,key=>labels[key]).replace(/2026-(\d{2})-(\d{2})T(\d{2}:\d{2}):00\+08:00/g,(_,m,d,t)=>`${Number(m)}月${Number(d)}日 ${t}`).replace(/VIP true/g,'VIP 客人').replace(/VIP false/g,'普通客人').replace(/前置作业阻塞/g,'需等其他工作完成后才能开始').replace(/前置依赖限制/g,'其他未完成工作的影响').replace(/执行完成未验证/g,'已完成、待验收').replace(/执行完成但未验证/g,'已完成、待验收').replace(/验证 待验收/g,'待验收').replace(/验证 已验收/g,'已验收').replace(/非阻塞/g,'不影响交房').replace(/阻塞交付/g,'影响交房').replace(/前置 /g,'开始前需完成：').replace(/支援占用/g,'已安排支援').replace(/覆盖差异/g,'人员缺口').replace(/硬约束/g,'必须满足的条件');}
