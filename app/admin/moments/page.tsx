"use client";

import { useEffect, useMemo, useState } from "react";
import { PanoramaScene } from "@/components/PanoramaScene";

type MomentStatus = "queued" | "generated" | "approved" | "rejected";

type MomentDraft = {
  id: string;
  title: string;
  actualYear: number;
  actualLocation: {
    name: string;
    city: string;
    country: string;
    lat: number;
    lng: number;
  };
  description: string;
  prompt?: string;
  sport?: string;
  referenceNotes?: string;
  imageUrl?: string;
  status: MomentStatus;
  createdAt: string;
  updatedAt: string;
  error?: string;
};

const sampleImport = `Miracle on Ice
The United States hockey team shocked the heavily favored Soviet Union during the 1980 Winter Olympics in one of the greatest upsets in sports history.

Michael Jordan hitting the game-winning shot in Game 6 of the 1998 NBA Finals.`;

export default function MomentAdminPage() {
  const [password, setPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [drafts, setDrafts] = useState<MomentDraft[]>([]);
  const [importText, setImportText] = useState(sampleImport);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [imageModel, setImageModel] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [previewDraft, setPreviewDraft] = useState<MomentDraft | null>(null);
  const [statusFilter, setStatusFilter] = useState<MomentStatus | "all">("all");

  useEffect(() => {
    const storedPassword = window.sessionStorage.getItem("moment-admin-password");

    if (storedPassword) {
      setPassword(storedPassword);
      void loadDrafts(storedPassword);
    }
  }, []);

  const visibleDrafts = useMemo(
    () =>
      statusFilter === "all"
        ? drafts
        : drafts.filter((draft) => draft.status === statusFilter),
    [drafts, statusFilter],
  );

  const counts = useMemo(
    () =>
      drafts.reduce(
        (total, draft) => ({
          ...total,
          [draft.status]: total[draft.status] + 1,
        }),
        { approved: 0, generated: 0, queued: 0, rejected: 0 },
      ),
    [drafts],
  );

  async function requestAdmin<T>(
    body?: Record<string, unknown>,
    providedPassword = password,
  ): Promise<T> {
    const response = await fetch("/api/admin/moments", {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": providedPassword.trim(),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error ?? "Admin request failed.");
    }

    return payload;
  }

  async function loadDrafts(providedPassword = password) {
    try {
      const payload = await requestAdmin<{
        drafts: MomentDraft[];
        imageModel: string;
      }>(undefined, providedPassword);
      window.sessionStorage.setItem("moment-admin-password", providedPassword.trim());
      setIsUnlocked(true);
      setDrafts(payload.drafts);
      setImageModel(payload.imageModel);
      setMessage("");
    } catch (error) {
      setIsUnlocked(false);
      setMessage(error instanceof Error ? error.message : "Unable to load drafts.");
    }
  }

  async function importMoments() {
    setIsImporting(true);
    setMessage("");

    try {
      const payload = await requestAdmin<{ count: number }>({
        action: "import",
        input: importText,
      });
      setMessage(`Imported ${payload.count} moments.`);
      await loadDrafts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setIsImporting(false);
    }
  }

  async function importPdf() {
    if (!pdfFile) {
      setMessage("Choose a PDF first.");
      return;
    }

    setIsImporting(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("action", "importPdf");
      formData.append("file", pdfFile);

      const response = await fetch("/api/admin/moments", {
        method: "POST",
        headers: {
          "x-admin-password": password.trim(),
        },
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? "PDF import failed.");
      }

      setMessage(`Imported ${payload.count} moments from PDF.`);
      setPdfFile(null);
      await loadDrafts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "PDF import failed.");
    } finally {
      setIsImporting(false);
    }
  }

  async function runAction(action: string, draft: MomentDraft) {
    setBusyId(draft.id);
    setMessage("");

    try {
      const payload = await requestAdmin<{ draft?: MomentDraft; ok?: boolean }>({
        action,
        id: draft.id,
        updates: action === "approve" ? draft : undefined,
      });

      if (payload.draft) {
        setDrafts((current) =>
          current.map((item) => (item.id === payload.draft?.id ? payload.draft : item)),
        );
      } else {
        await loadDrafts();
      }

      setMessage(action === "approve" ? "Approved and added to code." : "Updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
      await loadDrafts();
    } finally {
      setBusyId(null);
    }
  }

  async function generateNext() {
    const nextDraft = drafts.find((draft) => draft.status === "queued");

    if (nextDraft) {
      await runAction("generate", nextDraft);
    }
  }

  async function generateAllQueued() {
    const queuedDrafts = drafts.filter((draft) => draft.status === "queued");
    setIsBatchGenerating(true);

    try {
      for (const draft of queuedDrafts) {
        await runAction("generate", draft);
      }
    } finally {
      setIsBatchGenerating(false);
      await loadDrafts();
    }
  }

  function updateDraft(id: string, updates: Partial<MomentDraft>) {
    setDrafts((current) =>
      current.map((draft) => (draft.id === id ? { ...draft, ...updates } : draft)),
    );
  }

  function updateLocation(
    id: string,
    updates: Partial<MomentDraft["actualLocation"]>,
  ) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === id
          ? {
              ...draft,
              actualLocation: { ...draft.actualLocation, ...updates },
            }
          : draft,
      ),
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-5 text-[#111827] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col justify-between gap-4 border-b border-[#d8dee9] pb-5 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#496174]">
              Admin
            </p>
            <h1 className="font-serif text-3xl leading-tight text-[#111827]">
              Moment Import Review
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#496174]">
              Paste event descriptions, research their visual references with
              OpenAI, generate one candidate image, edit the approved wording,
              then add it to the game data.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              className="h-10 rounded-md border border-[#b7c1ce] bg-white px-3 text-sm outline-none focus:border-[#2563eb]"
              onChange={(event) => {
                setPassword(event.target.value);
                setIsUnlocked(false);
              }}
              placeholder="Admin password"
              type="password"
              value={password}
            />
            <button
              className="h-10 rounded-md bg-[#111827] px-4 text-sm font-bold text-white disabled:opacity-50"
              disabled={!password}
              onClick={() => loadDrafts()}
              type="button"
            >
              {isUnlocked ? "Unlocked" : "Unlock"}
            </button>
          </div>
        </header>

        {message ? (
          <p className="rounded-md border border-[#fed7aa] bg-[#fff7ed] p-3 text-sm font-bold text-[#9a3412]">
            {message}
          </p>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[minmax(320px,420px)_1fr]">
          <aside className="flex flex-col gap-4">
            <div className="rounded-lg border border-[#d8dee9] bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-base font-black">Import Queue</h2>
                {imageModel ? (
                  <span className="rounded-full bg-[#eef2ff] px-2.5 py-1 text-xs font-bold text-[#3730a3]">
                    {imageModel}
                  </span>
                ) : null}
              </div>
              <textarea
                className="min-h-72 w-full resize-y rounded-md border border-[#b7c1ce] bg-[#fbfcfe] p-3 font-mono text-xs leading-5 outline-none focus:border-[#2563eb]"
                onChange={(event) => setImportText(event.target.value)}
                spellCheck={false}
                value={importText}
              />
              <button
                className="mt-3 h-10 w-full rounded-md bg-[#2563eb] px-4 text-sm font-black text-white disabled:opacity-50"
                disabled={!isUnlocked || isImporting}
                onClick={importMoments}
                type="button"
              >
                {!isUnlocked
                  ? "Unlock To Import"
                  : isImporting
                    ? "Importing..."
                    : "Import Descriptions"}
              </button>
              <p className="mt-3 text-xs leading-5 text-[#5d7184]">
                Paste plain event descriptions, numbered blocks, JSON, or CSV.
                Freeform descriptions use OpenAI web search to fill in title,
                year, sport, venue, coordinates, and visual reference notes.
              </p>

              <div className="mt-4 border-t border-[#d8dee9] pt-4">
                <h3 className="text-sm font-black">Import From PDF</h3>
                <input
                  accept="application/pdf"
                  className="mt-3 block w-full rounded-md border border-[#b7c1ce] bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#eef2ff] file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-[#3730a3]"
                  onChange={(event) =>
                    setPdfFile(event.target.files?.item(0) ?? null)
                  }
                  type="file"
                />
                <button
                  className="mt-3 h-10 w-full rounded-md bg-[#0f766e] px-4 text-sm font-black text-white disabled:opacity-50"
                  disabled={!isUnlocked || !pdfFile || isImporting}
                  onClick={importPdf}
                  type="button"
                >
                  {isImporting ? "Importing..." : "Extract Events From PDF"}
                </button>
                <p className="mt-3 text-xs leading-5 text-[#5d7184]">
                  PDFs can use numbered event blocks like the example: Title,
                  Year, locationName, City, Country, Lat, Lng, and Description.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-[#d8dee9] bg-white p-4 shadow-sm">
              <h2 className="text-base font-black">Queue Controls</h2>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <Stat label="Queued" value={counts.queued} />
                <Stat label="Generated" value={counts.generated} />
                <Stat label="Approved" value={counts.approved} />
                <Stat label="Rejected" value={counts.rejected} />
              </div>
              <button
                className="mt-3 h-10 w-full rounded-md border border-[#111827] px-4 text-sm font-black text-[#111827] disabled:opacity-50"
                disabled={
                  !drafts.some((draft) => draft.status === "queued") ||
                  Boolean(busyId) ||
                  isBatchGenerating
                }
                onClick={generateNext}
                type="button"
              >
                Generate Next Queued
              </button>
              <button
                className="mt-2 h-10 w-full rounded-md bg-[#111827] px-4 text-sm font-black text-white disabled:opacity-50"
                disabled={
                  !drafts.some((draft) => draft.status === "queued") ||
                  Boolean(busyId) ||
                  isBatchGenerating
                }
                onClick={generateAllQueued}
                type="button"
              >
                {isBatchGenerating ? "Generating Queue..." : "Generate All Queued"}
              </button>
            </div>
          </aside>

          <section className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {(["all", "queued", "generated", "approved", "rejected"] as const).map(
                (status) => (
                  <button
                    className={`h-9 rounded-md px-3 text-sm font-bold ${
                      statusFilter === status
                        ? "bg-[#111827] text-white"
                        : "border border-[#c7d0dc] bg-white text-[#283647]"
                    }`}
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    type="button"
                  >
                    {status}
                  </button>
                ),
              )}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {visibleDrafts.map((draft) => (
                <MomentCard
                  busy={busyId === draft.id}
                  draft={draft}
                  key={draft.id}
                  onAction={runAction}
                  onChange={updateDraft}
                  onDelete={(item) => runAction("delete", item)}
                  onLocationChange={updateLocation}
                  onPreview={setPreviewDraft}
                />
              ))}
            </div>
          </section>
        </section>
      </div>

      {previewDraft?.imageUrl ? (
        <div
          className="fixed inset-0 z-50 bg-[#07121f] text-white"
          role="dialog"
          aria-modal="true"
          aria-label={`${previewDraft.title} 360 preview`}
        >
          <PanoramaScene
            imageUrl={`${previewDraft.imageUrl}?v=${encodeURIComponent(
              previewDraft.updatedAt,
            )}`}
            isDimmed={false}
            title={previewDraft.title}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-4">
            <div className="pointer-events-auto flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/65">
                  360 Preview
                </p>
                <h2 className="mt-1 text-xl font-black leading-tight">
                  {previewDraft.title}
                </h2>
                <p className="mt-1 text-sm text-white/75">
                  Drag to look around. Scroll to zoom.
                </p>
              </div>
              <button
                className="rounded-md bg-white px-4 py-2 text-sm font-black text-[#111827]"
                onClick={() => setPreviewDraft(null)}
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-[#f3f6fa] p-3">
      <p className="text-xs font-bold uppercase text-[#5d7184]">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function MomentCard({
  busy,
  draft,
  onAction,
  onChange,
  onDelete,
  onLocationChange,
  onPreview,
}: {
  busy: boolean;
  draft: MomentDraft;
  onAction: (action: string, draft: MomentDraft) => Promise<void>;
  onChange: (id: string, updates: Partial<MomentDraft>) => void;
  onDelete: (draft: MomentDraft) => Promise<void>;
  onLocationChange: (
    id: string,
    updates: Partial<MomentDraft["actualLocation"]>,
  ) => void;
  onPreview: (draft: MomentDraft) => void;
}) {
  return (
    <article className="overflow-hidden rounded-lg border border-[#d8dee9] bg-white shadow-sm">
      <div className="aspect-[3/2] bg-[#dfe6ef]">
        {draft.imageUrl ? (
          <button
            className="group relative block h-full w-full overflow-hidden text-left"
            onClick={() => onPreview(draft)}
            type="button"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt=""
              className="h-full w-full object-cover transition group-hover:scale-[1.02]"
              src={`${draft.imageUrl}?v=${encodeURIComponent(draft.updatedAt)}`}
            />
            <span className="absolute bottom-3 right-3 rounded-md bg-black/72 px-3 py-1.5 text-xs font-black uppercase text-white shadow-lg">
              View 360
            </span>
          </button>
        ) : (
          <div className="flex h-full items-center justify-center text-sm font-bold text-[#5d7184]">
            No image generated
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-[#5d7184]">
              {draft.status}
            </p>
            <p className="mt-1 break-words font-mono text-xs text-[#7a8ca1]">
              {draft.id}
            </p>
          </div>
          <button
            className="rounded-md border border-[#ef4444] px-3 py-1.5 text-xs font-black text-[#b91c1c] disabled:opacity-50"
            disabled={busy}
            onClick={() => onDelete(draft)}
            type="button"
          >
            Delete
          </button>
        </div>

        <Field
          label="Title"
          onChange={(title) => onChange(draft.id, { title })}
          value={draft.title}
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            label="Year"
            onChange={(value) =>
              onChange(draft.id, { actualYear: Number(value) || draft.actualYear })
            }
            type="number"
            value={String(draft.actualYear)}
          />
          <Field
            label="Latitude"
            onChange={(value) =>
              onLocationChange(draft.id, {
                lat: Number(value) || draft.actualLocation.lat,
              })
            }
            type="number"
            value={String(draft.actualLocation.lat)}
          />
          <Field
            label="Longitude"
            onChange={(value) =>
              onLocationChange(draft.id, {
                lng: Number(value) || draft.actualLocation.lng,
              })
            }
            type="number"
            value={String(draft.actualLocation.lng)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            label="Venue"
            onChange={(name) => onLocationChange(draft.id, { name })}
            value={draft.actualLocation.name}
          />
          <Field
            label="City"
            onChange={(city) => onLocationChange(draft.id, { city })}
            value={draft.actualLocation.city}
          />
          <Field
            label="Country"
            onChange={(country) => onLocationChange(draft.id, { country })}
            value={draft.actualLocation.country}
          />
        </div>

        <Field
          label="Sport"
          onChange={(sport) => onChange(draft.id, { sport })}
          value={draft.sport ?? ""}
        />

        <TextArea
          label="Description"
          onChange={(description) => onChange(draft.id, { description })}
          value={draft.description}
        />

        <TextArea
          label="Reference Notes"
          onChange={(referenceNotes) => onChange(draft.id, { referenceNotes })}
          value={draft.referenceNotes ?? ""}
        />

        <TextArea
          label="Generated Prompt"
          onChange={(prompt) => onChange(draft.id, { prompt })}
          value={draft.prompt ?? ""}
        />

        {draft.error ? (
          <p className="rounded-md bg-[#fef2f2] p-3 text-sm text-[#991b1b]">
            {draft.error}
          </p>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-3">
          <button
            className="h-10 rounded-md bg-[#2563eb] px-3 text-sm font-black text-white disabled:opacity-50"
            disabled={busy}
            onClick={() => onAction("generate", draft)}
            type="button"
          >
            {busy ? "Working..." : draft.imageUrl ? "Regenerate" : "Generate"}
          </button>
          <button
            className="h-10 rounded-md bg-[#15803d] px-3 text-sm font-black text-white disabled:opacity-50"
            disabled={busy || !draft.imageUrl}
            onClick={() => onAction("approve", draft)}
            type="button"
          >
            Approve
          </button>
          <button
            className="h-10 rounded-md border border-[#b45309] px-3 text-sm font-black text-[#92400e] disabled:opacity-50"
            disabled={busy}
            onClick={() => onAction("reject", draft)}
            type="button"
          >
            Reject
          </button>
        </div>
      </div>
    </article>
  );
}

function Field({
  label,
  onChange,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-bold uppercase text-[#5d7184]">{label}</span>
      <input
        className="h-10 min-w-0 rounded-md border border-[#b7c1ce] bg-white px-3 text-sm outline-none focus:border-[#2563eb]"
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </label>
  );
}

function TextArea({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-bold uppercase text-[#5d7184]">{label}</span>
      <textarea
        className="min-h-24 resize-y rounded-md border border-[#b7c1ce] bg-white p-3 text-sm leading-5 outline-none focus:border-[#2563eb]"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}
