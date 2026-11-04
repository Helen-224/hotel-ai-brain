import {useRef, useState} from 'react';
import './hotel-ai-assistant.css';

function Sparkles() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 3l2.1 5.9L18 11l-5.9 2.1L10 19l-2.1-5.9L2 11l5.9-2.1L10 3zM19 2l1 2.5 2.5 1L20 6.5 19 9l-1-2.5-2.5-1 2.5-1L19 2zM19 15v6m-3-3h6"/>
  </svg>;
}

export function HotelAIAssistant() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const launcher = useRef<HTMLButtonElement>(null);
  function dismiss(clear = false) {
    setOpen(false);
    if (clear) setDraft('');
    launcher.current?.focus();
  }

  return <div className="hotel-assistant" onKeyDown={event => {
    if (open && event.key === 'Escape') {
      event.stopPropagation();
      dismiss();
    }
  }}>
    <button ref={launcher} type="button" className="hotel-assistant-launcher" aria-label="酒店智能助手" aria-expanded={open} aria-controls={open ? 'hotel-assistant-panel' : undefined} onClick={() => setOpen(!open)}>
      <Sparkles/>
    </button>
    {open && <div id="hotel-assistant-panel" className="hotel-assistant-panel" role="region" aria-label="Hotel AI Assistant">
      <div className="hotel-assistant-top">
        <Sparkles/>
        <div><strong>Hotel AI Assistant</strong><small>酒店智能助手</small></div>
        <button type="button" aria-label="收起助手" onClick={() => dismiss()}>−</button>
        <button type="button" aria-label="关闭助手" onClick={() => dismiss(true)}>×</button>
      </div>
      <div className="hotel-assistant-welcome">
        <h2>您好！</h2>
        <p>我是您的酒店智能运营助手，很高兴为您服务。</p>
        <h3>有什么问题可以问我？</h3>
        <p>您可以随时向我咨询酒店运营、客房管理、服务流程等相关问题。</p>
      </div>
      <div className="hotel-assistant-compose">
        <input aria-label="您想了解的问题" placeholder="请输入您想了解的问题..." value={draft} onChange={event => setDraft(event.target.value)}/>
        <small>演示模式 · 支持文字输入</small>
      </div>
    </div>}
  </div>;
}
