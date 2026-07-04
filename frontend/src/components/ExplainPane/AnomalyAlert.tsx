import type { Anomaly } from '@/types';
import { AlertTriangle, Info, AlertOctagon, ExternalLink } from 'lucide-react';

interface AnomalyAlertProps {
  anomaly: Anomaly;
}

const severityConfig = {
  info: {
    bg: 'bg-blue-900/40',
    border: 'border-blue-400',
    text: 'text-blue-300',
    icon: <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />,
  },
  warning: {
    bg: 'bg-amber-900/40',
    border: 'border-amber-400',
    text: 'text-amber-300',
    icon: <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />,
  },
  critical: {
    bg: 'bg-red-900/40',
    border: 'border-red-400',
    text: 'text-red-300',
    icon: <AlertOctagon className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />,
  },
};

export default function AnomalyAlert({ anomaly }: AnomalyAlertProps) {
  const config = severityConfig[anomaly.severity];

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border-l-4 p-3 ${config.bg} ${config.border}`}
    >
      {config.icon}
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${config.text}`}>{anomaly.message}</p>
      </div>
      {anomaly.relatedItemId && (
        <button
          type="button"
          className={`flex items-center gap-1 text-xs font-medium whitespace-nowrap underline underline-offset-2 ${config.text} hover:opacity-80 transition-opacity`}
        >
          Investigate
          <ExternalLink className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
