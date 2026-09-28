// 页面展示工具：时刻、状态徽标等纯渲染函数

import type { CallStatus, TriageLevel } from "./types";

export const STATUS_LABEL: Record<CallStatus, string> = {
  emergency: "急救待排",
  pending: "待排",
  scheduled: "已排椅·待接诊",
  waiting: "等待区",
  in_treatment: "接诊中",
  completed: "已处理",
  rescheduled: "已改约",
};

export function levelBadgeClass(level: TriageLevel): string {
  return `level-badge level-${level.toLowerCase()}`;
}

export function statusBadgeClass(status: CallStatus): string {
  return `status-badge status-${status}`;
}

/** ISO 时刻 -> "09-28 20:40" */
export function fmtDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** ISO 时刻 -> "20:40" */
export function fmtTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 距离复诊截止还剩多久的中文提示 */
export function deadlineCountdown(deadlineIso: string): string {
  const diff = new Date(deadlineIso).getTime() - Date.now();
  if (diff <= 0) return "已过复诊时限";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 24) return `剩余 ${Math.floor(h / 24)}天${h % 24}小时`;
  if (h > 0) return `剩余 ${h}小时${m}分`;
  return `剩余 ${m}分钟`;
}

/** 疼痛分值颜色档 */
export function painClass(score: number): string {
  if (score >= 8) return "pain-critical";
  if (score >= 4) return "pain-mid";
  return "pain-low";
}
