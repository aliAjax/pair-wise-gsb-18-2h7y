import { useMemo, useState } from "react";
import "./styles.css";
import { CallForm } from "./components/CallForm";
import { QueuePanel } from "./components/QueuePanel";
import { ChairBoard } from "./components/ChairBoard";
import { RecordModal } from "./components/RecordModal";
import { RecordsList } from "./components/RecordsList";
import { useTriageStore } from "./triage/store";
import { fmtTime } from "./triage/format";

function App() {
  const store = useTriageStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string>("");

  const openRecord = useMemo(
    () =>
      store.state.records.find((r) => r.id === openId) ??
      null,
    [store.state.records, openId]
  );

  const notify = (text: string) => {
    setFlash(text);
    window.setTimeout(() => setFlash(""), 4000);
  };

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">根管术后电话分诊 · 本机保存</p>
          <h1>根管治疗后来电分诊与急救待排</h1>
          <p className="subtitle">
            登记患者、牙位、来电时刻、疼痛分值与夜间痛；系统按症状给出复诊时限，
            当天需处理的进入急救待排，同一牙椅同一时段只留一人，排不上写入等待区并记清冲突。
            数据只保存在本机浏览器，关掉页面后仍能接着排。
          </p>
        </div>
        <div className="stack-card">
          <span>今日概览 · {new Date().toLocaleDateString("zh-CN")}</span>
          <div className="hero-metrics">
            <div className="hero-metric danger">
              <strong>{store.summary.emergency}</strong>
              <span>急救待排</span>
            </div>
            <div className="hero-metric warn">
              <strong>{store.summary.waiting}</strong>
              <span>等待区</span>
            </div>
            <div className="hero-metric">
              <strong>{store.summary.scheduled}</strong>
              <span>待接诊</span>
            </div>
            <div className="hero-metric">
              <strong>{store.summary.inTreatment}</strong>
              <span>接诊中</span>
            </div>
            <div className="hero-metric ok">
              <strong>{store.summary.completed}</strong>
              <span>已处理</span>
            </div>
          </div>
        </div>
      </section>

      <div className="triage-layout">
        <CallForm
          onSubmit={(input) => {
            const created = store.registerCall(input);
            if (created.status === "waiting") {
              notify(`已登记：复诊时限内无空闲椅位，已进入等待区并写清冲突`);
            } else if (created.assignment) {
              notify(
                `已登记并自动排入 ${created.assignment.chairName} ${created.assignment.date.slice(5)} ${created.assignment.time}`
              );
            }
          }}
        />
        <QueuePanel records={store.state.records} onOpen={setOpenId} onRetry={store.retryAutoAssign} />
      </div>

      <ChairBoard store={store} onOpen={setOpenId} />

      <RecordsList records={store.state.records} onOpen={setOpenId} />

      <footer className="page-foot">
        <span>
          资料、分诊判断、本机保存与页面分层组织（src/triage：types / rules / schedule / storage /
          store；src/components：页面）
        </span>
        <div className="foot-right">
          <span className="save-hint">
            本机已保存 · 最近更新 {store.state.records[0] ? fmtTime(store.state.records[0].updatedAt) : "—"}
          </span>
          <button
            className="ghost-btn"
            onClick={() => {
              if (window.confirm("恢复为演示数据？当前本机记录将被覆盖。")) store.resetDemo();
            }}
          >
            恢复演示数据
          </button>
        </div>
      </footer>

      {openRecord && (
        <RecordModal record={openRecord} store={store} onClose={() => setOpenId(null)} />
      )}

      {flash && <div className="flash-toast">{flash}</div>}
    </main>
  );
}

export default App;
