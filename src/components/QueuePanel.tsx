// 页面层：分诊队列（按紧急级分页签）+ 急救等待区（排不上的留在这里并写清冲突）

import { useMemo, useState } from "react";
import type { TriageCall, Urgency } from "../triage/types";
import { URGENCY_LABEL, URGENCY_ORDER } from "../triage/triageRules";
import { useStore } from "../triage/store";
import CallCard from "./CallCard";

type ModalKind = "assign" | "reschedule" | "treat";

interface Props {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAction: (call: TriageCall, kind: ModalKind) => void;
  notice: (msg: string, ok: boolean) => void;
}

export default function QueuePanel({ selectedId, onSelect, onAction, notice }: Props) {
  const { state, autoAssign } = useStore();
  const [tab, setTab] = useState<Urgency>("emergency");

  const active = useMemo(
    () =>
      state.calls
        .filter((c) => c.status !== "completed")
        .sort(
          (a, b) =>
            URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency] ||
            new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
        ),
    [state.calls]
  );

  const waiting = active.filter((c) => c.status === "waiting");
  const queued = active.filter(
    (c) => c.status !== "waiting" && c.urgency === tab
  );
  const counts: Record<Urgency, number> = {
    emergency: active.filter((c) => c.urgency === "emergency" && c.status !== "waiting").length,
    urgent: active.filter((c) => c.urgency === "urgent" && c.status !== "waiting").length,
    routine: active.filter((c) => c.urgency === "routine" && c.status !== "waiting").length,
  };

  const doAuto = (id: string) => {
    const r = autoAssign(id);
    notice(r.message, r.ok);
  };

  return (
    <div className="queue-layout">
      <section className="panel queue-panel">
        <div className="section-heading">
          <div>
            <p>分诊队列</p>
            <h2>复诊待办</h2>
          </div>
        </div>
        <div className="tabs">
          {(Object.keys(URGENCY_LABEL) as Urgency[]).map((u) => (
            <button
              key={u}
              className={tab === u ? `tab active tab-${u}` : `tab tab-${u}`}
              onClick={() => setTab(u)}
            >
              {URGENCY_LABEL[u]} <em>{counts[u]}</em>
            </button>
          ))}
        </div>
        <div className="card-list">
          {queued.length === 0 && <p className="empty">暂无{URGENCY_LABEL[tab]}患者</p>}
          {queued.map((call) => (
            <CallCard
              key={call.id}
              call={call}
              selected={selectedId === call.id}
              onSelect={(id) => onSelect(selectedId === id ? null : id)}
              footer={
                <>
                  {call.status === "triaged" && (
                    <>
                      <button className="primary-action" onClick={() => doAuto(call.id)}>自动派位</button>
                      <button onClick={() => onAction(call, "assign")}>手动安排</button>
                    </>
                  )}
                  {call.status === "booked" && (
                    <>
                      <button className="primary-action" onClick={() => onAction(call, "treat")}>医生接诊</button>
                      <button onClick={() => onAction(call, "reschedule")}>改约</button>
                    </>
                  )}
                </>
              }
            />
          ))}
        </div>
      </section>

      <section className="panel waiting-panel">
        <div className="section-heading">
          <div>
            <p className="danger-text">急救待排 · 等待区</p>
            <h2>等待区 {waiting.length > 0 && <em className="count-pill">{waiting.length}</em>}</h2>
          </div>
        </div>
        <p className="panel-hint">同一牙椅同一时段只留一人；系统排不进的患者留在此处并写清冲突，由前台协调加台或改期。</p>
        <div className="card-list">
          {waiting.length === 0 && <p className="empty">等待区暂无患者</p>}
          {waiting
            .slice()
            .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
            .map((call) => (
              <CallCard
                key={call.id}
                call={call}
                selected={selectedId === call.id}
                onSelect={(id) => onSelect(selectedId === id ? null : id)}
                footer={
                  <>
                    <button className="primary-action" onClick={() => doAuto(call.id)}>再试自动派位</button>
                    <button onClick={() => onAction(call, "assign")}>手动加台</button>
                  </>
                }
              />
            ))}
        </div>
      </section>
    </div>
  );
}
