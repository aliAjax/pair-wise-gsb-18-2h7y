// 页面层：牙椅时段看板。同一牙椅同一槽位只显示一人；点击格位触发安排/改约/接诊

import { useMemo, useState } from "react";
import type { ChairBooking, TriageCall } from "../triage/types";
import { useStore } from "../triage/store";
import { CHAIRS, chairName, daySlots, nowLocal } from "../triage/time";
import { isActive } from "../triage/scheduleRules";
import { UrgencyBadge } from "./ui";

type ModalKind = "assign" | "reschedule" | "treat";

interface Props {
  selectedCall: TriageCall | null;
  onAction: (call: TriageCall, kind: ModalKind) => void;
  notice: (msg: string, ok: boolean) => void;
}

export default function ChairBoard({ selectedCall, onAction, notice }: Props) {
  const { state, manualAssign } = useStore();
  const [date, setDate] = useState(nowLocal().date);
  const slots = useMemo(() => daySlots(date), [date]);

  const callById = useMemo(() => {
    const m = new Map<string, TriageCall>();
    state.calls.forEach((c) => m.set(c.id, c));
    return m;
  }, [state.calls]);

  const bookingAt = (chairId: string, startTime: string): ChairBooking | undefined =>
    state.bookings.find(
      (b) => b.date === date && b.chairId === chairId && b.startTime === startTime
    );

  const clickEmpty = (chairId: string, startTime: string) => {
    if (!selectedCall) {
      notice("请先在左侧队列点选一名患者，再点空椅位安排。", false);
      return;
    }
    if (selectedCall.status === "completed") {
      notice("该患者已接诊完成。", false);
      return;
    }
    const r = manualAssign(selectedCall.id, chairId, date, startTime);
    notice(r.message, r.ok);
  };

  return (
    <section className="panel chair-board">
      <div className="section-heading">
        <div>
          <p>椅位看板</p>
          <h2>当日牙椅时段</h2>
        </div>
        <label className="date-picker">
          <span>日期</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>

      {selectedCall && (
        <div className="select-bar">
          已选中：<strong>{selectedCall.patientName} #{selectedCall.tooth}</strong>
          <UrgencyBadge urgency={selectedCall.urgency} />
          <span className="hint">点击下方空白格位可直接排入（冲突时段不可选）</span>
        </div>
      )}

      <div className="chair-table-wrap">
        <table className="chair-table">
          <thead>
            <tr>
              <th className="time-col">时段</th>
              {CHAIRS.map((c) => <th key={c.id}>{c.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {slots.map((slot) => (
              <tr key={slot.startTime}>
                <td className="time-col">
                  <strong>{slot.startTime}</strong>
                  <span>{slot.endTime}</span>
                </td>
                {CHAIRS.map((chair) => {
                  const b = bookingAt(chair.id, slot.startTime);
                  if (!b) {
                    return (
                      <td key={chair.id}>
                        <button className="slot-empty" onClick={() => clickEmpty(chair.id, slot.startTime)}>
                          ＋ 空
                        </button>
                      </td>
                    );
                  }
                  const call = callById.get(b.callId);
                  return (
                    <td key={chair.id}>
                      <BookingCell
                        booking={b}
                        call={call}
                        onTreat={() => call && onAction(call, "treat")}
                        onReschedule={() => call && onAction(call, "reschedule")}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BookingCell({
  booking,
  call,
  onTreat,
  onReschedule,
}: {
  booking: ChairBooking;
  call?: TriageCall;
  onTreat: () => void;
  onReschedule: () => void;
}) {
  const active = isActive(booking);
  return (
    <div className={`slot-cell status-${booking.status} ${active ? "" : "dim"}`}>
      {call ? (
        <>
          <div className="slot-title">
            <strong>#{call.tooth} {call.patientName}</strong>
            <em>{call.painScore}/10</em>
          </div>
          <div className="slot-tags">
            <span className={`dot urgency-${call.urgency}`} />
            {call.nightPain && <span>夜间痛</span>}
          </div>
          {booking.rescheduleReason && (
            <p className="slot-reason" title={booking.rescheduleReason}>改约：{booking.rescheduleReason}</p>
          )}
          {active ? (
            <div className="slot-actions">
              <button className="mini primary" onClick={onTreat}>接诊</button>
              <button className="mini" onClick={onReschedule}>改约</button>
            </div>
          ) : (
            <p className="slot-status">
              {booking.status === "seen" ? "已接诊" : booking.status === "rescheduled" ? `已改约（原 ${chairName(booking.chairId)}）` : "作废"}
            </p>
          )}
        </>
      ) : (
        <span className="slot-title">预约 {booking.id}</span>
      )}
    </div>
  );
}
