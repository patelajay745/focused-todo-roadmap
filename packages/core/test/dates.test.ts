import { describe, expect, test } from "bun:test";
import { addDays, diffDays, isValidDateKey, toDateKey, weekdayOf } from "../src/dates";

describe("dates", () => {
  test("addDays crosses month and year boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  test("addDays handles leap years", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });

  test("addDays does not drift across a DST transition", () => {
    expect(addDays("2026-03-07", 1)).toBe("2026-03-08");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
  });

  test("diffDays is signed and symmetric", () => {
    expect(diffDays("2026-01-05", "2026-01-12")).toBe(7);
    expect(diffDays("2026-01-12", "2026-01-05")).toBe(-7);
    expect(diffDays("2026-01-05", "2026-01-05")).toBe(0);
  });

  test("weekdayOf matches the real calendar", () => {
    expect(weekdayOf("2026-01-05")).toBe(1);
    expect(weekdayOf("2026-01-10")).toBe(6);
    expect(weekdayOf("2026-01-11")).toBe(0);
  });

  test("isValidDateKey rejects impossible dates", () => {
    expect(isValidDateKey("2026-01-05")).toBe(true);
    expect(isValidDateKey("2026-02-30")).toBe(false);
    expect(isValidDateKey("2026-13-01")).toBe(false);
    expect(isValidDateKey("26-01-05")).toBe(false);
    expect(isValidDateKey("not-a-date")).toBe(false);
  });

  test("toDateKey uses local calendar fields", () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toDateKey(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  test("date keys sort chronologically as plain strings", () => {
    const sorted = ["2026-10-02", "2026-01-05", "2026-02-20"].sort();
    expect(sorted).toEqual(["2026-01-05", "2026-02-20", "2026-10-02"]);
  });
});
