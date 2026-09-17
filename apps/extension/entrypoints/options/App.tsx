import { formatDuration, totalSec, type Roadmap } from '@ftr/core';
import { DeleteDustbin, EditPencil } from 'pikaicons';
import { useEffect, useState } from 'react';
import { Button, Card, Field, Input, Notice } from '../../components/ui';
import { deleteRoadmap, listRoadmaps, settingsItem } from '../../lib/storage';
import { ImportWizard } from './ImportWizard';
import { RoadmapEditor } from './RoadmapEditor';

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [keyDraft, setKeyDraft] = useState('');
  const [keySaved, setKeySaved] = useState(false);
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    void settingsItem.getValue().then((settings) => {
      setApiKey(settings.youtubeApiKey);
      setKeyDraft(settings.youtubeApiKey);
    });
    void refresh();
  }, []);

  async function refresh() {
    setRoadmaps(await listRoadmaps());
  }

  async function saveKey() {
    const trimmed = keyDraft.trim();
    await settingsItem.setValue({ youtubeApiKey: trimmed });
    setApiKey(trimmed);
    setKeySaved(true);
  }

  async function remove(id: string) {
    await deleteRoadmap(id);
    await refresh();
  }

  return (
    <main className="font-sans min-h-screen bg-surface text-ink">
      <div className="mx-auto max-w-2xl px-6 py-10 space-y-6">
        <header>
          <h1 className="text-2xl font-semibold">Focused</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Turn a playlist into a dated plan, then meet it on every new tab.
          </p>
        </header>

        <Card>
          <h2 className="text-sm font-semibold">YouTube API key</h2>
          <p className="mt-1 mb-4 text-xs text-ink-muted">
            Needed only to read playlist contents. Stored locally in this browser and never sent
            anywhere else.
          </p>
          <Field
            label="Key"
            hint="Google Cloud Console → enable YouTube Data API v3 → Credentials → API key."
          >
            <div className="flex gap-2">
              <Input
                type="password"
                value={keyDraft}
                onChange={(event) => {
                  setKeyDraft(event.target.value);
                  setKeySaved(false);
                }}
                placeholder="AIza…"
              />
              <Button onClick={() => void saveKey()} disabled={!keyDraft.trim()}>
                Save
              </Button>
            </div>
          </Field>
          {keySaved ? (
            <div className="mt-3">
              <Notice tone="success">Key saved.</Notice>
            </div>
          ) : null}
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold">Import a playlist</h2>
          {apiKey ? (
            <ImportWizard apiKey={apiKey} onSaved={() => void refresh()} />
          ) : (
            <Notice tone="info">Add your API key above to start importing.</Notice>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold">Your roadmaps</h2>
          {roadmaps.length === 0 ? (
            <Notice tone="info">Nothing yet.</Notice>
          ) : (
            <ul className="divide-y divide-white/5">
              {roadmaps.map((roadmap) => {
                const done = roadmap.tasks.filter((task) => task.status !== 'todo').length;
                const isEditing = editingId === roadmap.id;

                return (
                  <li key={roadmap.id} className="py-3 first:pt-0">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{roadmap.title}</p>
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {done}/{roadmap.tasks.length} done ·{' '}
                          {formatDuration(totalSec(roadmap.tasks))} · {roadmap.schedule.length} days
                          · ends {roadmap.schedule.at(-1)?.date}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => setEditingId(isEditing ? null : roadmap.id)}
                        aria-label={`Edit ${roadmap.title}`}
                        className="flex items-center gap-1.5"
                      >
                        <EditPencil className="h-4 w-4" aria-hidden />
                        {isEditing ? 'Close' : 'Edit'}
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => void remove(roadmap.id)}
                        aria-label={`Delete ${roadmap.title}`}
                        className="flex items-center gap-1.5"
                      >
                        <DeleteDustbin className="h-4 w-4" aria-hidden />
                        Delete
                      </Button>
                    </div>

                    {isEditing ? (
                      <div className="mt-3">
                        <RoadmapEditor
                          roadmap={roadmap}
                          onDone={() => {
                            setEditingId(null);
                            void refresh();
                          }}
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
