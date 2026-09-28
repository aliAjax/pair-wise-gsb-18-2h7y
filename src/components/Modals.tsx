// 页面层：椅位操作弹窗——手动指位、改约（留原时段+原因）、医生接诊登记实际处理

import { useMemo, useState } from "react";
import type { TriageCall } from "../triage/types";
import { useStore } from "../triage/store";
import {
  CHAIRS,
  chairName,
  daySlots,
  formatDateTime,
  nowLocal,
} from "../triage/time";
import { findConflict, isActive } from "../triage/scheduleRules";
import { UrgencyBadge } from "./ui";

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">×</button>
        </header>
        {children}
      </div>
    </div>
  );
}

interface CallModalProps {
  call: TriageCall;
  onClose: () => void;
  onDone: (result: { ok: boolean; message: string }) => void;
}

/** 手动指定牙椅与时段（急救自动派不上时人工加台） */
export function AssignModal({ call, onClose, onDone }: CallModalProps) {
  const { state, manualAssign } = useStore();
  const [chairId, setChairId] = useState(CHAIRS[0].id);
  const [date, setDate] = useState(nowLocal().date);
  const [startTime, setStartTime] = useState(daySlots(nowLocal().date)[0].startTime);
  const slots = useMemo(() => daySlots(date), [date]);
  const conflict = findConflict(state.bookings, chairId, date, startTime);

  return (
    <ModalShell title={`手动安排椅位 · ${call.patientName} #${call.tooth}`} onClose={onClose}>
      <div className="modal-body">
        <p className="modal-advice"><UrgencyBadge urgency={call.urgency} /> 复诊时限 {formatDateTime(call.deadline)}</p>
        <div className="field-grid">
          <label>
            <span>日期</span>
            <input type="date" value={date} onChange={(e) => {
              setDate(e.target.value);
              setStartTime(daySlots(e.target.value)[0].startTime);
            }} />
          </label>
          <label>
            <span>牙椅</span>
            <select value={chairId} onChange={(e) => setChairId(e.target.value)}>
              {CHAIRS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="span2">
            <span>时段（30 分钟）</span>
            <select value={startTime} onChange={(e) => setStartTime(e.target.value)}>
              {slots.map((s) => {
                const busy = findConflict(state.bookings, chairId, date, s.startTime);
                return (
                  <option key={s.startTime} value={s.startTime} disabled={Boolean(busy)}>
                    {s.startTime}–{s.endTime}{busy ? "（已占）" : ""}
                  </option>
                );
              })}
            </select>
          </label>
        </div>
        {conflict && (
          <p className="form-error">
            该时段冲突：已被预约 {conflict.id} 占用，同一牙椅同一时段只留一人。
          </p>
        )}
      </div>
      <footer>
        <button onClick={onClose}>取消</button>
        <button
          className="primary-action"
          disabled={Boolean(conflict)}
          onClick={() => onDone(manualAssign(call.id, chairId, date, startTime))}
        >
          确认排入
        </button>
      </footer>
    </ModalShell>
  );
}

/** 改约：必须保留原时段并填写原因 */
export function RescheduleModal({ call, onClose, onDone }: CallModalProps) {
  const { state, reschedule } = useStore();
  const old = state.bookings.find((b) => b.id === call.bookingId);
  const [toChairId, setToChairId] = useState(old?.chairId ?? CHAIRS[0].id);
  const [toDate, setToDate] = useState(old?.date ?? nowLocal().date);
  const [toStartTime, setToStartTime] = useState(
    old ? shiftOne(old.date, old.startTime) : daySlots(nowLocal().date)[0].startTime
  );
  const [reason, setReason] = useState("");
  const [operator, setOperator] = useState("");
  const [err, setErr] = useState("");

  if (!old) return null;
  const slots = daySlots(toDate);
  const blocker = state.bookings.find(
    (b) => isActive(b) && b.chairId === toChairId && b.date === toDate && b.startTime === toStartTime
  );

  const submit = () => {
    const r = reschedule(call.id, toChairId, toDate, toStartTime, reason, operator);
    if (!r.ok) setErr(r.message);
    else onDone(r);
  };

  return (
    <ModalShell title={`改约 · ${call.patientName} #${call.tooth}`} onClose={onClose}>
      <div className="modal-body">
        <div className="old-slot">
          <span>原时段（保留留痕）</span>
          <strong>{old.date} {old.startTime} · {chairName(old.chairId)}</strong>
        </div>
        <div className="field-grid">
          <label>
            <span>改约日期</span>
            <input type="date" value={toDate} onChange={(e) => {
              setToDate(e.target.value);
              setToStartTime(daySlots(e.target.value)[0].startTime);
            }} />
          </label>
          <label>
            <span>牙椅</span>
            <select value={toChairId} onChange={(e) => setToChairId(e.target.value)}>
              {CHAIRS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="span2">
            <span>新时段</span>
            <select value={toStartTime} onChange={(e) => setToStartTime(e.target.value)}>
              {slots.map((s) => {
                const busy = state.bookings.find(
                  (b) => isActive(b) && b.chairId === toChairId && b.date === toDate && b.startTime === s.startTime
                );
                return (
                  <option key={s.startTime} value={s.startTime} disabled={Boolean(busy)}>
                    {s.startTime}–{s.endTime}{busy ? "（已占）" : ""}
                  </option>
                );
              })}
            </select>
          </label>
          <label className="span2">
            <span>改约原因 *</span>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="如：患者夜间肿胀加重要求提前 / 医生手术延时 / 椅位故障…"
            />
          </label>
          <label>
            <span>经办人</span>
            <input value={operator} onChange={(e) => setOperator(e.target.value)} placeholder="前台姓名" />
          </label>
        </div>
        {blocker && <p className="form-error">目标时段已有预约 {blocker.id}，请换一个空闲时段。</p>}
        {err && <p className="form-error">{err}</p>}
      </div>
      <footer>
        <button onClick={onClose}>取消</button>
        <button className="primary-action" onClick={submit}>确认改约</button>
      </footer>
    </ModalShell>
  );
}

function shiftOne(date: string, hm: string): string {
  const list = daySlots(date).map((s) => s.startTime);
  const i = list.indexOf(hm);
  return list[i + 1] ?? list[0];
}

/** 医生确认接诊：登记实际处理 */
export function TreatmentModal({ call, onClose, onDone }: CallModalProps) {
  const { confirmSeen } = useStore();
  const [doctor, setDoctor] = useState("");
  const [procedure, setProcedure] = useState("调合 + 冲洗换药");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  const presets = ["调合（降低咬合高点）", "去除暂封、冲洗换药", "根管再处理", "开放引流", "检查后宣教观察"];

  const submit = () => {
    const r = confirmSeen(call.id, {
      doctor,
      procedure,
      note,
    });
    if (!r.ok) setErr(r.message);
    else onDone(r);
  };

  return (
    <ModalShell title={`医生接诊 · ${call.patientName} #${call.tooth}`} onClose={onClose}>
      <div className="modal-body">
        <div className="preset-row">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              className={procedure === p ? "preset active" : "preset"}
              onClick={() => setProcedure(p)}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="field-grid">
          <label>
            <span>接诊医生 *</span>
            <input value={doctor} onChange={(e) => setDoctor(e.target.value)} placeholder="如：王医生" />
          </label>
          <label>
            <span>实际处理项目 *</span>
            <input value={procedure} onChange={(e) => setProcedure(e.target.value)} />
          </label>
          <label className="span2">
            <span>处理记录 / 医嘱</span>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="检查所见、用药、复诊安排…" />
          </label>
        </div>
        {err && <p className="form-error">{err}</p>}
      </div>
      <footer>
        <button onClick={onClose}>取消</button>
        <button className="primary-action" onClick={submit}>确认接诊并记录</button>
      </footer>
    </ModalShell>
  );
}
