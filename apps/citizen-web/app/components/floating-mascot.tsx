'use client';

import { useEffect, useRef, useState } from 'react';
import { MascotAvatar } from './mascot-avatar';
import { sendMascotMessage } from './mascot-actions';

type ChatMessage = { role: 'assistant' | 'user'; text: string; tone?: 'normal' | 'tracking' };

export function FloatingMascot({
  tenantSlug,
  title,
  welcome,
  enabled,
}: {
  tenantSlug: string;
  title: string;
  welcome: string;
  enabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', text: welcome }]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, sending, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!enabled) return null;

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setSending(true);
    try {
      const result = await sendMascotMessage(tenantSlug, conversationId, text);
      if (result.conversationId) setConversationId(result.conversationId);
      setMessages((prev) => {
        const next: ChatMessage[] = [...prev, { role: 'assistant', text: result.reply }];
        if (result.trackingToken) {
          next.push({ role: 'assistant', tone: 'tracking', text: `Takip kodunuz: ${result.trackingToken} — durumu “Başvuru Takibi” sayfasından izleyebilirsiniz.` });
        }
        return next;
      });
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="mascot-root">
      {open && (
        <section className="mascot-panel" role="dialog" aria-label={title}>
          <header className="mascot-panel-head">
            <span className="mascot-head-avatar">
              <MascotAvatar size={38} talking={sending} />
            </span>
            <span className="mascot-head-text">
              <strong>{title}</strong>
              <span className="mascot-head-status">
                <span className="mascot-dot" /> Çevrimiçi · yapay zeka destekli
              </span>
            </span>
            <button type="button" className="mascot-close" aria-label="Sohbeti kapat" onClick={() => setOpen(false)}>
              ×
            </button>
          </header>

          <div className="mascot-messages" ref={listRef}>
            {messages.map((message, index) => (
              <div
                key={index}
                className={`mascot-message mascot-message-${message.role}${message.tone === 'tracking' ? ' mascot-message-tracking' : ''}`}
              >
                {message.text}
              </div>
            ))}
            {sending && (
              <div className="mascot-message mascot-message-assistant mascot-typing" aria-live="polite">
                <span /> <span /> <span />
              </div>
            )}
          </div>

          <div className="mascot-composer">
            <textarea
              ref={inputRef}
              className="mascot-input"
              rows={1}
              value={input}
              placeholder="Sorunuzu yazın… (ör. çöp ne zaman toplanıyor?)"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onKeyDown}
              disabled={sending}
            />
            <button type="button" className="mascot-send" onClick={() => void handleSend()} disabled={sending || !input.trim()} aria-label="Gönder">
              ➤
            </button>
          </div>
        </section>
      )}

      <button
        type="button"
        className={`mascot-launcher${open ? ' is-open' : ''}`}
        aria-label={open ? 'Asistanı kapat' : 'Belediye asistanı ile konuş'}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <MascotAvatar size={46} />
        {!open && <span className="mascot-launcher-label">Size nasıl yardımcı olabilirim?</span>}
      </button>
    </div>
  );
}
