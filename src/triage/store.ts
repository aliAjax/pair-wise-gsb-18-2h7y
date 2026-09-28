// 编排层：把资料、判断、排椅、本机保存串起来的状态钩子（不含具体页面样式）

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { triage } from "./rules";
import {
  chairName,
  describeConflicts,
  findEarliestSlot,
  occupantAt,
} from "./schedule";
import { loadState, saveState, subscribeStorage } from "./storage";
import type {
  Assignment,
  CallRecord,
  HistoryEntry,
  Occupancy,
  TriageInput,
  TriageState,
} from "./types";

let idSeq = 0;
function newId(prefix: string): string {
  idSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${idSeq}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function appendHistory(
  record: CallRecord,
  action: string,
  detail: string,
  by: string
): CallRecord {
  const entry: HistoryEntry = { at: nowIso(), action, detail, by };
  return { ...record, history: [...record.history, entry], updatedAt: nowIso() };
}

/** 登记后尝试自动排入时限内最早空闲时段；排不上进等待区并写清冲突 */
function placeAfterTriage(
  record: CallRecord,
  records: CallRecord[],
  blockers: Occupancy[]
): CallRecord {
  const conflictText = describeConflicts(records, blockers, record);
  const slot = findEarliestSlot(records, blockers, record);
  if (slot) {
    const assignment: Assignment = {
      chairId: slot.chairId,
      chairName: slot.chairName,
      date: slot.date,
      time: slot.time,
      assignedAt: nowIso(),
    };
    return appendHistory(
      { ...record, status: "scheduled", assignment },
      "自动排椅",
      `${slot.chairName} ${slot.date} ${slot.time}`,
      "前台"
    );
  }
  return appendHistory(
    { ...record, status: "waiting", waitingReason: conflictText },
    record.triage.level === "A" ? "进入急救待排/等待区" : "进入等待区",
    conflictText,
    "前台"
  );
}

export function useTriageStore() {
  const [state, setState] = useState<TriageState>(() => loadState());
  const stateRef = useRef(state);
  stateRef.current = state;

  // 每次变更写本机：关掉页面后再打开仍能接着排
  useEffect(() => {
    saveState(state);
  }, [state]);

  // 其他窗口改了数据，本窗口跟着更新
  useEffect(() => subscribeStorage(setState), []);

  const commit = (next: TriageState) => {
    stateRef.current = next;
    setState(next);
  };

  const patchRecord = (id: string, fn: (r: CallRecord) => CallRecord) => {
    const prev = stateRef.current;
    commit({ ...prev, records: prev.records.map((r) => (r.id === id ? fn(r) : r)) });
  };

  /** 登记一通来电：保存原始资料 + 分诊判断快照，并尝试排椅 */
  const registerCall = useCallback((input: TriageInput): CallRecord => {
    const result = triage(input);
    const ts = nowIso();
    const prev = stateRef.current;
    const base: CallRecord = {
      ...input,
      id: newId("call"),
      status: result.level === "A" ? "emergency" : "pending",
      triage: result,
      assignment: null,
      waitingReason: "",
      rescheduleReason: "",
      treatment: "",
      doctor: "",
      treatedAt: "",
      history: [],
      createdAt: ts,
      updatedAt: ts,
    };
    const logged = appendHistory(
      base,
      "登记分诊",
      `${result.level}级 · ${result.label}；复诊时限：${result.deadlineText}`,
      "前台"
    );
    const placed = placeAfterTriage(logged, prev.records, prev.blockers);
    commit({ ...prev, records: [placed, ...prev.records] });
    return placed;
  }, []);

  /** 手动排入指定牙椅时段；同一牙椅同一时段只留一人，冲突时返回错误说明 */
  const assignSlot = useCallback(
    (callId: string, chairId: string, date: string, time: string): string | null => {
      const prev = stateRef.current;
      const record = prev.records.find((r) => r.id === callId);
      if (!record) return "记录不存在";
      const occ = occupantAt(prev.records, prev.blockers, chairId, date, time);
      if (occ) return `该时段已安排：${occ.patientName}${occ.tooth ? `（#${occ.tooth}）` : ""}`;
      const assignment: Assignment = {
        chairId,
        chairName: chairName(chairId),
        date,
        time,
        assignedAt: nowIso(),
      };
      const moved = appendHistory(
        { ...record, status: "scheduled", assignment, waitingReason: "" },
        record.status === "waiting" ? "等待区改排" : "手动排椅",
        `${chairName(chairId)} ${date} ${time}`,
        "前台"
      );
      patchRecord(callId, () => moved);
      return null;
    },
    []
  );

  /** 释放椅位后给等待区记录重新自动排椅 */
  const retryAutoAssign = useCallback((callId: string): string | null => {
    const prev = stateRef.current;
    const record = prev.records.find((r) => r.id === callId);
    if (!record) return "记录不存在";
    const slot = findEarliestSlot(prev.records, prev.blockers, record);
    if (!slot) return "复诊时限内仍无空闲椅位，请继续等待或联系医生加椅";
    const moved = appendHistory(
      {
        ...record,
        status: "scheduled",
        waitingReason: "",
        assignment: {
          chairId: slot.chairId,
          chairName: slot.chairName,
          date: slot.date,
          time: slot.time,
          assignedAt: nowIso(),
        },
      },
      "重新排椅成功",
      `${slot.chairName} ${slot.date} ${slot.time}`,
      "前台"
    );
    patchRecord(callId, () => moved);
    return null;
  }, []);

  /** 改约：保留原时段与原因，占用新时段 */
  const reschedule = useCallback(
    (
      callId: string,
      chairId: string,
      date: string,
      time: string,
      reason: string
    ): string | null => {
      const prev = stateRef.current;
      const record = prev.records.find((r) => r.id === callId);
      if (!record) return "记录不存在";
      if (!record.assignment) return "该记录尚未排入椅位";
      if (!reason.trim()) return "请填写改约原因";
      const occ = occupantAt(prev.records, prev.blockers, chairId, date, time);
      if (occ && occ.callId !== callId)
        return `该时段已安排：${occ.patientName}${occ.tooth ? `（#${occ.tooth}）` : ""}`;
      const old = record.assignment;
      const next: CallRecord = appendHistory(
        {
          ...record,
          status: "rescheduled",
          rescheduleReason: reason.trim(),
          assignment: {
            chairId,
            chairName: chairName(chairId),
            date,
            time,
            assignedAt: nowIso(),
            previousAssignment: {
              chairId: old.chairId,
              chairName: old.chairName,
              date: old.date,
              time: old.time,
            },
          },
        },
        "改约",
        `原 ${old.chairName} ${old.date} ${old.time} → 新 ${chairName(chairId)} ${date} ${time}；原因：${reason.trim()}`,
        "前台"
      );
      patchRecord(callId, () => next);
      return null;
    },
    []
  );

  /** 医生确认接诊 */
  const acceptByDoctor = useCallback((callId: string, doctor: string) => {
    patchRecord(callId, (r) =>
      appendHistory(
        { ...r, status: "in_treatment", doctor: doctor.trim() || "值班医生", treatedAt: nowIso() },
        "医生接诊",
        `接诊医生：${doctor.trim() || "值班医生"}`,
        "医生"
      )
    );
  }, []);

  /** 记实际处理并完成 */
  const completeTreatment = useCallback((callId: string, treatment: string) => {
    patchRecord(callId, (r) =>
      appendHistory(
        { ...r, status: "completed", treatment: treatment.trim(), treatedAt: nowIso() },
        "完成处理",
        treatment.trim() || "（未填写处理内容）",
        r.doctor || "医生"
      )
    );
  }, []);

  /** 在空格子上登记既有门诊占用 */
  const addBlocker = useCallback((chairId: string, date: string, time: string, label: string) => {
    const prev = stateRef.current;
    if (occupantAt(prev.records, prev.blockers, chairId, date, time)) return;
    const blocker: Occupancy = {
      id: newId("blk"),
      chairId,
      date,
      time,
      kind: "blocker",
      patientName: label.trim() || "既有预约",
      note: "既有门诊占用",
    };
    commit({ ...prev, blockers: [...prev.blockers, blocker] });
  }, []);

  const removeBlocker = useCallback((blockerId: string) => {
    const prev = stateRef.current;
    commit({ ...prev, blockers: prev.blockers.filter((b) => b.id !== blockerId) });
  }, []);

  const resetDemo = useCallback(() => {
    localStorage.removeItem("rc-triage-state-v1");
    commit(loadState());
  }, []);

  const summary = useMemo(() => {
    const by = (s: CallRecord["status"]) => state.records.filter((r) => r.status === s).length;
    return {
      emergency: state.records.filter(
        (r) => r.triage.level === "A" && ["emergency", "waiting", "scheduled", "in_treatment"].includes(r.status)
      ).length,
      waiting: by("waiting"),
      scheduled: by("scheduled"),
      inTreatment: by("in_treatment"),
      completed: by("completed"),
      rescheduled: by("rescheduled"),
      total: state.records.length,
    };
  }, [state.records]);

  return {
    state,
    summary,
    registerCall,
    assignSlot,
    retryAutoAssign,
    reschedule,
    acceptByDoctor,
    completeTreatment,
    addBlocker,
    removeBlocker,
    resetDemo,
  };
}

export type TriageStore = ReturnType<typeof useTriageStore>;
