// 状态层：页面操作入口。组合分诊判断、椅位规则与本机保存
// 页面只调用这里的动作，不直接碰 localStorage

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  ActionResult,
  ActualTreatment,
  ChairBooking,
  PersistState,
  TriageCall,
} from "./types";
import {
  autoPickSlot,
  describeManualConflict,
  findConflict,
} from "./scheduleRules";
import { evaluate, type TriageInput } from "./triageRules";
import { daySlots, uid } from "./time";
import { clearState, loadState, saveState } from "./storage";

export interface NewCallInput extends TriageInput {
  patientName: string;
  phone: string;
  tooth: string;
  calledAt: string;
  note: string;
}

interface Store {
  state: PersistState;
  addCall: (input: NewCallInput) => TriageCall;
  autoAssign: (callId: string) => ActionResult;
  manualAssign: (
    callId: string,
    chairId: string,
    date: string,
    startTime: string
  ) => ActionResult;
  reschedule: (
    callId: string,
    toChairId: string,
    toDate: string,
    toStartTime: string,
    reason: string,
    operator: string
  ) => ActionResult;
  confirmSeen: (callId: string, treatment: Omit<ActualTreatment, "treatedAt">) => ActionResult;
  resetDemo: () => void;
}

const StoreContext = createContext<Store | null>(null);

