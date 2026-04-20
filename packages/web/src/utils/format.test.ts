import { describe, it, expect } from "vitest";
import { currency, currencyDollars, percent, shortDate, fullDate, timeAgo } from "./format";

describe("currency()", () => {
  it("formats cents to dollars", () => {
    expect(currency(1099)).toBe("$10.99");
    expect(currency(0)).toBe("$0.00");
    expect(currency(50)).toBe("$0.50");
  });

  it("formats large amounts", () => {
    expect(currency(1000000)).toBe("$10,000.00");
  });
});

describe("currencyDollars()", () => {
  it("formats dollar amounts", () => {
    expect(currencyDollars(10.99)).toBe("$10.99");
    expect(currencyDollars(0)).toBe("$0.00");
    expect(currencyDollars(1000)).toBe("$1,000.00");
  });
});

describe("percent()", () => {
  it("formats percentages with default 1 decimal", () => {
    expect(percent(75.123)).toBe("75.1%");
    expect(percent(0)).toBe("0.0%");
    expect(percent(100)).toBe("100.0%");
  });

  it("supports custom decimal places", () => {
    expect(percent(75.123, 2)).toBe("75.12%");
    expect(percent(75, 0)).toBe("75%");
  });
});

describe("shortDate()", () => {
  it("formats date as short string", () => {
    const result = shortDate("2026-03-13T12:00:00Z");
    expect(result).toContain("Mar");
    expect(result).toContain("13");
  });
});

describe("fullDate()", () => {
  it("includes year", () => {
    const result = fullDate("2026-03-13T12:00:00Z");
    expect(result).toContain("2026");
    expect(result).toContain("Mar");
  });
});

describe("timeAgo()", () => {
  it("returns 'just now' for recent times", () => {
    expect(timeAgo(new Date().toISOString())).toBe("just now");
  });

  it("returns minutes ago", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(timeAgo(fiveMinAgo)).toBe("5m ago");
  });

  it("returns hours ago", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(twoHoursAgo)).toBe("2h ago");
  });

  it("returns days ago", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(threeDaysAgo)).toBe("3d ago");
  });
});
