// 资料层：时间与椅位槽位工具

import type { Chair, Slot } from "./types";

export const SLOT_MINUTES = 30;
export const DAY_START = "09:00";
export const DAY_END = "18:00"; // 最后一个槽位 17:30 开始

export const CHAIRS: Chair[] = [
  { id: "C1", name: "1号椅" },
  { id: "C2", name: "2号椅" },
  { id: "C3", name: "3号椅" },
];

const pad = (n: number) => String(n).padStart(2, "0");

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toHM(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 合并当地日期 YYYY-MM-DD 与 HH:mm 为 Date */
export function combine(date: string, hm: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = hm.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${toISODate(d)} ${toHM(d)}`;
}

export function formatClock(iso: string): string {
  return toHM(new Date(iso));
}

/** 当前日期与时刻，供表单默认值 */
export function nowLocal(): { date: string; hm: string; iso: string } {
  const d = new Date();
  return { date: toISODate(d), hm: toHM(d), iso: d.toISOString() };
}

/** datetime-local 控件值 -> ISO */
export function fromDateTimeLocal(value: string): string {
  return new Date(value).toISOString();
}

/** ISO -> datetime-local 控件值（本地时区） */
export function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  return `${toISODate(d)}T${toHM(d)}`;
}

/** 生成一天的 30 分钟槽位 09:00–17:30 */
export function daySlots(date: string): Slot[] {
  const out: Slot[] = [];
  const cursor = combine(date, DAY_START);
  const end = combine(date, DAY_END);
  while (cursor < end) {
    const startTime = toHM(cursor);
    cursor.setMinutes(cursor.getMinutes() + SLOT_MINUTES);
    out.push({ date, startTime, endTime: toHM(cursor) });
  }
  return out;
}

/** 把分钟数向上取整到槽位边界（09:00–18:00 内） */
export function ceilSlot(date: string, hm: string): string {
  const start = combine(date, DAY_START).getTime();
  const target = combine(date, hm).getTime();
  if (target <= start) return DAY_START;
  const elapsedMin = Math.ceil((target - start) / 60000);
  const snapped = Math.ceil(elapsedMin / SLOT_MINUTES) * SLOT_MINUTES;
  const maxMin =
    (combine(date, DAY_END).getTime() - start) / 60000 - SLOT_MINUTES;
  const clamped = Math.min(snapped, maxMin);
  const d = new Date(start + clamped * 60000);
  return toHM(d);
}

/** 在某槽位之后顺延指定个槽位（同一天内），超出收班返回 null */
export function shiftSlot(
  date: string,
  hm: string,
  count: number
): string | null {
  const slots = daySlots(date).map((s) => s.startTime);
  const idx = slots.indexOf(hm);
  if (idx === -1) return null;
  return slots[idx + count] ?? null;
}

export function chairName(chairId: string): string {
  return CHAIRS.find((c) => c.id === chairId)?.name ?? chairId;
}

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}
