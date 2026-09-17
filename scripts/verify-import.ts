import { createRoadmap, formatDuration, parsePlaylistId, toDateKey, totalSec } from '@ftr/core';
import { importPlaylist } from '../apps/extension/lib/youtube-api';

const key = process.env.YOUTUBE_API_KEY;
const url = process.env.TEST_PLAYLIST_URL;

if (!key) throw new Error('Set YOUTUBE_API_KEY in .env');
if (!url) throw new Error('Set TEST_PLAYLIST_URL in .env');

const playlistId = parsePlaylistId(url);
if (!playlistId) throw new Error(`Could not parse a playlist id out of ${url}`);

console.log(`playlist id: ${playlistId}`);

const result = await importPlaylist(playlistId, key, (fetched) =>
  process.stdout.write(`\rfetched ${fetched} videos…`),
);

console.log(`\n\ntitle:       ${result.title}`);
console.log(`videos:      ${result.videos.length}`);
console.log(`unavailable: ${result.unavailable}`);
console.log(`total time:  ${formatDuration(totalSec(result.videos))}`);

console.log('\nfirst 5 videos:');
for (const video of result.videos.slice(0, 5)) {
  console.log(`  ${formatDuration(video.durationSec).padStart(7)}  ${video.title}`);
}

const today = toDateKey(new Date());

for (const mode of [
  { kind: 'byBudget', minutesPerDay: 60 } as const,
  { kind: 'byDate', endDate: '2026-10-17' } as const,
]) {
  const roadmap = createRoadmap({
    title: result.title,
    playlistId: result.playlistId,
    videos: result.videos,
    plan: { startDate: today, mode, activeWeekdays: [1, 2, 3, 4, 5, 6], skipDates: [] },
  });

  const label = mode.kind === 'byBudget' ? `${mode.minutesPerDay} min/day` : `finish by ${mode.endDate}`;
  const longest = Math.max(...roadmap.schedule.map((day) => day.plannedSec));

  console.log(`\n── ${label} ──`);
  console.log(`days: ${roadmap.schedule.length}  ends: ${roadmap.schedule.at(-1)?.date}`);
  console.log(`heaviest day: ${formatDuration(longest)}`);
  for (const day of roadmap.schedule.slice(0, 4)) {
    console.log(`  ${day.date}  ${formatDuration(day.plannedSec).padStart(7)}  ${day.taskIds.length} video(s)`);
  }

  const scheduled = roadmap.schedule.flatMap((day) => day.taskIds);
  const everyTaskScheduled = new Set(scheduled).size === roadmap.tasks.length;
  console.log(`all ${roadmap.tasks.length} videos scheduled exactly once: ${everyTaskScheduled}`);
}
