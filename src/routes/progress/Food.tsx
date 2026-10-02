import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { BarChart } from "../../components/BarChart";
import { Barcode, CaretLeft, CaretRight, Copy, Lock, Plus, Trash } from "../../components/phosphor";
import { Sheet } from "../../components/Sheet";
import { toast } from "../../components/toast";
import { Empty, ErrorState, Field, Loading, PageHeader, Section, Segmented } from "../../components/ui";
import { ApiError, api, errorText, post, put } from "../../lib/api";
import { addDays, fmtMonthDay, localToday, uuid } from "../../lib/dates";
import { queryClient } from "../../lib/queries";
import { sendOrQueue } from "../../lib/requests";
import { canDetectBarcodes, detectBarcode } from "../../lib/barcode";
import { useMe } from "../../lib/session";
import { deleteWithUndo } from "../../lib/undo";
import type { Expenditure, Food as SavedFood, Macros, Meal, NutritionDay, NutritionTarget, RecentFood, Recipe } from "../../lib/types";
import { parseNumber } from "../../lib/units";

const MEALS: { value: Meal; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snacks" },
];
const MACROS: { key: keyof Macros; label: string; unit: string }[] = [
  { key: "kcal", label: "Calories", unit: "kcal" },
  { key: "protein_g", label: "Protein", unit: "g" },
  { key: "carbs_g", label: "Carbs", unit: "g" },
  { key: "fat_g", label: "Fat", unit: "g" },
];

/** Breakfast before eleven, lunch before four, dinner after - a guess the person can change. */
function guessMeal(hour: number): Meal {
  return hour < 11 ? "breakfast" : hour < 16 ? "lunch" : hour < 22 ? "dinner" : "snack";
}

const round = (n: number) => Math.round(n * 10) / 10;


type Draft = { name: string; servings: string; food_id: string | null } & Record<keyof Macros, string>;
const EMPTY: Draft = { name: "", servings: "1", food_id: null, kcal: "", protein_g: "", carbs_g: "", fat_g: "" };

