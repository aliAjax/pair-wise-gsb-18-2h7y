import type { CallRecord } from "../triage/types";
import { deadlineCountdown, fmtTime, levelBadgeClass, statusBadgeClass } from "../triage/format";

interface Props {
  records: CallRecord[];
  onOpen: (id: string) => void;
  onRetry: (id: string) => string | null;
}

/** 急救待排：当天需处理且尚未完成的 A 级（含已排椅等待接诊与等待区中的） */
function getEmergencyQueue(records: CallRecord[]): CallRecord[] {
  return records
    .filter(
      (r) =>
        r.triage.level === "A" &&
        ["emergency", "scheduled", "waiting", "in_treatment"].includes(r.status)
    )
    .sort((a, b) => new Date(a.triage.deadline).getTime() - new Date(b.triage.deadline).getTime());
}

export function QueuePanel({ records, onOpen, onRetry }: Props) {
  const emergency = getEmergencyQueue(records);
  const waiting = records
    .filter((r) => r.status === "waiting")
    .sort((a, b) => new Date(a.triage.deadline).getTime() - new Date(b.triage.deadline).getTime());

  return (
    <div className="queue-stack">
      <section className="panel queue-panel emergency">
        <div className="section-heading">
          <div>
            <p>急救待排</p>
            <h2>当天需处理 · {emergency.length}</h2>
          </div>
        </div>
        {emergency.length === 0 && <p className="empty-hint">暂无当天急症来电</p>}
        <div className="queue-list">
          {emergency.map((r) => (
            <article key={r.id} className="queue-card" onClick={() => onOpen(r.id)}>
              <div className="queue-top">
                <span className={levelBadgeClass(r.triage.level)}>A 急症</span>
                <span className={statusBadgeClass(r.status)}>{statusText(r.status)}</span>
              </div>
              <h3>
                {r.patientName} · #{r.tooth}
              </h3>
              <p className="queue-line">
                来电 {fmtTime(r.calledAt)} · 疼痛 {r.painScore}/10
                {r.symptoms.nightPain ? " · 夜间痛" : ""}
                {r.symptoms.throbbing ? " · 跳痛" : ""}
              </p>
              <p className="queue-line strong">
                {r.assignment
                  ? `已排 ${r.assignment.chairName} ${r.assignment.date.slice(5)} ${r.assignment.time}`
                  : "未排入椅位"}
                <em>{deadlineCountdown(r.triage.deadline)}</em>
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel queue-panel waiting">
        <div className="section-heading">
          <div>
            <p>等待区</p>
            <h2>时限内排不上 · {waiting.length}</h2>
          </div>
        </div>
        {waiting.length === 0 && <p className="empty-hint">等待区为空，来电均已排入时段</p>}
        <div className="queue-list">
          {waiting.map((r) => (
            <article key={r.id} className="queue-card waiting-card" onClick={() => onOpen(r.id)}>
              <div className="queue-top">
                <span className={levelBadgeClass(r.triage.level)}>{r.triage.level} 级</span>
                <span className={statusBadgeClass("waiting")}>等待区</span>
              </div>
              <h3>
                {r.patientName} · #{r.tooth}
              </h3>
              <p className="conflict-text">{r.waitingReason}</p>
              <div className="waiting-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  className="mini primary"
                  onClick={() => {
                    const msg = onRetry(r.id);
                    if (msg) window.alert(msg);
                  }}
                >
                  释放椅位后重新排椅
                </button>
                <button className="mini" onClick={() => onOpen(r.id)}>
                  查看/手动选位
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function statusText(status: CallRecord["status"]): string {
  const map: Record<CallRecord["status"], string> = {
    emergency: "急救待排",
    pending: "待排",
    scheduled: "待接诊",
    waiting: "等待区",
    in_treatment: "接诊中",
    completed: "已处理",
    rescheduled: "已改约",
  };
  return map[status];
}
