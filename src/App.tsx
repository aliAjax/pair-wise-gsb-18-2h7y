// 页面层：电话分诊工作台总装。资料(types/time/storage)、判断(triageRules/scheduleRules)、
// 本机保存(storage)与本目录页面组件分开维护；关掉页面后由 localStorage 接着排

import { useMemo, useState } from "react";
import "./styles.css";
import { StoreProvider, useStore } from "./triage/store";
import type { TriageCall } from "./triage/types";
import { isOverdue } from "./triage/triageRules";
import { formatDateTime } from "./triage/time";
import TriageIntake from "./components/TriageIntake";
import QueuePanel from "./components/QueuePanel";
import ChairBoard from "./components/ChairBoard";
import RecordsPanel from "./components/RecordsPanel";
import { AssignModal, RescheduleModal, TreatmentModal } from "./components/Modals";

type ModalKind = "assign" | "reschedule" | "treat";

function TriageWorkbench() {
  const { state, resetDemo } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ kind: ModalKind; callId: string } | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const selectedCall = useMemo(
    () => state.calls.find((c) => c.id === selectedId) ?? null,
    [state.calls, selectedId]
  );
  const modalCall = useMemo(
    () => (modal ? state.calls.find((c) => c.id === modal.callId) ?? null : null),
    [state.calls, modal]
  );

  const notice = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    window.setTimeout(() => setToast(null), 3200);
  };

  const openAction = (call: TriageCall, kind: ModalKind) => {
    setSelectedId(call.id);
    setModal({ kind, callId: call.id });
  };

  const stats = useMemo(() => {
    const active = state.calls.filter((c) => c.status !== "completed");
    const booked = state.bookings.filter((b) => b.status === "pending").length;
    const overdue = active.filter((c) => isOverdue(c)).length;
    return [
      { label: "待处理来电", value: active.length, tone: "ok" },
      { label: "急救待排（等待区）", value: active.filter((c) => c.status === "waiting").length, tone: "danger" },
      { label: "已占椅位时段", value: booked, tone: "watch" },
      { label: "超时未处理", value: overdue, tone: overdue > 0 ? "danger" : "ok" },
      { label: "累计已接诊", value: state.calls.filter((c) => c.status === "completed").length, tone: "ok" },
    ];
  }, [state]);

  return (
    <main className="app-shell triage-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-04 · 牙体牙髓 · 电话分诊</p>
          <h1>根管术后夜间来电分诊台</h1>
          <p className="subtitle">
            登记患者、牙位、来电时刻、疼痛分值与夜间痛；系统按症状给复诊时限，
            当天需处理的进急救待排，同一牙椅同一时段只留一人，排不上留在等待区并写清冲突。
          </p>
        </div>
        <div className="stack-card">
          <span>本机自动保存</span>
          <strong>最近保存 {formatDateTime(state.savedAt)}</strong>
          <p className="save-note">资料存在本机浏览器，关掉页面后仍能接着排；不上传服务器。</p>
          <button className="reset-btn" onClick={resetDemo}>重置为演示数据</button>
        </div>
      </section>

      <section className="metrics-grid metrics-5">
        {stats.map((s) => (
          <article key={s.label} className="metric-card">
            <span>{s.label}</span>
            <strong>{s.value}</strong>
            <i className={`status-${s.tone}`} />
          </article>
        ))}
      </section>

      <TriageIntake onRegistered={(id) => { setSelectedId(id); notice("已登记并完成分诊", true); }} />

      <QueuePanel
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAction={openAction}
        notice={notice}
      />

      <ChairBoard
        selectedCall={selectedCall}
        onAction={openAction}
        notice={notice}
      />

      <RecordsPanel />

      <footer className="page-foot">
        分层：资料（types / time / storage 初始数据）· 判断（triageRules / scheduleRules）·
        本机保存（localStorage）· 页面（components）。判断规则与页面解耦，可独立核对调整。
      </footer>

      {modal && modalCall && modal.kind === "assign" && (
        <AssignModal
          call={modalCall}
          onClose={() => setModal(null)}
          onDone={(r) => { setModal(null); notice(r.message, r.ok); }}
        />
      )}
      {modal && modalCall && modal.kind === "reschedule" && (
        <RescheduleModal
          call={modalCall}
          onClose={() => setModal(null)}
          onDone={(r) => { setModal(null); notice(r.message, r.ok); }}
        />
      )}
      {modal && modalCall && modal.kind === "treat" && (
        <TreatmentModal
          call={modalCall}
          onClose={() => setModal(null)}
          onDone={(r) => { setModal(null); notice(r.message, r.ok); }}
        />
      )}

      {toast && (
        <div className={`toast ${toast.ok ? "ok" : "err"}`}>{toast.msg}</div>
      )}
    </main>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <TriageWorkbench />
    </StoreProvider>
  );
}