export default function Food() {
  const me = useMe();
  const today = localToday(me.profile.timezone);
  const [day, setDay] = useState(today);
  const q = useQuery({ queryKey: ["nutrition", day], queryFn: () => api<NutritionDay>(`/nutrition/days/${day}`) });
  const history = useQuery({ queryKey: ["nutrition-history"], queryFn: () => api<(Macros & { date: string })[]>("/nutrition/history?days=30") });
  const recent = useQuery({ queryKey: ["nutrition-recent"], queryFn: () => api<RecentFood[]>("/nutrition/recent") });
  const recipes = useQuery({ queryKey: ["recipes"], queryFn: () => api<Recipe[]>("/nutrition/recipes") });
  const burn = useQuery({ queryKey: ["expenditure"], queryFn: () => api<Expenditure>("/nutrition/expenditure"), staleTime: 10 * 60_000 });
  const [adding, setAdding] = useState<Meal | null>(null);
  // /food?barcode=… (from a shared photo): open the add sheet already looking it up.
  const [params, setParams] = useSearchParams();
  const [initialCode, setInitialCode] = useState<string | null>(null);
  useEffect(() => {
    const code = params.get("barcode");
    if (code && /^\d{8,14}$/.test(code)) {
      setInitialCode(code);
      setAdding(guessMeal(new Date().getHours()));
      setParams({}, { replace: true });
    }
  }, [params, setParams]);
  const [recipeOpen, setRecipeOpen] = useState<Recipe | "new" | null>(null);
  const [targetOpen, setTargetOpen] = useState(false);

  const refresh = () => {
    for (const key of ["nutrition", "nutrition-history", "nutrition-recent", "coach", "expenditure", "recipes", "foods"]) void queryClient.invalidateQueries({ queryKey: [key] });
  };

  const remove = async (id: string, name: string) => {
    await deleteWithUndo({ path: `/nutrition/entries/${id}`, label: name, queue: true, refresh: ["nutrition", "nutrition-history", "nutrition-recent", "coach", "expenditure"] });
  };

  const copyYesterday = async (meal: Meal | null) => {
    try {
      const copied = await post<unknown[]>("/nutrition/copy", { from_date: addDays(day, -1), to_date: day, meal });
      toast.success(copied.length ? `Copied ${copied.length} from the day before` : "Nothing logged for it the day before");
      refresh();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const data = q.data;
  const target = data?.target;
  return (
    <div>
      <PageHeader
        title="Food"
        back="/you"
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <Lock size={14} aria-hidden /> Only you see this
          </span>
        }
        action={
          <button type="button" className="btn btn-ghost" onClick={() => setTargetOpen(true)}>
            Targets
          </button>
        }
      />

      <div className="flex items-center justify-between gap-2">
        <button type="button" className="btn btn-ghost btn-icon" aria-label="Previous day" onClick={() => setDay(addDays(day, -1))}>
          <CaretLeft size={20} />
        </button>
        <p className="font-semibold">{day === today ? "Today" : day === addDays(today, -1) ? "Yesterday" : fmtMonthDay(day)}</p>
        <button type="button" className="btn btn-ghost btn-icon" aria-label="Next day" disabled={day >= today} onClick={() => setDay(addDays(day, 1))}>
          <CaretRight size={20} />
        </button>
      </div>

      {q.isLoading ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        data && (
          <>
            {data.entries.length === 0 && (
              <button type="button" className="btn btn-ghost mt-3 w-full border border-line" onClick={() => void copyYesterday(null)}>
                <Copy size={16} /> Same as the day before
              </button>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {MACROS.map((m) => {
                const goal = target?.[m.key];
                const value = data.totals[m.key];
                return (
                  <div key={m.key} className="card p-4">
                    <p className="text-sm text-dim">{m.label}</p>
                    <p className="num mt-1 text-2xl font-semibold">
                      {Math.round(value)}
                      <span className="text-sm text-dim"> {goal ? `/ ${Math.round(goal)}` : m.unit}</span>
                    </p>
                    {goal ? (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" role="presentation">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (value / goal) * 100)}%` }} />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {MEALS.map((meal) => {
              const entries = data.entries.filter((e) => e.meal === meal.value);
              const kcal = entries.reduce((s, e) => s + e.kcal, 0);
              return (
                <Section
                  key={meal.value}
                  title={`${meal.label}${entries.length ? ` · ${Math.round(kcal)} kcal` : ""}`}
                  action={
                    <span className="flex gap-1">
                      {!entries.length && (
                        <button type="button" className="btn btn-ghost btn-icon" aria-label={`Copy ${meal.label.toLowerCase()} from the day before`} onClick={() => void copyYesterday(meal.value)}>
                          <Copy size={18} />
                        </button>
                      )}
                      <button type="button" className="btn btn-ghost" onClick={() => setAdding(meal.value)}>
                        Add
                      </button>
                    </span>
                  }
                >
                  {entries.length > 0 && (
                    <ul className="card divide-y divide-line">
                      {entries.map((e) => (
                        <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate">
                              {e.name}
                              {e.servings !== 1 && <span className="text-dim"> × {e.servings}</span>}
                            </p>
                            <p className="text-sm text-dim">
                              {Math.round(e.protein_g)} g protein · {Math.round(e.carbs_g)} g carbs · {Math.round(e.fat_g)} g fat
                            </p>
                          </div>
                          <span className="num shrink-0">{Math.round(e.kcal)}</span>
                          <button type="button" className="btn btn-ghost btn-icon" aria-label={`Remove ${e.name}`} onClick={() => void remove(e.id, e.name)}>
                            <Trash size={18} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              );
            })}
          </>
        )
      )}

      {history.data && history.data.length > 1 ? (
        <Section title="Last 30 days">
          <div className="card p-4">
            <BarChart
              title="Calories per day"
              target={target?.kcal ?? null}
              targetLabel="Target"
              bars={history.data.map((d) => ({ key: d.date, label: fmtMonthDay(d.date), value: d.kcal, display: `${Math.round(d.kcal)} kcal` }))}
            />
          </div>
        </Section>
      ) : (
        !q.isLoading &&
        !data?.entries.length && <Empty title="Nothing logged yet" body="Log what you eat to see calories and macros against your targets. Nothing here is shared or scored." />
      )}

      <Section
        title="Recipes"
        action={
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRecipeOpen("new")}>
            <Plus size={16} /> New
          </button>
        }
      >
        {recipes.data?.length ? (
          <ul className="card divide-y divide-line">
            {recipes.data.map((r) => (
              <li key={r.id}>
                <button type="button" className="press flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => setRecipeOpen(r)}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{r.name}</span>
                    <span className="block text-sm text-dim">
                      {r.items.length} {r.items.length === 1 ? "food" : "foods"} · serves {r.serves} · {Math.round(r.protein_g)} g protein a serving
                    </span>
                  </span>
                  <span className="num shrink-0">{Math.round(r.kcal)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-dim">Save a meal you make often from your saved foods, then log it in one tap.</p>
        )}
      </Section>

      {burn.data && <BurnCard burn={burn.data} target={target ?? null} onApplied={refresh} />}

      {recipeOpen && <RecipeSheet recipe={recipeOpen === "new" ? null : recipeOpen} onClose={() => setRecipeOpen(null)} onSaved={refresh} />}
      {adding && (
        <AddSheet
          initialCode={initialCode}
          meal={adding}
          day={day}
          recipes={recipes.data ?? []}
          recent={recent.data ?? []}
          onClose={() => {
            setAdding(null);
            setInitialCode(null);
          }}
          onSaved={() => {
            setAdding(null);
            setInitialCode(null);
            refresh();
          }}
        />
      )}
      {targetOpen && <TargetSheet current={target ?? null} onClose={() => setTargetOpen(false)} onSaved={refresh} />}
    </div>
  );
}

function AddSheet({ meal, day, recipes, recent, onClose, onSaved, initialCode = null }: { meal: Meal; day: string; recipes: Recipe[]; recent: RecentFood[]; onClose: () => void; onSaved: () => void; initialCode?: string | null }) {
  const [mealNow, setMeal] = useState<Meal>(meal ?? guessMeal(new Date().getHours()));
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [code, setCode] = useState(initialCode ?? "");
  const [found, setFound] = useState<(Omit<SavedFood, "id"> & { id?: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fill = (f: Macros & { name: string }, foodId: string | null) =>
    setDraft({ name: f.name, servings: "1", food_id: foodId, kcal: String(f.kcal), protein_g: String(f.protein_g), carbs_g: String(f.carbs_g), fat_g: String(f.fat_g) });

  const lookup = async (barcode: string) => {
    if (!/^\d{8,14}$/.test(barcode)) {
      toast.error("That isn't a product barcode");
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ source: "saved" | "openfoodfacts"; food: SavedFood }>(`/nutrition/barcode/${barcode}`);
      setFound(res.food);
      fill(res.food, res.source === "saved" ? res.food.id : null);
    } catch (err) {
      toast.error(err instanceof ApiError && err.status === 404 ? "Not in the database. Type it in below." : errorText(err));
    } finally {
      setBusy(false);
    }
  };

  // A barcode handed over from a shared photo: look it up straight away.
  const looked = useRef(false);
  useEffect(() => {
    if (initialCode && !looked.current) {
      looked.current = true;
      void lookup(initialCode);
    }
    // Once, on open; lookup is stable enough for that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  // A photo of the barcode rather than a live camera: the app's
  // Permissions-Policy keeps camera=(), and the file picker needs no permission.
  const scan = async (file: File) => {
    if (!canDetectBarcodes) return;
    try {
      const found = await detectBarcode(file);
      if (!found) {
        toast.error("No barcode found in that photo. Try closer, or type the number.");
        return;
      }
      setCode(found);
      await lookup(found);
    } catch {
      toast.error("Couldn't read that photo. Type the number instead.");
    }
  };

  const logRecipe = async (r: Recipe) => {
    setBusy(true);
    try {
      const result = await sendOrQueue(`/nutrition/entries/${uuid()}`, "PUT", { date: day, meal: mealNow, recipe_id: r.id, servings: 1 });
      toast.success(result === "queued" ? "Saved on this phone. It syncs when you're back online." : `Logged ${r.name}`);
      onSaved();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const save = async (remember: boolean) => {
    const servings = parseNumber(draft.servings) ?? 1;
    const kcal = parseNumber(draft.kcal);
    if (!draft.name.trim() || kcal == null || servings <= 0) return;
    setBusy(true);
    try {
      let foodId = draft.food_id;
      const per = Object.fromEntries(MACROS.map((m) => [m.key, parseNumber(draft[m.key]) ?? 0])) as unknown as Macros;
      if (remember && !foodId) {
        const saved = await post<SavedFood>("/nutrition/foods", {
          name: draft.name.trim(),
          brand: found?.brand ?? null,
          barcode: found?.barcode ?? null,
          serving_label: found?.serving_label ?? null,
          ...per,
        });
        foodId = saved.id;
      }
      const body = foodId
        ? { date: day, meal: mealNow, food_id: foodId, servings }
        : { date: day, meal: mealNow, servings, name: draft.name.trim(), ...Object.fromEntries(MACROS.map((m) => [m.key, round(per[m.key] * servings)])) };
      const result = await sendOrQueue(`/nutrition/entries/${uuid()}`, "PUT", body);
      toast.success(result === "queued" ? "Saved on this phone. It syncs when you're back online." : "Logged");
      onSaved();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const set = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, [key]: e.target.value, ...(key === "servings" ? {} : { food_id: key === "name" ? null : draft.food_id }) });

  return (
    <Sheet open onClose={onClose} title="Add food">
      <div className="space-y-4">
        <Segmented label="Meal" value={mealNow} onChange={setMeal} options={MEALS} />

        <div className="flex items-end gap-2">
          <Field className="flex-1" label="Barcode" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => e.key === "Enter" && void lookup(code)} />
          <button type="button" className="btn" disabled={busy || !code} onClick={() => void lookup(code)}>
            Look up
          </button>
          {canDetectBarcodes && (
            <>
              <button type="button" className="btn btn-icon" aria-label="Scan a barcode with the camera" onClick={() => fileRef.current?.click()}>
                <Barcode size={20} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && void scan(e.target.files[0])} />
            </>
          )}
        </div>
        {found && (
          <p className="text-sm text-dim">
            {found.brand ? `${found.brand} · ` : ""}per {found.serving_label ?? "serving"}
            {!found.id && " · from Open Food Facts, check it against the label"}
          </p>
        )}

        {!found && recipes.length > 0 && !draft.name && (
          <div>
            <p className="field-label">Recipes, one serving</p>
            <div className="flex flex-wrap gap-2">
              {recipes.slice(0, 8).map((r) => (
                <button key={r.id} type="button" className="btn btn-ghost border border-line" disabled={busy} onClick={() => void logRecipe(r)}>
                  {r.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {!found && recent.length > 0 && !draft.name && (
          <div>
            <p className="field-label">Recent</p>
            <div className="flex flex-wrap gap-2">
              {recent.slice(0, 8).map((r) => (
                <button key={`${r.food_id}:${r.name}`} type="button" className="btn btn-ghost border border-line" onClick={() => fill(r, r.food_id)}>
                  {r.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <Field label="Name" value={draft.name} onChange={set("name")} maxLength={120} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Servings" inputMode="decimal" value={draft.servings} onChange={set("servings")} />
          {MACROS.map((m) => (
            <Field key={m.key} label={`${m.label} per serving`} inputMode="decimal" trailing={m.unit} value={draft[m.key]} onChange={set(m.key)} disabled={!!draft.food_id} />
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-primary flex-1" disabled={busy || !draft.name.trim() || parseNumber(draft.kcal) == null} onClick={() => void save(false)}>
            Log it
          </button>
          {!draft.food_id && (
            <button type="button" className="btn flex-1" disabled={busy || !draft.name.trim() || parseNumber(draft.kcal) == null} onClick={() => void save(true)}>
              Log and save food
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

function TargetSheet({ current, onClose, onSaved }: { current: NutritionTarget | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Record<keyof Macros, string>>(
    Object.fromEntries(MACROS.map((m) => [m.key, current?.[m.key] != null ? String(current[m.key]) : ""])) as Record<keyof Macros, string>,
  );
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await put("/nutrition/target", Object.fromEntries(MACROS.map((m) => [m.key, parseNumber(form[m.key])])));
      toast.success("Targets saved");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title="Daily targets">
      <div className="space-y-4">
        <p className="text-sm text-muted">Set only the ones you care about. Leave everything empty to turn targets off.</p>
        <div className="grid grid-cols-2 gap-3">
          {MACROS.map((m) => (
            <Field key={m.key} label={m.label} inputMode="decimal" trailing={m.unit} value={form[m.key]} onChange={(e) => setForm({ ...form, [m.key]: e.target.value })} />
          ))}
        </div>
        <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => void save()}>
          Save
        </button>
      </div>
    </Sheet>
  );
}

function BurnCard({ burn, target, onApplied }: { burn: Expenditure; target: NutritionTarget | null; onApplied: () => void }) {
  const [busy, setBusy] = useState(false);
  const s = burn.suggestion;
  const apply = async () => {
    if (!s) return;
    setBusy(true);
    try {
      await put("/nutrition/target", { kcal: s.kcal, protein_g: target?.protein_g ?? null, carbs_g: target?.carbs_g ?? null, fat_g: target?.fat_g ?? null });
      toast.success(`Calorie target set to ${s.kcal}`);
      onApplied();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section title="Energy burn">
      <div className="card space-y-3 p-4">
        {burn.status === "ok" ? (
          <>
            <p>
              <span className="num text-2xl font-semibold">{burn.tdee}</span> <span className="text-dim">kcal a day</span>
            </p>
            <p className="text-sm text-muted">
              Worked out from {burn.food_days} days of food and {burn.weigh_days} weigh-ins over {burn.window_days} days: you ate about {burn.avg_intake} kcal a day while your trend moved{" "}
              {burn.trend_kg_per_week! > 0 ? "+" : ""}
              {burn.trend_kg_per_week} kg a week.{burn.confidence === "low" ? " A few more days of both will firm it up." : ""}
            </p>
            {s && s.kcal !== target?.kcal && (
              <div className="rounded-md bg-surface-2 p-3">
                <p className="text-sm">
                  {s.goal === "maintain"
                    ? `To hold your weight: about ${s.kcal} kcal a day.`
                    : `Toward your weight goal: about ${s.kcal} kcal a day, roughly ${Math.abs(s.rate_kg_per_week)} kg a week. Kept gentle on purpose.`}
                </p>
                <button type="button" className="btn btn-primary btn-sm mt-2" disabled={busy} onClick={() => void apply()}>
                  Use as calorie target
                </button>
              </div>
            )}
          </>
        ) : burn.status === "inconsistent" ? (
          <p className="text-sm text-muted">The food log and the scale don't add up yet, which usually means some meals weren't logged. Log every meal for a couple of weeks and this works itself out.</p>
        ) : (
          <p className="text-sm text-muted">
            Log food and weigh in for a couple of weeks and this works out what you really burn, from your own numbers. So far: {burn.food_days} of 14 food days, {burn.weigh_days} of 8 weigh-ins.
          </p>
        )}
      </div>
    </Section>
  );
}

function RecipeSheet({ recipe, onClose, onSaved }: { recipe: Recipe | null; onClose: () => void; onSaved: () => void }) {
  const foods = useQuery({ queryKey: ["foods"], queryFn: () => api<SavedFood[]>("/nutrition/foods") });
  const [name, setName] = useState(recipe?.name ?? "");
  const [serves, setServes] = useState(String(recipe?.serves ?? 1));
  const [items, setItems] = useState<Record<string, string>>(Object.fromEntries((recipe?.items ?? []).map((i) => [i.food_id, String(i.servings)])));
  const [busy, setBusy] = useState(false);
  const chosen = Object.entries(items).filter(([, v]) => (parseNumber(v) ?? 0) > 0);
  const byId = new Map((foods.data ?? []).map((f) => [f.id, f]));
  const perServing = (parseNumber(serves) ?? 1) || 1;
  const kcal = chosen.reduce((sum, [id, v]) => sum + (byId.get(id)?.kcal ?? 0) * (parseNumber(v) ?? 0), 0) / perServing;

  const save = async () => {
    setBusy(true);
    try {
      const body = { name: name.trim(), serves: perServing, items: chosen.map(([food_id, v]) => ({ food_id, servings: parseNumber(v) })) };
      if (recipe) await put(`/nutrition/recipes/${recipe.id}`, body);
      else await post("/nutrition/recipes", body);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!recipe) return;
    if (await deleteWithUndo({ path: `/nutrition/recipes/${recipe.id}`, label: recipe.name, refresh: ["recipes"] })) onClose();
  };

  return (
    <Sheet open onClose={onClose} title={recipe ? "Edit recipe" : "New recipe"}>
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <Field label="Name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          <Field label="Serves" inputMode="decimal" value={serves} onChange={(e) => setServes(e.target.value)} />
        </div>
        {foods.data?.length === 0 ? (
          <p className="text-sm text-dim">Recipes are built from saved foods. Use "Log and save food" when adding something, then come back.</p>
        ) : (
          <div>
            <p className="field-label">Servings of each food in the whole recipe</p>
            <ul className="card max-h-72 divide-y divide-line overflow-y-auto">
              {(foods.data ?? []).map((f) => (
                <li key={f.id} className="flex items-center gap-3 px-4 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{f.name}</span>
                    <span className="block text-xs text-dim">
                      {Math.round(f.kcal)} kcal per {f.serving_label ?? "serving"}
                    </span>
                  </span>
                  <input className="input w-20 text-right" inputMode="decimal" aria-label={`Servings of ${f.name}`} placeholder="0" value={items[f.id] ?? ""} onChange={(e) => setItems({ ...items, [f.id]: e.target.value })} />
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="num text-sm text-muted">{Math.round(kcal)} kcal a serving</p>
        <button type="button" className="btn btn-primary w-full" disabled={busy || !name.trim() || !chosen.length} onClick={() => void save()}>
          Save recipe
        </button>
        {recipe && (
          <button type="button" className="btn btn-ghost w-full text-danger" onClick={() => void remove()}>
            Delete recipe
          </button>
        )}
      </div>
    </Sheet>
  );
}
