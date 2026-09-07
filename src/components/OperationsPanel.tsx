import { useState } from "react";
import { Plus, X, ClipboardCheck, Truck, Wallet } from "lucide-react";
import {
  budgetSummary,
  checklists,
  emptyOperations,
  resourceNames,
  type Operations,
} from "../operations";
export default function OperationsPanel({
  value,
  onChange,
}: {
  value?: Operations;
  onChange: (o: Operations) => void;
}) {
  const ops = value ?? emptyOperations(),
    [task, setTask] = useState(""),
    [preset, setPreset] = useState<keyof typeof checklists>("Infantry");
  const summary = budgetSummary(ops.budget);
  const update = (patch: Partial<Operations>) => onChange({ ...ops, ...patch });
  return (
    <div className="operations-panel">
      <section>
        <div className="section-heading">
          <h2>Squad briefing</h2>
          <ClipboardCheck size={16} />
        </div>
        <label htmlFor="briefing">Objective, roles and fallback</label>
        <textarea
          id="briefing"
          placeholder="Hold the bridge. Alpha covers the west approach…"
          value={ops.briefing}
          maxLength={2000}
          onChange={(e) => update({ briefing: e.target.value })}
        />
        <small>Saved with this plan · {ops.briefing.length}/2000</small>
      </section>
      <section className="checklist">
        <div className="section-heading">
          <h2>Pre-deployment checklist</h2>
          <span>
            {ops.tasks.filter((t) => t.done).length}/{ops.tasks.length}
          </span>
        </div>
        <div className="checklist-template">
          <select
            aria-label="Checklist template"
            value={preset}
            onChange={(e) =>
              setPreset(e.target.value as keyof typeof checklists)
            }
          >
            {Object.keys(checklists).map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() =>
              update({
                tasks: checklists[preset].map((text) => ({
                  id: crypto.randomUUID(),
                  text,
                  done: false,
                })),
              })
            }
          >
            {ops.tasks.length ? "Replace" : "Use template"}
          </button>
        </div>
        <ol>
          {ops.tasks.map((t) => (
            <li key={t.id}>
              <label>
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={(e) =>
                    update({
                      tasks: ops.tasks.map((x) =>
                        x.id === t.id ? { ...x, done: e.target.checked } : x,
                      ),
                    })
                  }
                />
                <span className={t.done ? "completed" : ""}>{t.text}</span>
              </label>
              <button
                type="button"
                aria-label={`Remove ${t.text}`}
                title="Remove checklist item"
                onClick={() =>
                  update({ tasks: ops.tasks.filter((x) => x.id !== t.id) })
                }
              >
                <X size={13} />
              </button>
            </li>
          ))}
        </ol>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!task.trim() || ops.tasks.length >= 30) return;
            update({
              tasks: [
                ...ops.tasks,
                { id: crypto.randomUUID(), text: task.trim(), done: false },
              ],
            });
            setTask("");
          }}
        >
          <input
            aria-label="Checklist item"
            placeholder="Add a squad task"
            value={task}
            maxLength={160}
            onChange={(e) => setTask(e.target.value)}
          />
          <button
            type="submit"
            aria-label="Add checklist item"
            disabled={!task.trim() || ops.tasks.length >= 30}
          >
            <Plus size={17} />
          </button>
        </form>
      </section>
      <section className="supply-plan">
        <div className="section-heading">
          <h2>Supply run</h2>
          <Truck size={16} />
        </div>
        <p>
          Enter resource units requested by the FOB and what you have packed.
          These are manual counts, not live stock.
        </p>
        <div className="supply-table">
          <div className="supply-head">
            <span>Resource</span>
            <span>Requested</span>
            <span>Packed</span>
            <span>Short</span>
          </div>
          {resourceNames.map((name) => (
            <div className="supply-row" key={name}>
              <span>{name}</span>
              {(["required", "packed"] as const).map((field) => (
                <input
                  key={field}
                  type="number"
                  title="Resource units"
                  min={0}
                  max={1000000000}
                  aria-label={`${name} ${field === "required" ? "requested" : "packed"}`}
                  value={ops.supplies[name][field]}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n) && n >= 0 && n <= 1e9)
                      update({
                        supplies: {
                          ...ops.supplies,
                          [name]: { ...ops.supplies[name], [field]: n },
                        },
                      });
                  }}
                />
              ))}
              <strong
                className={
                  ops.supplies[name].required > ops.supplies[name].packed
                    ? "short"
                    : ""
                }
              >
                {Math.max(
                  0,
                  ops.supplies[name].required - ops.supplies[name].packed,
                ).toLocaleString()}
              </strong>
            </div>
          ))}
        </div>
      </section>
      <section className="budget-plan">
        <div className="section-heading">
          <h2>Deployment budget</h2>
          <Wallet size={16} />
        </div>
        <p>
          Use current in-game prices. Earnings, salvage and revives are
          excluded.
        </p>
        <div className="budget-fields">
          {(
            [
              { id: "cash", label: "Available cash" },
              { id: "reserve", label: "Keep in reserve" },
              { id: "kit", label: "Kit cost per life" },
              { id: "transport", label: "Transport (once)" },
            ] as const
          ).map((f) => (
            <label key={f.id}>
              {f.label}
              <input
                type="number"
                min={0}
                max={1000000000}
                value={ops.budget[f.id]}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n >= 0 && n <= 1e9)
                    update({ budget: { ...ops.budget, [f.id]: n } });
                }}
              />
            </label>
          ))}
        </div>
        {summary.deployments === null ? (
          <p>Enter a kit cost to calculate how many lives you can fund.</p>
        ) : (
          <div className="budget-result">
            <span>
              Funded deployments<strong>{summary.deployments}</strong>
            </span>
            <span>
              Cash after first deployment
              <strong>${summary.after.toLocaleString()}</strong>
            </span>
          </div>
        )}
        {summary.shortfall > 0 && (
          <p className="range-warning">
            ${summary.shortfall.toLocaleString()} short of funding this kit,
            transport and reserve.
          </p>
        )}
      </section>
    </div>
  );
}
