import { describe, expect, it } from "vitest";
import { standing } from "./standards";

describe("standing", () => {
  it("places a lift in its band and says what reaches the next", () => {
    const s = standing("back-squat", 120, 80, "men")!;
    expect(s.ratio).toBe(1.5);
    expect(s.level).toBe("Intermediate");
    expect(s.next).toEqual({ level: "Advanced", kg: 180 });
  });
  it("is below beginner under the first band, and elite at the top", () => {
    expect(standing("bench-press", 20, 80, "men")!.level).toBeNull();
    expect(standing("deadlift", 200, 60, "women")!.next).toBeNull();
  });
  it("knows only the lifts it has tables for", () => {
    expect(standing("bicep-curl", 40, 80, "men")).toBeNull();
    expect(standing("back-squat", 100, 0, "men")).toBeNull();
  });
});
