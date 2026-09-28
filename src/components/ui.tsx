// 页面层：共享的小展示组件

import type { TriageCall, Urgency } from "../triage/types";
import { isOverdue, URGENCY_LABEL } from "../triage/triageRules";
import { formatDateTime } from "../triage/time";

export const STATUS_LABEL: Record<TriageCall["status"], string> = {
  triaged: "已分诊·待排",
  waiting: "等待区",
  booked: "已约椅位",
  completed: "已接诊",
};

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  return <span className={`badge urgency-${urgency}`}>{URGENCY_LABEL[urgency]}</span>;
}

export function StatusBadge({ status }: { status: TriageCall["status"] }) {
  return <span className={`badge status-${status}`}>{STATUS_LABEL[status]}</span>;
}

/** 复诊时限剩余描述 */
export function deadlineText(call: TriageCall): string {
  const diffMs = new Date(call.deadline).getTime() - Date.now();
  const h = Math.round(diffMs / 3600_000);
  if (call.status === "completed") return formatDateTime(call.deadline);
  if (isOverdue(call)) return `已超时 ${Math.abs(h)} 小时`;
  if (h < 1) {
    const m = Math.max(1, Math.round(diffMs / 60000));
    return `剩 ${m} 分钟`;
  }
  return `剩 ${h} 小时`;
}
