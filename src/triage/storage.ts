// 本机保存层：localStorage 持久化，关闭页面/浏览器后再打开仍能接着排
// 与页面完全解耦：只负责 TriageState 的读写、校验、跨标签同步与示例数据播种

import type { CallRecord, Occupancy, TriageState } from "./types";

const STORAGE_KEY = "rc-triage-state-v1";
const STATE_VERSION = 1;

export function loadState(): TriageState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seedState();
      saveState(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as TriageState;
    if (!parsed || parsed.version !== STATE_VERSION || !Array.isArray(parsed.records)) {
      const seeded = seedState();
      saveState(seeded);
      return seeded;
    }
    return {
      version: STATE_VERSION,
      records: parsed.records,
      blockers: Array.isArray(parsed.blockers) ? parsed.blockers : [],
    };
  } catch {
    return seedState();
  }
}

export function saveState(state: TriageState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    // 本机存储满或被禁用时不中断分诊操作，仅在控制台留痕
    console.warn("本机保存失败", err);
  }
}

export function clearState(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** 订阅其他标签页/窗口的存储变更，实现多窗口接着排 */
export function subscribeStorage(handler: (state: TriageState) => void): () => void {
  const listener = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      handler(JSON.parse(e.newValue) as TriageState);
    } catch {
      /* 忽略无法解析的内容 */
    }
  };
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}

// —— 首次使用的示例数据：覆盖急症排椅、等待区冲突、待接诊、已处理四种形态 ——
function seedState(): TriageState {
  const now = new Date();
  const today = key(now);
  const iso = (h: number, m = 0) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m).toISOString();

  // 占满今天当前时刻之后的全部椅位时段（11:00 椅1 留给下方已排的急症患者），
  // 让等待区记录"今天无空闲椅位"的冲突说明与号表真实一致
  const blockers: Occupancy[] = [];
  const demoNames = ["复查·赵", "备牙·钱", "洁治·孙", "正畸·李"];
  for (const t of ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"]) {
    const [hh, mm] = t.split(":").map(Number);
    const isFuture = now < new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm);
    if (!isFuture) continue;
    for (let ci = 0; ci < 4; ci += 1) {
      const chairId = `C${ci + 1}`;
      if (t === "11:00" && chairId === "C1") continue;
      blockers.push({
        id: `b-${t}-${chairId}`,
        chairId,
        date: today,
        time: t,
        kind: "blocker",
        patientName: demoNames[ci],
        note: "既有门诊占用",
      });
    }
  }

  const records: CallRecord[] = [
    {
      id: "seed-1",
      patientName: "林晓",
      phone: "138****2041",
      tooth: "46",
      calledAt: iso(8, 40),
      painScore: 9,
      symptoms: {
        throbbing: true,
        bitePain: true,
        nightPain: true,
        spontaneous: true,
        swelling: false,
        fever: false,
        trismus: false,
        highBite: false,
      },
      note: "根管治疗后第二晚，跳痛一夜，凌晨痛醒两次。",
      status: "scheduled",
      triage: {
        level: "A",
        label: "急症 · 当天处理",
        deadlineHours: 0,
        deadline: iso(18),
        deadlineText: "今天门诊结束前（18:00）",
        sameDayOnly: true,
        reasons: [
          "疼痛分值 9/10，属剧烈疼痛",
          "跳痛合并夜间痛（痛醒/无法入睡），符合急性根尖周炎急症表现",
        ],
        advice: [
          "立即安排当天回诊；若当天椅位已满，进入急救待排优先加椅",
          "来诊前可按说明书剂量服用布洛芬（无禁忌时），不要自行挑开暂封物",
        ],
      },
      assignment: {
        chairId: "C1",
        chairName: "椅1",
        date: today,
        time: "11:00",
        assignedAt: iso(8, 45),
      },
      waitingReason: "",
      rescheduleReason: "",
      treatment: "",
      doctor: "",
      treatedAt: "",
      history: [
        {
          at: iso(8, 45),
          action: "登记分诊",
          detail: "A级急症，自动排入椅1 今天 11:00",
          by: "前台",
        },
      ],
      createdAt: iso(8, 40),
      updatedAt: iso(8, 45),
    },
    {
      id: "seed-2",
      patientName: "陈默",
      phone: "139****8830",
      tooth: "36",
      calledAt: iso(9, 5),
      painScore: 8,
      symptoms: {
        throbbing: true,
        bitePain: true,
        nightPain: true,
        spontaneous: false,
        swelling: true,
        fever: false,
        trismus: false,
        highBite: false,
      },
      note: "颊侧肿起，咬合先碰到。",
      status: "waiting",
      triage: {
        level: "A",
        label: "急症 · 当天处理",
        deadlineHours: 0,
        deadline: iso(18),
        deadlineText: "今天门诊结束前（18:00）",
        sameDayOnly: true,
        reasons: ["面部或牙龈肿胀，存在急性根尖周脓肿/感染扩散风险", "疼痛分值 8/10，属剧烈疼痛"],
        advice: ["立即安排当天回诊；若当天椅位已满，进入急救待排优先加椅"],
      },
      assignment: null,
      waitingReason:
        "急救待排：今天门诊剩余时段无空闲牙椅，所有候选时段四台椅位全满。请联系医生加椅或释放既有占用后再排。",
      rescheduleReason: "",
      treatment: "",
      doctor: "",
      treatedAt: "",
      history: [
        {
          at: iso(9, 10),
          action: "登记分诊",
          detail: "A级急症，时限内无空闲椅位，进入等待区",
          by: "前台",
        },
      ],
      createdAt: iso(9, 5),
      updatedAt: iso(9, 10),
    },
  ];

  return { version: STATE_VERSION, records, blockers };
}

function key(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