function endTimeOf(date: string, startTime: string): string {
  const slot = daySlots(date).find((s) => s.startTime === startTime);
  return slot?.endTime ?? startTime;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistState>(() => loadState());
  const saveTimer = useRef<number | undefined>(undefined);

  // 每次变更写本机；防抖避免连续录入频繁写
  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveState(state);
    }, 150);
    return () => window.clearTimeout(saveTimer.current);
  }, [state]);

  const patchCall = useCallback(
    (prev: PersistState, callId: string, patch: Partial<TriageCall>) => {
      const ts = new Date().toISOString();
      return prev.calls.map((c) =>
        c.id === callId ? { ...c, ...patch, updatedAt: ts } : c
      );
    },
    []
  );

  const addCall = useCallback((input: NewCallInput): TriageCall => {
    const verdict = evaluate(input, input.calledAt);
    const id = uid("call");
    const ts = new Date().toISOString();
    const call: TriageCall = {
      id,
      patientName: input.patientName.trim(),
      phone: input.phone.trim(),
      tooth: input.tooth.trim(),
      calledAt: input.calledAt,
      painScore: input.painScore,
      painNature: input.painNature,
      nightPain: input.nightPain,
      swelling: input.swelling,
      fever: input.fever,
      postOpDays: input.postOpDays,
      note: input.note.trim(),
      urgency: verdict.urgency,
      advice: verdict.advice,
      deadline: verdict.deadline,
      status: "triaged",
      createdAt: ts,
      updatedAt: ts,
    };

    setState((prev) => {
      let calls = [...prev.calls, call];
      let bookings = prev.bookings;

      // 当天需处理的急救：立即进入急救待排，尝试占一个椅位时段
      if (verdict.urgency === "emergency") {
        const pick = autoPickSlot(prev.bookings, verdict.deadline);
        if (pick.ok && pick.chairId && pick.startTime) {
          const booking: ChairBooking = {
            id: uid("bk"),
            callId: id,
            chairId: pick.chairId,
            date: pick.date,
            startTime: pick.startTime,
            endTime: pick.endTime!,
            status: "pending",
            createdAt: ts,
          };
          bookings = [...bookings, booking];
          calls = calls.map((c) =>
            c.id === id
              ? {
                  ...c,
                  status: "booked",
                  bookingId: booking.id,
                  conflictNote: undefined,
                }
              : c
          );
        } else {
          calls = calls.map((c) =>
            c.id === id
              ? { ...c, status: "waiting", conflictNote: pick.conflict }
              : c
          );
        }
      }
      return { ...prev, calls, bookings };
    });

    return call;
  }, []);

  const autoAssign = useCallback(
    (callId: string): ActionResult => {
      const call = state.calls.find((c) => c.id === callId);
      if (!call) return { ok: false, message: "记录不存在" };
      if (call.status === "completed")
        return { ok: false, message: "已完成接诊，无需再排" };
      if (call.bookingId) {
        const b = state.bookings.find((x) => x.id === call.bookingId);
        if (b && b.status === "pending")
          return { ok: false, message: "已有有效椅位预约，请用改约" };
      }

      const pick = autoPickSlot(state.bookings, call.deadline);
      if (!pick.ok || !pick.chairId || !pick.startTime) {
        setState((prev) => ({
          ...prev,
          calls: patchCall(prev, callId, {
            status: "waiting",
            conflictNote: pick.conflict,
          }),
        }));
        return { ok: false, message: pick.conflict ?? "排不进，已留在等待区" };
      }

      const booking: ChairBooking = {
        id: uid("bk"),
        callId,
        chairId: pick.chairId,
        date: pick.date,
        startTime: pick.startTime,
        endTime: pick.endTime!,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        bookings: [...prev.bookings, booking],
        calls: patchCall(prev, callId, {
          status: "booked",
          bookingId: booking.id,
          conflictNote: undefined,
        }),
      }));
      return {
        ok: true,
        message: `已排入 ${pick.date} ${pick.startTime}（${pick.chairId}）`,
      };
    },
    [state, patchCall]
  );

  const manualAssign = useCallback(
    (callId: string, chairId: string, date: string, startTime: string) => {
      const call = state.calls.find((c) => c.id === callId);
      if (!call) return { ok: false, message: "记录不存在" };
      const conflictMsg = describeManualConflict(
        state.bookings,
        call,
        chairId,
        date,
        startTime
      );
      if (conflictMsg) {
        setState((prev) => ({
          ...prev,
          calls: patchCall(prev, callId, {
            status: "waiting",
            conflictNote: conflictMsg,
          }),
        }));
        return { ok: false, message: conflictMsg };
      }
      const booking: ChairBooking = {
        id: uid("bk"),
        callId,
        chairId,
        date,
        startTime,
        endTime: endTimeOf(date, startTime),
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        bookings: [...prev.bookings, booking],
        calls: patchCall(prev, callId, {
          status: "booked",
          bookingId: booking.id,
          conflictNote: undefined,
        }),
      }));
      return { ok: true, message: `已指定 ${date} ${startTime}（${chairId}）` };
    },
    [state, patchCall]
  );

  const reschedule = useCallback(
    (
      callId: string,
      toChairId: string,
      toDate: string,
      toStartTime: string,
      reason: string,
      operator: string
    ): ActionResult => {
      const call = state.calls.find((c) => c.id === callId);
      if (!call?.bookingId)
        return { ok: false, message: "没有可改约的原预约" };
      const old = state.bookings.find((b) => b.id === call.bookingId);
      if (!old || old.status !== "pending")
        return { ok: false, message: "原预约不是待接诊状态" };
      if (!reason.trim())
        return { ok: false, message: "请填写改约原因（需留痕）" };

      const blocker = findConflict(
        state.bookings,
        toChairId,
        toDate,
        toStartTime
      );
      if (blocker)
        return {
          ok: false,
          message: `目标时段冲突：${toDate} ${toStartTime} 该椅位已有预约 ${blocker.id}`,
        };

      const ts = new Date().toISOString();
      const newBooking: ChairBooking = {
        id: uid("bk"),
        callId,
        chairId: toChairId,
        date: toDate,
        startTime: toStartTime,
        endTime: endTimeOf(toDate, toStartTime),
        status: "pending",
        rescheduleOf: old.id,
        rescheduleReason: reason.trim(),
        createdAt: ts,
      };
      const log = {
        id: uid("rs"),
        fromDate: old.date,
        fromSlot: old.startTime,
        fromChairId: old.chairId,
        toDate,
        toSlot: toStartTime,
        toChairId,
        reason: reason.trim(),
        operator: operator.trim() || "前台",
        createdAt: ts,
      };

      setState((prev) => ({
        ...prev,
        bookings: [
          ...prev.bookings.map((b) =>
            b.id === old.id ? { ...b, status: "rescheduled" as const } : b
          ),
          newBooking,
        ],
        reschedules: [...prev.reschedules, log],
        calls: patchCall(prev, callId, {
          status: "booked",
          bookingId: newBooking.id,
          conflictNote: undefined,
        }),
      }));
      return {
        ok: true,
        message: `已改约：${old.date} ${old.startTime} → ${toDate} ${toStartTime}，原时段与原因已留存`,
      };
    },
    [state, patchCall]
  );

  const confirmSeen = useCallback(
    (callId: string, treatment: Omit<ActualTreatment, "treatedAt">) => {
      const call = state.calls.find((c) => c.id === callId);
      if (!call) return { ok: false, message: "记录不存在" };
      if (!treatment.doctor.trim())
        return { ok: false, message: "请填写接诊医生" };
      if (!treatment.procedure.trim())
        return { ok: false, message: "请填写实际处理项目" };

      const ts = new Date().toISOString();
      const record: ActualTreatment = { ...treatment, treatedAt: ts };
      setState((prev) => ({
        ...prev,
        bookings: prev.bookings.map((b) =>
          b.id === call.bookingId && b.status === "pending"
            ? { ...b, status: "seen" as const }
            : b
        ),
        calls: prev.calls.map((c) =>
          c.id === callId
            ? {
                ...c,
                status: "completed" as const,
                history: [...(c.history ?? []), record],
                updatedAt: ts,
              }
            : c
        ),
      }));
      return { ok: true, message: "已登记接诊与实际处理" };
    },
    []
  );

  const resetDemo = useCallback(() => {
    setState(clearState());
  }, []);

  const value = useMemo<Store>(
    () => ({
      state,
      addCall,
      autoAssign,
      manualAssign,
      reschedule,
      confirmSeen,
      resetDemo,
    }),
    [state, addCall, autoAssign, manualAssign, reschedule, confirmSeen, resetDemo]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore 必须在 StoreProvider 内使用");
  return ctx;
}
