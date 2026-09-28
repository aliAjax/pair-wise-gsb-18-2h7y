// 本机保存层：只负责浏览器本机读写（关掉页面后仍能接着排），与页面/判断分离

import type { PersistState, TriageCall } from "./types";
import { evaluate } from "./triageRules";
import { toISODate } from "./time";

const STORAGE_KEY = "hxwl-04-triage-v1";

export function emptyState(): PersistState {
  return {
    version: 1,
    calls: [],
    bookings: [],
    reschedules: [],
    savedAt: new Date().toISOString(),
  };
}

/** 读本机资料；损坏或缺失时回退为空，不抛错 */
export function loadState(): PersistState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw) as PersistState;
    if (parsed.version !== 1 || !Array.isArray(parsed.calls)) {
      return seedState();
    }
    return {
      ...emptyState(),
      ...parsed,
    };
  } catch {
    return seedState();
  }
}

export function saveState(state: PersistState): boolean {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...state, savedAt: new Date().toISOString() })
    );
    return true;
  } catch {
    return false;
  }
}

export function clearState(): PersistState {
  const fresh = seedState();
  saveState(fresh);
  return fresh;
}

interface SeedSpec {
  patientName: string;
  phone: string;
  tooth: string;
  hourOffset: number; // 相对当前时刻往前的小时数
  painScore: number;
  painNature: TriageCall["painNature"];
  nightPain: boolean;
  swelling?: boolean;
  fever?: boolean;
  postOpDays: number;
  note: string;
}

const SEED_SPECS: SeedSpec[] = [
  {
    patientName: "张磊",
    phone: "138****2041",
    tooth: "36",
    hourOffset: 2,
    painScore: 8,
    painNature: "throbbing",
    nightPain: true,
    postOpDays: 2,
    note: "根管封药后第二晚，跳痛影响入睡，暂封完好。",
  },
  {
    patientName: "李婷",
    phone: "139****7720",
    tooth: "11",
    hourOffset: 1,
    painScore: 6,
    painNature: "bite",
    nightPain: false,
    postOpDays: 2,
    note: "咬合时患牙明显疼痛，不敢对合。",
  },
  {
    patientName: "王芳",
    phone: "137****0985",
    tooth: "46",
    hourOffset: 5,
    painScore: 3,
    painNature: "dull",
    nightPain: false,
    postOpDays: 2,
    note: "轻微酸胀，进食时明显，无肿胀。",
  },
  {
    patientName: "赵强",
    phone: "136****5512",
    tooth: "26",
    hourOffset: 0.5,
    painScore: 7,
    painNature: "throbbing",
    nightPain: true,
    swelling: true,
    fever: false,
    postOpDays: 2,
    note: "颊侧肿胀，跳痛放射至太阳穴，要求当天看。",
  },
];

/** 首次打开时给一份演示资料：前三人已占椅，急救患者排不进、留在等待区 */
export function seedState(): PersistState {
  const now = new Date();
  const today = toISODate(now);
  const calls: TriageCall[] = SEED_SPECS.map((spec, i) => {
    const calledAt = new Date(now.getTime() - spec.hourOffset * 3600_000);
    const verdict = evaluate(
      {
        painScore: spec.painScore,
        painNature: spec.painNature,
        nightPain: spec.nightPain,
        swelling: Boolean(spec.swelling),
        fever: Boolean(spec.fever),
        postOpDays: spec.postOpDays,
      },
      calledAt.toISOString()
    );
    return {
      id: `call_seed_${i + 1}`,
      patientName: spec.patientName,
      phone: spec.phone,
      tooth: spec.tooth,
      calledAt: calledAt.toISOString(),
      painScore: spec.painScore,
      painNature: spec.painNature,
      nightPain: spec.nightPain,
      swelling: Boolean(spec.swelling),
      fever: Boolean(spec.fever),
      postOpDays: spec.postOpDays,
      note: spec.note,
      urgency: verdict.urgency,
      advice: verdict.advice,
      deadline: verdict.deadline,
      status: "triaged",
      createdAt: calledAt.toISOString(),
      updatedAt: calledAt.toISOString(),
    };
  });

  const chairs = ["C1", "C2", "C3"];
  const slots = ["09:00", "09:30", "10:00"];
  const bookings = calls.slice(0, 3).map((call, i) => ({
    id: `bk_seed_${i + 1}`,
    callId: call.id,
    chairId: chairs[i],
    date: today,
    startTime: slots[i],
    endTime: ["09:30", "10:00", "10:30"][i],
    status: "pending" as const,
    createdAt: now.toISOString(),
  }));

  calls[0].status = "booked";
  calls[0].bookingId = bookings[0].id;
  calls[1].status = "booked";
  calls[1].bookingId = bookings[1].id;
  calls[2].status = "booked";
  calls[2].bookingId = bookings[2].id;

  // 第 4 例急救：派位时三椅早间已满（seed 只示意等待区冲突）
  calls[3].status = "waiting";
  calls[3].conflictNote =
    "当日急救时段三椅均有治疗，系统未排入；等待人工协调加台或改约。";

  return {
    version: 1,
    calls,
    bookings,
    reschedules: [],
    savedAt: now.toISOString(),
  };
}
