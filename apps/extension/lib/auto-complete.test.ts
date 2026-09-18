import { createRoadmap, getDayView, markTask, type Roadmap } from '@ftr/core';
import { describe, expect, test } from 'bun:test';
import { autoCompleteVideo } from './auto-complete';

function build(title: string, count: number, startIndex?: number): Roadmap {
  return createRoadmap({
    title,
    playlistId: `PL_${title}`,
    videos: Array.from({ length: count }, (_, i) => ({
      videoId: `${title}vid${i}`.padEnd(11, 'x').slice(0, 11),
      title: `${title} video ${i + 1}`,
      durationSec: 3600,
    })),
    plan: {
      startDate: '2026-01-05',
      mode: { kind: 'byBudget', minutesPerDay: 60 },
      activeWeekdays: [0, 1, 2, 3, 4, 5, 6],
      skipDates: [],
    },
    startIndex,
    now: new Date('2026-01-05T09:00:00Z'),
  });
}

describe('autoCompleteVideo', () => {
  test('marks a pending video done and reports its title', () => {
    const roadmap = build('a', 3);
    const target = roadmap.tasks[1]!;

    const result = autoCompleteVideo([roadmap], target.videoId);
    expect(result?.title).toBe(target.title);
    expect(result?.roadmap.tasks[1]!.status).toBe('done');
  });

  test('records the completion as automatic', () => {
    const roadmap = build('a', 3);
    const result = autoCompleteVideo([roadmap], roadmap.tasks[0]!.videoId);
    expect(result?.roadmap.tasks[0]!.autoCompleted).toBe(true);
    expect(result?.roadmap.tasks[0]!.completedAt).toBeDefined();
  });

  test('ignores a video that is not on any roadmap', () => {
    expect(autoCompleteVideo([build('a', 3)], 'unrelatedX')).toBeNull();
  });

  test('ignores a video that is already done', () => {
    const roadmap = build('a', 3);
    const done = markTask(roadmap, roadmap.tasks[0]!.id, {
      status: 'done',
      at: new Date('2026-01-05T10:00:00Z'),
    });
    expect(autoCompleteVideo([done], roadmap.tasks[0]!.videoId)).toBeNull();
  });

  test('does not resurrect a video skipped by the start point', () => {
    const roadmap = build('a', 4, 2);
    expect(autoCompleteVideo([roadmap], roadmap.tasks[0]!.videoId)).toBeNull();
  });

  test('finds the video across several roadmaps', () => {
    const first = build('a', 2);
    const second = build('b', 2);
    const target = second.tasks[1]!;

    const result = autoCompleteVideo([first, second], target.videoId);
    expect(result?.roadmap.id).toBe(second.id);
    expect(result?.title).toBe(target.title);
  });

  test('leaves other roadmaps untouched', () => {
    const first = build('a', 2);
    const second = build('b', 2);

    const result = autoCompleteVideo([first, second], second.tasks[0]!.videoId);
    expect(result?.roadmap.id).not.toBe(first.id);
    expect(first.tasks.every((task) => task.status === 'todo')).toBe(true);
  });

  test('the completion lands on the day it was watched', () => {
    const roadmap = build('a', 3);
    const target = roadmap.tasks[2]!;

    const result = autoCompleteVideo([roadmap], target.videoId, new Date('2026-01-09T21:00:00'));
    const view = getDayView(result!.roadmap, '2026-01-09');
    expect(view.tasks.map((task) => task.id)).toContain(target.id);
  });

  test('returns null for an empty roadmap list', () => {
    expect(autoCompleteVideo([], 'anythingxyz')).toBeNull();
  });
});
