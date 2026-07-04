import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles } from 'lucide-react';
import { sendChatMessage } from '@/services/api';
import type { ChatMessage, ReconciliationEvidence } from '@/types';
import MessageBubble from './MessageBubble';

interface ChatInterfaceProps {
  payoutId?: string;
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function nowIso() {
  return new Date().toISOString();
}

const BASE_CHIPS = [
  'Anything unusual this week?',
  'Why is cash lower than revenue?',
  'Show me all refunds this month',
];

const PAYOUT_CHIP = 'Explain this payout';

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 px-2">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#13B5EA] to-[#0D1B2A] border border-[#13B5EA]/30 flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="flex items-center gap-1 rounded-tr-3xl rounded-br-3xl rounded-tl-sm bg-[#1A1F36] border border-white/5 px-4 py-3">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="block w-1.5 h-1.5 rounded-full bg-[#13B5EA]"
            animate={{ y: [0, -5, 0] }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: i * 0.15,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function ChatInterface({ payoutId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hi! I'm PayTrace AI. I can help you understand your Stripe payouts, find anomalies, match invoices, and reconcile with Xero. What would you like to know?",
      timestamp: nowIso(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const chips = payoutId ? [...BASE_CHIPS, PAYOUT_CHIP] : BASE_CHIPS;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    setError(null);
    const userMsg: ChatMessage = {
      id: makeId(),
      role: 'user',
      content: trimmed,
      timestamp: nowIso(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const { reply, evidence } = await sendChatMessage(trimmed, payoutId);
      const aiMsg: ChatMessage = {
        id: makeId(),
        role: 'assistant',
        content: reply,
        evidence: evidence as ReconciliationEvidence[],
        timestamp: nowIso(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      setError('Failed to get a response. Please try again.');
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleChipClick = (chip: string) => {
    sendMessage(chip);
  };

  const adjustHeight = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  return (
    <div className="flex flex-col h-full bg-[#0D1B2A]">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5 flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#13B5EA] to-[#0D1B2A] border border-[#13B5EA]/30 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Ask PayTrace AI</h2>
          <span className="text-[10px] text-[#13B5EA]/70 font-medium tracking-wide">
            powered by Claude
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <MessageBubble
                message={msg}
                isUser={msg.role === 'user'}
              />
            </motion.div>
          ))}

          {isTyping && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
            >
              <TypingIndicator />
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-red-400 text-center py-1"
          >
            {error}
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggested chips */}
      {!isTyping && (
        <div className="px-4 pb-2 flex-shrink-0">
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleChipClick(chip)}
                disabled={isTyping}
                className="rounded-full border border-[#13B5EA]/25 bg-[#13B5EA]/5 px-3 py-1.5 text-xs text-[#13B5EA] hover:bg-[#13B5EA]/15 transition-colors disabled:opacity-40"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="px-4 pb-4 flex-shrink-0">
        <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-[#1A1F36] px-4 py-3 focus-within:border-[#13B5EA]/40 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              adjustHeight();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about your finances…"
            rows={1}
            disabled={isTyping}
            className="flex-1 resize-none bg-transparent text-sm text-gray-200 placeholder-gray-600 outline-none leading-relaxed max-h-[120px] overflow-y-auto disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isTyping}
            className="w-8 h-8 rounded-full bg-[#13B5EA] flex items-center justify-center text-white hover:bg-[#13B5EA]/80 transition-colors disabled:opacity-40 flex-shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-gray-600 text-center">
          PayTrace AI may make mistakes. Always verify financial data.
        </p>
      </div>
    </div>
  );
}
