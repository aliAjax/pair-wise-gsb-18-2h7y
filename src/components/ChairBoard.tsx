import { useMemo, useState } from "react";
import type { SlotCell } from "../triage/types";
import { CHAIRS, buildDayGrid } from "../triage/schedule";
import { addDays, todayKey, weekdayText } from "../triage/time";
import type { TriageStore } from "../triage/store";

interface Props {
  store: TriageStore;
  onOpen: (id: string) => void;
}

interface PendingBooking {
  date: string;
  time: string;
  chairId: string;
}

export function ChairBoard({ store, onOpen }: Props) {
  const today = todayKey();
  const days = useMemo(() => [0, 1, 2].map((d) => addDays(today, d)), [today]);
  const [dayIndex, setDayIndex] = useState(0);
  const date = days[dayIndex];
  const grid: SlotCell[][] = buildDayGrid(store.state.records, store.state.blockers, date);

  const [booking, setBooking] = useState<PendingBooking | null>(null);
  const [blockerLabel, setBlockerLabel] = useState("");

  // 可往空格里排的记录：待排/等待区，且该时段在复诊时限内
  const bookable = store.state.records
    .filter((r) => ["emergency", "pending", "waiting"].includes(r.status))
    .filter((r) => {
      const slot = new Date(`${booking?.date ?? date}T${booking?.time ?? "00:00"}:00`);
      return slot.getTime() <= new Date(r.triage.deadline).getTime();
    })
    .sort((a, b) => new Date(a.triage.deadline).getTime() - new Date(b.triage.deadline).getTime());

  const onCellClick = (cell: SlotCell) => {
    const occ = cell.occupant;
    if (!occ) {
      setBooking({ date: cell.date, time: cell.time, chairId: cell.chairId });
      setBlockerLabel("");
      return;
    }
    if (occ.kind === "call" && occ.callId) {
      onOpen(occ.callId);
      return;
    }
    if (window.confirm(`${occ.patientName} · ${occ.note ?? "既有门诊占用"}\n\n确定释放该时段？`)) {
      store.removeBlocker(occ.id);
    }
  };

  const assign = (callId: string) => {
    if (!booking) return;
    const err = store.assignSlot(callId, booking.chairId, booking.date, booking.time);
    if (err) window.alert(err);
    else setBooking(null);
  };

  const addBlocker = () => {
    if (!booking) return;
    store.addBlocker(booking.chairId, booking.date, booking.time, blockerLabel);
    setBooking(null);
  };

  return (
    <section className="panel board-panel">
      <div className="section-heading">
        <div>
          <p>椅位号表</p>
          <h2>同一牙椅同一时段只留一人</h2>
        </div>
        <div className="day-tabs">
          {days.map((key, i) => (
            <button
              key={key}
              className={i === dayIndex ? "tab on" : "tab"}
              onClick={() => {
                setDayIndex(i);
                setBooking(null);
              }}
            >
              {i === 0 ? "今天" : i === 1 ? "明天" : "后天"}
              <small>
                {key.slice(5)} {weekdayText(key)}
              </small>
            </button>
          ))}
        </div>
      </div>

      <div className="board-scroll">
        <table className="chair-grid">
          <thead>
            <tr>
              <th className="time-col">时段</th>
              {CHAIRS.map((chair) => (
                <th key={chair.id}>{chair.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row) => (
              <tr key={row[0].time}>
                <td className="time-col">{row[0].time}</td>
                {row.map((cell) => (
                  <td key={cell.chairId} className="cell-td">
                    <CellButton cell={cell} onClick={() => onCellClick(cell)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="board-legend">
        <span><i className="dot call" /> 分诊来电</span>
        <span><i className="dot blocker" /> 既有门诊占用（点击可释放）</span>
        <span><i className="dot free" /> 空闲（点击排入或登记占用）</span>
      </div>

      {booking && (
        <div className="modal-mask" onClick={() => setBooking(null)}>
          <div className="modal pop" onClick={(e) => e.stopPropagation()}>
            <h3>
              安排时段 · {CHAIRS.find((c) => c.id === booking.chairId)?.name} {booking.date}{" "}
              {booking.time}
            </h3>
            <p className="pop-sub">从待排/等待区选择患者，或登记为既有门诊占用</p>
            <div className="pop-list">
              {bookable.length === 0 && <p className="empty-hint">没有符合复诊时限的待排患者</p>}
              {bookable.map((r) => (
                <button key={r.id} className="pop-item" onClick={() => assign(r.id)}>
                  <span className={`lv lv-${r.triage.level.toLowerCase()}`}>{r.triage.level}</span>
                  <span className="pop-name">
                    {r.patientName} · #{r.tooth}
                  </span>
                  <span className="pop-meta">
                    疼痛{r.painScore}/10 · 截止 {r.triage.deadlineText}
                  </span>
                </button>
              ))}
            </div>
            <div className="pop-blocker">
              <input
                value={blockerLabel}
                onChange={(e) => setBlockerLabel(e.target.value)}
                placeholder="或登记为既有占用，如：复查·王医生"
              />
              <button onClick={addBlocker}>登记占用</button>
            </div>
            <button className="pop-cancel" onClick={() => setBooking(null)}>
              取消
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function CellButton({ cell, onClick }: { cell: SlotCell; onClick: () => void }) {
  const occ = cell.occupant;
  if (!occ) {
    return (
      <button className="cell free" onClick={onClick}>
        <span className="cell-plus">＋</span>
        <span className="cell-free-text">空闲</span>
      </button>
    );
  }
  if (occ.kind === "call") {
    return (
      <button className="cell call" onClick={onClick}>
        <strong>
          {occ.patientName} #{occ.tooth}
        </strong>
        <small>{occ.note}</small>
      </button>
    );
  }
  return (
    <button className="cell blocker" onClick={onClick}>
      <strong>{occ.patientName}</strong>
      <small>{occ.note}</small>
    </button>
  );
}
