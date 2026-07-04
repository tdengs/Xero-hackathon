import { format } from 'date-fns';
import { Sparkles } from 'lucide-react';
import type { ChatMessage } from '@/types';

interface MessageBubbleProps {
  message: ChatMessage;
  isUser: boolean;
}

export default function MessageBubble({ message, isUser }: MessageBubbleProps) {
  const timestamp = (() => {
    try {
      return format(new Date(message.timestamp), 'h:mm a');
    } catch {
      return '';
    }
  })();

  if (isUser) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="max-w-[80%] rounded-tl-3xl rounded-bl-3xl rounded-tr-sm bg-[#13B5EA] px-4 py-2.5">
          <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
        {timestamp && (
          <span className="text-[11px] text-gray-500 pr-1">{timestamp}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-start gap-2.5 max-w-[88%]">
        {/* AI avatar */}
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#13B5EA] to-[#0D1B2A] border border-[#13B5EA]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="rounded-tr-3xl rounded-br-3xl rounded-tl-sm bg-[#1A1F36] border border-white/5 px-4 py-2.5">
          <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
          {/* Evidence snippets if present */}
          {message.evidence && message.evidence.length > 0 && (
            <div className="mt-2 pt-2 border-t border-white/5 space-y-1">
              {message.evidence.slice(0, 3).map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center gap-2 text-[11px] text-gray-500"
                >
                  <span className="font-mono truncate max-w-[120px]">
                    {ev.evidenceId}
                  </span>
                  <span className="text-gray-600">·</span>
                  <span>{(ev.amount / 100).toFixed(2)}</span>
                </div>
              ))}
              {message.evidence.length > 3 && (
                <p className="text-[11px] text-gray-600">
                  +{message.evidence.length - 3} more sources
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      {timestamp && (
        <span className="text-[11px] text-gray-500 pl-10">{timestamp}</span>
      )}
    </div>
  );
}
