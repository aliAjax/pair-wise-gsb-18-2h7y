// 时间与号表基础工具（资料层）：纯函数，不依赖 DOM

export interface ClinicConfig {
  openTime: string; // "09:00"
  closeTime: string; // "18:00"
  slotMinutes: number;
  workdays: number[]; // 0=周日 … 6=周六；示例门诊全周开放
  slotTimes: string[];
}

export const CLINIC: ClinicConfig = {
  openTime: "09:00",
  closeTime: "18:00",
  slotMinutes: 60,
  workdays: [1, 2, 3, 4, 5, 6, 0],
  slotTimes: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"],
};

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Date -> "YYYY-MM-DD"（本地时区，避免 UTC 偏移） */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Date -> "YYYY-MM-DDTHH:mm"，供 datetime-local 使用 */
export function toLocalInputValue(d: Date): string {
  return `${dateKey(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 解析 dateKey 为本地零点的 Date */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** 把日期 + "HH:MM" 合成 Date */
export function combineDateTime(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

export function addDays(key: string, days: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

export function isWorkday(key: string): boolean {
  return CLINIC.workdays.includes(parseDateKey(key).getDay());
}

/** 从某天起向后找开放日（含当天） */
export function nextOpenDay(fromKey: string): string {
  let key = fromKey;
  for (let i = 0; i < 30; i += 1) {
    if (isWorkday(key)) return key;
    key = addDays(key, 1);
  }
  return key;
}

/** 今天的日期键 */
export function todayKey(now: Date = new Date()): string {
  return dateKey(now);
}

/** 当天门诊是否已结束（非门诊时间来电极少当天能排入） */
export function isAfterCloses(now: Date = new Date()): boolean {
  const [ch, cm] = CLINIC.closeTime.split(":").map(Number);
  return now.getHours() > ch || (now.getHours() === ch && now.getMinutes() >= cm);
}

/** 把分钟数渲染成"当天 / 约24小时 / 约72小时"文案 */
export function renderDeadlineText(
  level: "A" | "B" | "C" | "D",
  deadline: Date,
  sameDayOnly: boolean
): string {
  const now = new Date();
  const sameDay = dateKey(now) === dateKey(deadline);
  const hm = `${pad2(deadline.getHours())}:${pad2(deadline.getMinutes())}`;
  const md = `${deadline.getMonth() + 1}月${deadline.getDate()}日`;
  if (sameDayOnly && sameDay) return `今天门诊结束前（${hm}）`;
  if (sameDayOnly) return `${md} 门诊结束前（${hm}）`;
  const dayWord = sameDay ? "今天" : md;
  const hourWord = level === "B" ? "24小时" : level === "C" ? "72小时" : "7天";
  return `${dayWord} ${hm}（来电后${hourWord}内）`;
}

/** 日期键转中文星期 */
export function weekdayText(key: string): string {
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][parseDateKey(key).getDay()];
}
