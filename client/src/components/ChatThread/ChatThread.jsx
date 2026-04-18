import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { formatIST } from '../../utils/timeUtils';
import './ChatThread.css';

export default function ChatThread({ messages = [], onSend }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
  };

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  return (
    <div className="chat-thread">
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-bubble ${msg.senderId === user?._id ? 'own' : 'other'}`}>
            <div className="chat-bubble-header">
              <span className="chat-sender">{msg.senderName || msg.senderRole}</span>
              <span className="chat-role badge-pill">{msg.senderRole}</span>
            </div>
            <p className="chat-text">{msg.message}</p>
            <span className="chat-time text-mono">{formatIST(msg.timestamp)}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="chat-input-area">
        <input className="input-field chat-input" placeholder="Type a message..." value={text} onChange={e => setText(e.target.value)} onKeyDown={handleKey} />
        <button className="btn btn-primary chat-send" onClick={handleSend} disabled={!text.trim()}>SEND</button>
      </div>
    </div>
  );
}
