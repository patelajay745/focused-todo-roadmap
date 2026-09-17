import { describe, expect, test } from "bun:test";
import {
  formatDuration,
  parseIsoDuration,
  parsePlaylistId,
  parseVideoId,
  watchUrl,
} from "../src/youtube";

describe("parsePlaylistId", () => {
  test("extracts the list param from real playlist URLs", () => {
    expect(parsePlaylistId("https://www.youtube.com/playlist?list=PLabc123")).toBe("PLabc123");
    expect(parsePlaylistId("https://youtube.com/watch?v=dQw4w9WgXcQ&list=PLabc123")).toBe(
      "PLabc123",
    );
    expect(parsePlaylistId("youtube.com/playlist?list=PLabc123")).toBe("PLabc123");
  });

  test("accepts a bare playlist id", () => {
    expect(parsePlaylistId("PLabc123")).toBe("PLabc123");
    expect(parsePlaylistId("  PLabc123  ")).toBe("PLabc123");
  });

  test("returns null when there is no playlist", () => {
    expect(parsePlaylistId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(parsePlaylistId("")).toBeNull();
    expect(parsePlaylistId("   ")).toBeNull();
  });
});

describe("parseVideoId", () => {
  test("handles watch URLs, short links and bare ids", () => {
    expect(parseVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  test("keeps the video id when a playlist is also present", () => {
    expect(parseVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabc")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  test("rejects ids of the wrong length", () => {
    expect(parseVideoId("tooshort")).toBeNull();
    expect(parseVideoId("https://www.youtube.com/watch?v=short")).toBeNull();
  });
});

describe("parseIsoDuration", () => {
  test("parses the shapes the YouTube API returns", () => {
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
    expect(parseIsoDuration("PT45M")).toBe(2700);
    expect(parseIsoDuration("PT30S")).toBe(30);
    expect(parseIsoDuration("PT2H")).toBe(7200);
    expect(parseIsoDuration("P1DT2H")).toBe(93600);
  });

  test("treats live and malformed durations as zero", () => {
    expect(parseIsoDuration("P0D")).toBe(0);
    expect(parseIsoDuration("")).toBe(0);
    expect(parseIsoDuration("garbage")).toBe(0);
  });

  test("rounds fractional seconds", () => {
    expect(parseIsoDuration("PT1M30.5S")).toBe(91);
  });
});

describe("formatDuration", () => {
  test("renders hours and minutes", () => {
    expect(formatDuration(3723)).toBe("1h 2m");
    expect(formatDuration(7200)).toBe("2h");
    expect(formatDuration(2700)).toBe("45m");
    expect(formatDuration(30)).toBe("30s");
    expect(formatDuration(0)).toBe("0s");
  });

  test("clamps negatives", () => {
    expect(formatDuration(-60)).toBe("0s");
  });
});

describe("watchUrl", () => {
  test("builds a watch link, optionally inside the playlist", () => {
    expect(watchUrl("dQw4w9WgXcQ")).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(watchUrl("dQw4w9WgXcQ", "PLabc")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabc",
    );
  });
});
