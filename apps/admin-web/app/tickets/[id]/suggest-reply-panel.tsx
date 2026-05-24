'use client';

import { useActionState, useRef } from 'react';
import { suggestReplyAction } from '../actions';

type Props = {
  ticketId: string;
  disabled?: boolean;
  onUse?: (text: string) => void;
};

const initialState = { suggestion: undefined as string | undefined, model: undefined as string | undefined, error: undefined as string | undefined };

export function SuggestReplyPanel({ ticketId, disabled, onUse }: Props) {
  const [state, formAction, isPending] = useActionState(suggestReplyAction, null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <form action={formAction} style={{ display: 'grid', gap: 8 }}>
        <input type="hidden" name="ticketId" value={ticketId} />
        <textarea
          name="operatorNote"
          rows={2}
          placeholder="Opsiyonel: AI'a ek baglam ver (maks. 500 karakter)"
          maxLength={500}
          disabled={disabled || isPending}
          style={{ resize: 'vertical' }}
        />
        <button
          type="submit"
          disabled={disabled || isPending}
          aria-busy={isPending}
          style={{ justifySelf: 'start' }}
        >
          {isPending ? 'Oneri uretiliyor...' : 'AI Yanit Oner'}
        </button>
      </form>

      {state?.error ? (
        <p style={{ color: 'var(--danger, #c0392b)', fontSize: 14 }}>{state.error}</p>
      ) : null}

      {state?.suggestion ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>
            AI onerisi <small>({state.model})</small>
          </label>
          <textarea
            ref={textareaRef}
            rows={6}
            defaultValue={state.suggestion}
            style={{ resize: 'vertical' }}
            readOnly={false}
          />
          {onUse ? (
            <button
              type="button"
              onClick={() => {
                const text = textareaRef.current?.value ?? state.suggestion ?? '';
                onUse(text);
              }}
              style={{ justifySelf: 'start' }}
            >
              Vatandas mesaji olarak kullan
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
