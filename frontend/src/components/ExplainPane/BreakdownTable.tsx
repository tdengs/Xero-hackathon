import { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { ReconciliationEvidence, ReconciliationExplanation } from '@/types';
import EvidenceDrawer from './EvidenceDrawer';

interface BreakdownTableProps {
  explanation: ReconciliationExplanation;
  onRowClick: (rowName: string) => void;
}

function formatCurrency(cents: number, negative = false): string {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Math.abs(cents) / 100);
  return negative ? `-${formatted}` : formatted;
}

interface RowDef {
  key: string;
  label: string;
  amount: number;
  negative: boolean;
  evidenceLabel: string;
  evidenceType: string;
  isBold?: boolean;
}

// Placeholder: in production, pass real evidence from the parent job object.
const EMPTY_EVIDENCE: ReconciliationEvidence[] = [];

export default function BreakdownTable({ explanation, onRowClick }: BreakdownTableProps) {
  const [openRow, setOpenRow] = useState<string | null>(null);

  const rows: RowDef[] = [
    {
      key: 'gross_sales',
      label: 'Gross Sales',
      amount: explanation.grossSales,
      negative: false,
      evidenceLabel: 'payments',
      evidenceType: 'stripe_charge',
    },
    {
      key: 'stripe_fees',
      label: 'Stripe Fees',
      amount: explanation.stripeFees,
      negative: true,
      evidenceLabel: 'View',
      evidenceType: 'stripe_payout',
    },
    {
      key: 'refunds',
      label: 'Refunds',
      amount: explanation.refunds,
      negative: true,
      evidenceLabel: 'refunds',
      evidenceType: 'stripe_charge',
    },
    {
      key: 'chargebacks',
      label: 'Chargeback',
      amount: explanation.chargebacks,
      negative: true,
      evidenceLabel: 'dispute',
      evidenceType: 'stripe_charge',
    },
    {
      key: 'fx_adjustments',
      label: 'FX Adjustment',
      amount: explanation.fxAdjustments,
      negative: true,
      evidenceLabel: 'View',
      evidenceType: 'bank_transaction',
    },
    {
      key: 'net_payout',
      label: 'Net Payout',
      amount: explanation.netPayout,
      negative: false,
      evidenceLabel: '',
      evidenceType: '',
      isBold: true,
    },
  ];

  const handleRowClick = (key: string) => {
    setOpenRow((prev) => (prev === key ? null : key));
    onRowClick(key);
  };

  const tableRows = rows.flatMap((row) => {
    const isOpen = openRow === row.key;
    const isNetPayout = row.key === 'net_payout';

    const dataRow = (
      <tr
        key={row.key}
        onClick={() => handleRowClick(row.key)}
        className={[
          'cursor-pointer border-b border-white/5 transition-colors',
          isOpen ? 'bg-[#0D1B2A]' : 'hover:bg-[#0D1B2A]/50',
          isNetPayout ? 'border-t border-white/10' : '',
        ].join(' ')}
      >
        <td
          className={`px-4 py-3 ${
            row.isBold ? 'font-semibold text-white' : 'text-gray-300'
          }`}
        >
          {row.label}
        </td>
        <td
          className={`px-4 py-3 text-right font-mono ${
            isNetPayout
              ? 'font-bold text-white text-base'
              : row.negative
              ? 'text-red-400'
              : 'text-gray-100'
          }`}
        >
          {row.negative
            ? formatCurrency(row.amount, true)
            : formatCurrency(row.amount)}
        </td>
        <td className="px-4 py-3 text-right">
          {isNetPayout ? (
            explanation.balanced ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 ml-auto" />
            ) : (
              <XCircle className="w-5 h-5 text-red-400 ml-auto" />
            )
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRowClick(row.key);
              }}
              className="text-xs text-[#13B5EA] underline underline-offset-2 hover:text-[#13B5EA]/70 transition-colors"
            >
              {row.evidenceLabel}
            </button>
          )}
        </td>
      </tr>
    );

    if (isNetPayout) return [dataRow];

    const drawerRow = (
      <tr key={`${row.key}-drawer`} className="border-b border-white/5">
        <td colSpan={3} className="px-4 pb-0">
          <EvidenceDrawer
            evidenceType={row.evidenceType}
            items={EMPTY_EVIDENCE}
            isOpen={isOpen}
            onClose={() => setOpenRow(null)}
          />
        </td>
      </tr>
    );

    return [dataRow, drawerRow];
  });

  return (
    <div className="rounded-xl border border-white/5 overflow-hidden bg-[#1A1F36]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/5">
            <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Item
            </th>
            <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Amount
            </th>
            <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Source
            </th>
          </tr>
        </thead>
        <tbody>{tableRows}</tbody>
      </table>
    </div>
  );
}
