// 排椅规则（判断/调度层）：同一牙椅同一时段只允许一人，纯函数不碰存储与 DOM

import type { Assignment, CallRecord, Occupancy, SlotCell } from "./types";
import { CLINIC, combineDateTime, dateKey, pad2, todayKey, weekdayText } from "./time";

export interface Chair {
  id: string;
  name: string;
}

export const CHAIRS: Chair[] = [
  { id: "C1", name: "椅1" },
  { id: "C2", name: "椅2" },
  { id: "C3", name: "椅3" },
  { id: "C4", name: "椅4" },
];

/** 当前仍占用椅位时段的记录（已改约者只占新时段，旧时段释放） */
export function activeAssignments(records: CallRecord[]): Array<{
  record: CallRecord;
  assignment: Assignment;
}> {
  const out: Array<{ record: CallRecord; assignment: Assignment }> = [];
  for (const r of records) {
    if (r.assignment && r.status !== "waiting") {
      out.push({ record: r, assignment: r.assignment });
    }
  }
  return out;
}

/** 取某牙椅某时段的占用者（既有门诊占用优先判断） */
export function occupantAt(
  records: CallRecord[],
  blockers: Occupancy[],
  chairId: string,
  date: string,
  time: string
): Occupancy | null {
  const blocker = blockers.find(
    (b) => b.chairId === chairId && b.date === date && b.time === time
  );
  if (blocker) return blocker;
  const hit = records.find(
    (r) =>
      r.status !== "waiting" &&
      r.assignment?.chairId === chairId &&
      r.assignment.date === date &&
      r.assignment.time === time
  );
  if (hit?.assignment) {
    return {
      id: `occ-${hit.id}`,
      chairId,
      date,
      time,
      callId: hit.id,
      kind: "call",
      patientName: hit.patientName,
      tooth: hit.tooth,
      note: statusLabel(hit.status),
    };
  }
  return null;
}

function statusLabel(status: CallRecord["status"]): string {
  const map: Record<CallRecord["status"], string> = {
    emergency: "急救待排",
    pending: "待排",
    scheduled: "已排椅·待接诊",
    waiting: "等待区",
    in_treatment: "接诊中",
    completed: "已处理",
    rescheduled: "已改约",
  };
  return map[status];
}

/** 构建一天的椅位时段网格 */
export function buildDayGrid(
  records: CallRecord[],
  blockers: Occupancy[],
  date: string
): SlotCell[][] {
  return CLINIC.slotTimes.map((time) =>
    CHAIRS.map((chair) => ({
      chairId: chair.id,
      chairName: chair.name,
      date,
      time,
      occupant: occupantAt(records, blockers, chair.id, date, time),
    }))
  );
}

export interface SlotCandidate {
  chairId: string;
  chairName: string;
  date: string;
  time: string;
}

/** 该时段是否在记录的复诊时限内 */
export function withinDeadline(record: CallRecord, date: string, time: string): boolean {
  return combineDateTime(date, time).getTime() <= new Date(record.triage.deadline).getTime();
}

/** 该时段是否已过去（来电当天早于当前时刻的时段不可排） */
export function isFutureSlot(date: string, time: string, now: Date = new Date()): boolean {
  return combineDateTime(date, time).getTime() > now.getTime();
}

/**
 * 在复诊时限内找最早的空闲椅位时段（按时间优先、再按椅位）。
 * A 级只在当天开放时段内找；找不到返回 null，由调用方写入等待区并附冲突说明。
 */
export function findEarliestSlot(
  records: CallRecord[],
  blockers: Occupancy[],
  record: CallRecord,
  now: Date = new Date()
): SlotCandidate | null {
  const deadline = new Date(record.triage.deadline);
  const startDay = dateKey(now);
  const maxDay = dateKey(deadline);
  let day = startDay;
  for (let guard = 0; guard <= 14; guard += 1) {
    if (day > maxDay) break;
    for (const time of CLINIC.slotTimes) {
      const start = combineDateTime(day, time);
      if (start.getTime() <= now.getTime()) continue;
      if (start.getTime() > deadline.getTime()) continue;
      for (const chair of CHAIRS) {
        if (!occupantAt(records, blockers, chair.id, day, time)) {
          return { chairId: chair.id, chairName: chair.name, date: day, time };
        }
      }
    }
    day = nextDayKey(day);
  }
  return null;
}

function nextDayKey(key: string): string {
  const d = combineDateTime(key, CLINIC.openTime);
  d.setDate(d.getDate() + 1);
  return dateKey(d);
}

/**
 * 排不进时，逐条写清冲突：列出复诊时限内本可安排、却被占用的时段。
 */
export function describeConflicts(
  records: CallRecord[],
  blockers: Occupancy[],
  record: CallRecord,
  now: Date = new Date()
): string {
  const deadline = new Date(record.triage.deadline);
  const lines: string[] = [];
  let day = dateKey(now);
  let conflictCount = 0;
  for (let guard = 0; guard <= 14; guard += 1) {
    if (day > dateKey(deadline)) break;
    for (const time of CLINIC.slotTimes) {
      const start = combineDateTime(day, time);
      if (start.getTime() <= now.getTime() || start.getTime() > deadline.getTime()) continue;
      const taken = CHAIRS.map((c) => occupantAt(records, blockers, c.id, day, time)).filter(
        Boolean
      ) as Occupancy[];
      if (taken.length === CHAIRS.length) {
        conflictCount += 1;
        if (lines.length < 4) {
          lines.push(
            `${formatDay(day)} ${time} 四台椅位全满（${taken
              .map((o) => `${chairShort(o.chairId)}${o.patientName}`)
              .join("、")}）`
          );
        }
      }
    }
    day = nextDayKey(day);
  }
  const head =
    record.triage.level === "A"
      ? `急救待排：今天门诊剩余时段无空闲牙椅，共${conflictCount}个时段全满`
      : `复诊时限（${record.triage.deadlineText}）内无空闲牙椅，${conflictCount}个候选时段全满`;
  return lines.length ? `${head}：${lines.join("；")}${conflictCount > 4 ? " 等" : ""}` : head;
}

function chairShort(chairId: string): string {
  return CHAIRS.find((c) => c.id === chairId)?.name ?? chairId;
}

/** 网格上展示的中文日期 */
export function formatDay(key: string): string {
  const today = todayKey();
  const d = key.split("-").slice(1).join("/");
  return key === today ? `今天 ${d}` : `${d} ${weekdayText(key)}`;
}

/** 单个时段冲突的简短说明（手动选了被占用的格子时用） */
export function slotConflictDetail(occupant: Occupancy): string {
  return `该时段已安排：${occupant.patientName}${occupant.tooth ? `（#${occupant.tooth}）` : ""}${
    occupant.note ? ` · ${occupant.note}` : ""
  }`;
}

export function chairName(id: string): string {
  return CHAIRS.find((c) => c.id === id)?.name ?? id;
}

export function timeListForDate(
  date: string,
  now: Date = new Date()
): string[] {
  if (date !== todayKey(now)) return CLINIC.slotTimes;
  return CLINIC.slotTimes.filter((t) => combineDateTime(date, t).getTime() > now.getTime());
}

export function formatHM(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
