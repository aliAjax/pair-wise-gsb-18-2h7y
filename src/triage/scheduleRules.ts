// 判断层：椅位时段排程规则。同一牙椅同一槽位只留一人

import type { ChairBooking, TriageCall } from "./types";
import { CHAIRS, ceilSlot, combine, daySlots } from "./time";

/** 仍占用椅位的预约（已接诊 seen 视为完成，不占改约后的时段） */
export function isActive(b: ChairBooking): boolean {
  return b.status === "pending";
}

export function activeBookings(bookings: ChairBooking[]): ChairBooking[] {
  return bookings.filter(isActive);
}

/** 判断某椅某日某槽位是否空闲；冲突时返回占用者预约 */
export function findConflict(
  bookings: ChairBooking[],
  chairId: string,
  date: string,
  startTime: string
): ChairBooking | undefined {
  return bookings.find(
    (b) =>
      isActive(b) &&
      b.chairId === chairId &&
      b.date === date &&
      b.startTime === startTime
  );
}

export interface AutoPick {
  ok: boolean;
  chairId?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  conflict?: string; // 排不上时写清冲突
}

/**
 * 自动找位：从复诊时限当天、时限时刻向上取整到槽位边界开始，
 * 逐槽位、逐椅位找第一个空椅；当天满则排不进（留在等待区）。
 */
export function autoPickSlot(
  bookings: ChairBooking[],
  deadlineISO: string
): AutoPick {
  const deadline = new Date(deadlineISO);
  const date = formatDate(deadline);
  const slots = daySlots(date);
  const first = ceilSlot(date, formatHM(deadline));
  const startIndex = Math.max(
    0,
    slots.findIndex((s) => s.startTime === first)
  );

  for (let i = startIndex; i < slots.length; i++) {
    for (const chair of CHAIRS) {
      if (!findConflict(bookings, chair.id, date, slots[i].startTime)) {
        return {
          ok: true,
          chairId: chair.id,
          date,
          startTime: slots[i].startTime,
          endTime: slots[i].endTime,
        };
      }
    }
  }

  // 当天所有椅位剩余槽位均满
  const busy = activeBookings(bookings).filter((b) => b.date === date);
  return {
    ok: false,
    date,
    conflict:
      `${date} 从 ${slots[startIndex].startTime} 起 ${CHAIRS.length} 台椅位全部约满` +
      (busy.length ? `（当日已有 ${busy.length} 个有效预约）` : "") +
      "，已留在等待区，请人工协调或改约次日。",
  };
}

/** 手动指定椅位槽位的冲突描述 */
export function describeManualConflict(
  bookings: ChairBooking[],
  call: TriageCall,
  chairId: string,
  date: string,
  startTime: string
): string | null {
  const existing = findConflict(bookings, chairId, date, startTime);
  if (!existing) return null;
  const other = existing.callId === call.id;
  return other
    ? `${date} ${startTime} 该椅位已被本患者另一预约占用`
    : `${date} ${startTime} 椅位时段冲突：已被另一患者（预约 ${existing.id}）占用，同一牙椅同一时段只留一人`;
}

function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function formatHM(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export { combine };
