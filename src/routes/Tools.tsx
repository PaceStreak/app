import { useState } from "react";
import { IntervalTimer } from "../components/IntervalTimer";
import { PlateCalculator } from "../components/PlateCalculator";
import { RestBar, useRestTimer } from "../components/RestTimer";
import { PageHeader, Segmented } from "../components/ui";
import { useMe } from "../lib/session";
import { clock, e1rm, fromMetres, parseDuration, parseNumber, toMetres, type DistanceUnit } from "../lib/units";
import { usePersistentState } from "../lib/persist";

type Tool = "timer" | "intervals" | "plates" | "max" | "pace";

export default function Tools() {
  const me = useMe();
  const [tool, setTool] = usePersistentState<Tool>("tools", "timer", ["timer", "intervals", "plates", "max", "pace"]);
  return (
    <div>
      <PageHeader title="Tools" back="/you" />
      <Segmented label="Tool" value={tool} onChange={setTool} options={[{ value: "timer", label: "Rest" }, { value: "intervals", label: "Intervals" }, { value: "plates", label: "Plates" }, { value: "max", label: "1RM" }, { value: "pace", label: "Pace" }]} />
      <div className="mt-6">
        {tool === "timer" && <Timer />}
        {tool === "intervals" && <IntervalTimer />}
        {tool === "plates" && (
          <div className="card p-5">
            <PlateCalculator unit={me.profile.weight_unit} />
          </div>
        )}
        {tool === "max" && <MaxCalc unit={me.profile.weight_unit} />}
        {tool === "pace" && <PaceCalc unit={me.profile.distance_unit} />}
      </div>
    </div>
  );
}

function Timer() {
  const timer = useRestTimer();
  return (
    <>
      <div className="card flex flex-col items-center p-8">
        <p className="num text-7xl font-semibold tracking-tight">{clock(timer.running ? timer.remaining : 0)}</p>
        <div className="mt-8 grid w-full grid-cols-4 gap-2">
          {[60, 90, 120, 180].map((s) => (
            <button key={s} type="button" className="btn btn-secondary" onClick={() => timer.start(s)}>
              {clock(s)}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-4 text-sm text-dim">Vibrates and chimes when time's up, and sends a notification if the app is in the background (with notifications allowed).</p>
      <RestBar timer={timer} />
    </>
  );
}

function MaxCalc({ unit }: { unit: "kg" | "lb" }) {
  const [w, setW] = useState("100");
  const [r, setR] = useState("5");
  const max = e1rm(parseNumber(w) ?? 0, Math.round(parseNumber(r) ?? 0));
  const rows = [1, 2, 3, 5, 8, 10, 12];
  return (
    <div className="card p-5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="m-w">Weight ({unit})</label>
          <input id="m-w" className="input num" inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="m-r">Reps</label>
          <input id="m-r" className="input num" inputMode="numeric" value={r} onChange={(e) => setR(e.target.value)} />
        </div>
      </div>
      {max > 0 ? (
        <>
          <p className="mt-6 text-sm text-dim">Estimated one-rep max</p>
          <p className="num text-4xl font-semibold tracking-tight">
            {Math.round(max * 2) / 2} <span className="text-lg text-dim">{unit}</span>
          </p>
          <table className="num mt-5 w-full text-sm">
            <thead>
              <tr className="text-left text-dim">
                <th className="py-1 font-medium">Reps</th>
                <th className="py-1 font-medium">Weight</th>
                <th className="py-1 font-medium">% of max</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((n) => {
                const load = n === 1 ? max : max / (1 + n / 30);
                return (
                  <tr key={n} className="border-t border-line">
                    <td className="py-2">{n}</td>
                    <td className="py-2">{Math.round(load * 2) / 2} {unit}</td>
                    <td className="py-2 text-dim">{Math.round((load / max) * 100)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-4 text-sm text-dim">Epley formula. An estimate, most reliable from sets of 3 to 10. Not a reason to test a true max.</p>
        </>
      ) : (
        <p className="mt-6 text-sm text-dim">Enter a set of 12 reps or fewer.</p>
      )}
    </div>
  );
}

function PaceCalc({ unit }: { unit: DistanceUnit }) {
  const [dist, setDist] = useState("5");
  const [time, setTime] = useState("0:25");
  const m = toMetres(parseNumber(dist) ?? 0, unit);
  const sec = parseDuration(time) ?? 0;
  const perUnit = m > 0 ? sec / fromMetres(m, unit) : 0;
  const races = [
    ["5k", 5000],
    ["10k", 10000],
    ["Half", 21097.5],
    ["Marathon", 42195],
  ] as const;
  return (
    <div className="card p-5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="p-d">Distance ({unit})</label>
          <input id="p-d" className="input num" inputMode="decimal" value={dist} onChange={(e) => setDist(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="p-t">Time (h:mm or h:mm:ss)</label>
          <input id="p-t" className="input num" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      {perUnit > 0 && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div>
              <p className="text-sm text-dim">Pace</p>
              <p className="num text-3xl font-semibold tracking-tight">{clock(perUnit)}<span className="text-base text-dim"> /{unit}</span></p>
            </div>
            <div>
              <p className="text-sm text-dim">Speed</p>
              <p className="num text-3xl font-semibold tracking-tight">{(3600 / perUnit).toFixed(1)}<span className="text-base text-dim"> {unit === "km" ? "km/h" : "mph"}</span></p>
            </div>
          </div>
          <table className="num mt-5 w-full text-sm">
            <tbody>
              {races.map(([name, metres]) => (
                <tr key={name} className="border-t border-line">
                  <td className="py-2 text-dim">{name} at this pace</td>
                  <td className="py-2 text-right">{clock((metres / m) * sec)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

