import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import type { Round, RoundLocation } from "@/types/game";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MomentStatus = "queued" | "generated" | "approved" | "rejected";

type MomentDraft = {
  id: string;
  title: string;
  actualYear: number;
  actualLocation: RoundLocation;
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

type ImportedMoment = Omit<
  MomentDraft,
  "createdAt" | "error" | "id" | "imageUrl" | "status" | "updatedAt"
>;

type ImportStore = {
  drafts: MomentDraft[];
};

const rootDir = process.cwd();
const storePath = path.join(rootDir, "data", "momentImports.json");
const importedRoundsPath = path.join(rootDir, "data", "importedRounds.ts");
const roundsPublicDir = path.join(rootDir, "public", "rounds");
const draftPublicDir = path.join(rootDir, "public", "moment-drafts");

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);

  if (auth) {
    return auth;
  }

  const store = await readStore();

  return NextResponse.json({
    drafts: store.drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    imageModel: getImageModel(),
  });
}

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);

  if (auth) {
    return auth;
  }

  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    return importPdfMoments(request);
  }

  const body = await request.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "";

  if (action === "import") {
    return importMoments(body);
  }

  if (action === "generate") {
    return generateMoment(body);
  }

  if (action === "approve") {
    return approveMoment(body);
  }

  if (action === "reject") {
    return updateMomentStatus(body?.id, "rejected");
  }

  if (action === "delete") {
    return deleteMoment(body?.id);
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

function requireAdmin(request: NextRequest) {
  const configuredPassword = process.env.MOMENT_ADMIN_PASSWORD?.trim();

  if (!configuredPassword) {
    return NextResponse.json(
      { error: "MOMENT_ADMIN_PASSWORD is not configured." },
      { status: 503 },
    );
  }

  const providedPassword = request.headers.get("x-admin-password")?.trim();

  if (providedPassword !== configuredPassword) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return null;
}

async function importMoments(body: unknown) {
  const input = isObject(body) ? body.input : undefined;
  let imported: ImportedMoment[];

  try {
    imported = parseImportInput(input);
  } catch {
    return NextResponse.json(
      { error: "Import input is not valid JSON or CSV." },
      { status: 400 },
    );
  }

  if (imported.length === 0 && typeof input === "string" && input.trim()) {
    try {
      imported = await researchImportedMoments(input);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "OpenAI could not extract moments from the pasted text.",
        },
        { status: 502 },
      );
    }
  }

  if (imported.length === 0) {
    return NextResponse.json(
      {
        error:
          "No valid moments found. Paste structured JSON/CSV/labeled blocks or recognizable event descriptions.",
      },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const store = await readStore();
  const existingIds = new Set(store.drafts.map((draft) => draft.id));
  const drafts = imported.map((moment) => {
    const baseId = slugify(`${moment.actualYear}-${moment.title}`);
    const id = uniqueId(baseId, existingIds);
    existingIds.add(id);

    return {
      ...moment,
      id,
      status: "queued" as const,
      createdAt: now,
      updatedAt: now,
    };
  });

  store.drafts.push(...drafts);
  await writeStore(store);

  return NextResponse.json({ drafts, count: drafts.length });
}

async function importPdfMoments(request: NextRequest) {
  const formData = await request.formData();
  const action = formData.get("action");
  const file = formData.get("file");

  if (action !== "importPdf") {
    return NextResponse.json({ error: "Unknown multipart action." }, { status: 400 });
  }

  if (!(file instanceof File) || file.type !== "application/pdf") {
    return NextResponse.json({ error: "Upload a PDF file." }, { status: 400 });
  }

  try {
    const text = await extractPdfText(file);

    return importMoments({ input: text });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to extract events from the PDF.",
      },
      { status: 400 },
    );
  }
}

async function generateMoment(body: unknown) {
  const id = isObject(body) && typeof body.id === "string" ? body.id : "";
  const store = await readStore();
  const draft = store.drafts.find((item) => item.id === id);

  if (!draft) {
    return NextResponse.json({ error: "Moment not found." }, { status: 404 });
  }

  try {
    const referenceNotes = await researchVisualReference(draft);
    draft.referenceNotes = referenceNotes || draft.referenceNotes;
    draft.prompt = draft.prompt?.trim() || buildImagePrompt(draft);
    const imageBytes = await generateImage(draft);
    await mkdir(draftPublicDir, { recursive: true });
    await writeFile(path.join(draftPublicDir, `${draft.id}.png`), imageBytes);
    draft.imageUrl = `/moment-drafts/${draft.id}.png`;
    draft.status = "generated";
    draft.error = undefined;
    draft.updatedAt = new Date().toISOString();
    await writeStore(store);

    return NextResponse.json({ draft });
  } catch (error) {
    draft.error = error instanceof Error ? error.message : "Image generation failed.";
    draft.updatedAt = new Date().toISOString();
    await writeStore(store);

    return NextResponse.json({ error: draft.error, draft }, { status: 502 });
  }
}

async function approveMoment(body: unknown) {
  const id = isObject(body) && typeof body.id === "string" ? body.id : "";
  const updates = isObject(body) && isObject(body.updates) ? body.updates : {};
  const store = await readStore();
  const draft = store.drafts.find((item) => item.id === id);

  if (!draft) {
    return NextResponse.json({ error: "Moment not found." }, { status: 404 });
  }

  if (!draft.imageUrl) {
    return NextResponse.json(
      { error: "Generate an image before approval." },
      { status: 400 },
    );
  }

  applyDraftUpdates(draft, updates);
  await mkdir(roundsPublicDir, { recursive: true });
  const sourcePath = path.join(rootDir, "public", draft.imageUrl);
  const finalFileName = `${draft.id}.png`;
  const finalPath = path.join(roundsPublicDir, finalFileName);
  const imageBytes = await readFile(sourcePath);
  await writeFile(finalPath, imageBytes);
  draft.imageUrl = `/rounds/${finalFileName}`;
  draft.status = "approved";
  draft.error = undefined;
  draft.updatedAt = new Date().toISOString();
  await writeStore(store);
  await writeImportedRounds(store.drafts);

  return NextResponse.json({ draft });
}

async function updateMomentStatus(id: unknown, status: MomentStatus) {
  if (typeof id !== "string") {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  const store = await readStore();
  const draft = store.drafts.find((item) => item.id === id);

  if (!draft) {
    return NextResponse.json({ error: "Moment not found." }, { status: 404 });
  }

  draft.status = status;
  draft.updatedAt = new Date().toISOString();
  await writeStore(store);

  return NextResponse.json({ draft });
}

async function deleteMoment(id: unknown) {
  if (typeof id !== "string") {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  const store = await readStore();
  store.drafts = store.drafts.filter((draft) => draft.id !== id);
  await writeStore(store);
  await writeImportedRounds(store.drafts);

  return NextResponse.json({ ok: true });
}

async function generateImage(draft: MomentDraft) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getImageModel(),
      prompt: draft.prompt?.trim() || buildImagePrompt(draft),
      n: 1,
      size: process.env.OPENAI_IMAGE_SIZE ?? "1536x1024",
      quality: process.env.OPENAI_IMAGE_QUALITY ?? "medium",
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(readOpenAIError(payload) ?? `OpenAI returned ${response.status}.`);
  }

  const base64 = payload?.data?.[0]?.b64_json;

  if (typeof base64 !== "string") {
    throw new Error("OpenAI response did not include image data.");
  }

  return Buffer.from(base64, "base64");
}

function buildImagePrompt(draft: MomentDraft) {
  const sportLogic = getSportPromptAdditions(draft);
  const negativeAdditions = getSportNegativeAdditions(draft);

  return [
    "Ultra-realistic immersive sports environment designed as a TRUE CONTINUOUS CYLINDRICAL VENUE SHELL for seamless EQUIRECTANGULAR 360 VR WORLD viewing.",
    "",
    "CUSTOM EVENT DESCRIPTION",
    `EVENT: ${draft.title}`,
    `Event year: ${draft.actualYear}.`,
    `Location: ${draft.actualLocation.name}, ${draft.actualLocation.city}, ${draft.actualLocation.country}.`,
    `Description: ${draft.description}`,
    draft.referenceNotes
      ? `Visual reference research notes from web search: ${draft.referenceNotes}`
      : "",
    "",
    "REFERENCE IMAGE USAGE",
    "Use visual reference research only as inspiration for athlete positioning, crowd energy, emotional atmosphere, venue geometry, lighting realism, historical realism, sports authenticity, spectator perspective, and environmental composition.",
    "Do NOT recreate a standard sports photograph, television screenshot, cinematic poster, close-up action shot, or promotional render.",
    "Recreate the entire environment around the viewer as a believable immersive spectator memory inside a massive real-world venue during one of the greatest moments in sports history.",
    "",
    "HISTORIC MOMENT COMPOSITION RULE",
    "The defining historic moment MUST remain immediately recognizable, visually centered, compositionally isolated, readable even in full panoramic form, and naturally framed by the environment.",
    "The viewer's eyes should immediately lock onto the exact moment history happened.",
    "The event should never feel tiny inside the environment, visually lost, overwhelmed by crowd detail, or difficult to identify in VR.",
    "The defining action moment should occupy approximately 30-45% of the total panoramic width, near the visual center horizon, sharply readable in wide panoramic form.",
    "",
    "TRUE 360 VR WORLD REQUIREMENT",
    "The final image MUST function as a TRUE EQUIRECTANGULAR 360 VR WORLD. It must wrap seamlessly left-to-right, support immersive VR viewing, allow natural environmental rotation, feel physically explorable, and behave like a real venue environment.",
    "The viewer is seated or standing along the edge of the playing surface or venue environment, not at the center of a spherical environment.",
    "The field/court/course/stadium extends primarily forward from the viewer. The environment wraps horizontally around the viewer like real architecture or real outdoor space.",
    "Do not create a fisheye photo, panoramic bubble, tiny-planet render, spherical dome, warped 360 sphere, GoPro effect, stretched sports photograph, panoramic donut, curved sports field, or dome projection.",
    "",
    "PROJECTION & GEOMETRY RULES",
    "The environment behaves like a horizontal cylindrical venue wrap. Straight environmental lines should remain mostly straight and realistic. Playing surfaces must remain flat where appropriate, geographically realistic, naturally proportioned, physically believable, stable, grounded, and level.",
    "Avoid fisheye warping, spherical distortion, warped playing surfaces, curved floors, bent sidelines, warped baselines, panoramic stretching, concave center distortion, and environmental collapse toward center.",
    "",
    "EQUIRECTANGULAR EDGE RULE",
    "The far left and far right edges of the image MUST contain matching environmental continuity. Edge geometry, crowd density, lighting, and environmental depth should align naturally so the image loops seamlessly in VR with no visible seam.",
    "The image edges should feel like adjacent neighboring sections of the same venue with uninterrupted crowd geometry, realistic seating continuation, seamless lighting continuity, and believable environmental wrapping.",
    "",
    "VIEWER PERSPECTIVE",
    "Viewer positioned front-row, lower bowl, courtside/sideline/foul-line/gallery edge depending on sport, inside a premium unobstructed position, at natural seated or standing human eye level.",
    "The lower foreground must remain clean and open toward the action. No photographers, television cameras, giant foreground heads, media towers, kneeling cameramen, front-row congestion, or obstructive silhouettes directly in front of the POV.",
    "",
    "REALISM REQUIREMENTS",
    "Indistinguishable from a real historical sports photograph, genuine VR venue capture, documentary sports imagery, and physically captured environmental photography.",
    "Extreme realism: realistic skin textures, authentic crowd density variation, believable lighting and shadows, natural environmental haze, subtle film grain, authentic lens imperfections, realistic exposure falloff, true-to-life color response, era-accurate photography feel, realistic motion blur only where appropriate, and physically accurate environmental scale.",
    "Crowds should feel organic, emotional, reactive, chaotic, and human. Avoid plastic skin, AI-looking faces, repeated crowd patterns, synthetic lighting, fake cinematic glow, hyper symmetry, HDR overprocessing, and over-sharpening.",
    "",
    "CAMERA CHARACTERISTICS",
    "Professional sports photography realism, natural human eye-level perspective, 24mm-35mm equivalent lens feel, deep environmental depth, sharp central action focus, realistic exposure behavior, authentic documentary sports realism, natural lighting response, realistic dynamic range.",
    "",
    sportLogic,
    "",
    "NEGATIVE PROMPT",
    [
      "fisheye distortion",
      "spherical warping",
      "tiny planet effect",
      "panoramic bubble distortion",
      "donut-world effect",
      "floating camera",
      "curved playing surfaces",
      "warped geometry",
      "impossible perspective",
      "panoramic tunnel distortion",
      "environmental collapse toward center",
      "stretched edges",
      "disconnected seams",
      "duplicated players",
      "duplicated balls/pucks",
      "mirrored crowd",
      "repeated spectators",
      "warped anatomy",
      "obstructed premium POV",
      "giant foreground heads",
      "photographers blocking foreground",
      "synthetic lighting",
      "cartoon look",
      "fake HDR glow",
      "AI artifacts",
      "blurry central action",
      "over-cinematic composition",
      "unrealistic venue curvature",
      negativeAdditions,
    ]
      .filter(Boolean)
      .join(", "),
    "",
    "OUTPUT GOAL",
    "Create a TRUE 360 VR WORLD sports environment that feels like a real spectator memory captured live during one of the greatest moments in sports history.",
    "The viewer should genuinely feel: I am physically inside this venue witnessing this historic moment happen in real life.",
  ].join("\n");
}

function getImageModel() {
  return process.env.OPENAI_IMAGE_MODEL ?? "chatgpt-image-latest";
}

async function researchImportedMoments(input: string): Promise<ImportedMoment[]> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to extract freeform event descriptions.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_RESEARCH_MODEL ?? "gpt-5-mini",
      tools: [{ type: "web_search" }],
      text: {
        format: {
          type: "json_schema",
          name: "sports_moment_imports",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              moments: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    title: { type: "string" },
                    actualYear: { type: "number" },
                    actualLocation: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        name: { type: "string" },
                        city: { type: "string" },
                        country: { type: "string" },
                        lat: { type: "number" },
                        lng: { type: "number" },
                      },
                      required: ["name", "city", "country", "lat", "lng"],
                    },
                    description: { type: "string" },
                    sport: { type: "string" },
                    referenceNotes: { type: "string" },
                  },
                  required: [
                    "title",
                    "actualYear",
                    "actualLocation",
                    "description",
                    "sport",
                    "referenceNotes",
                  ],
                },
              },
            },
            required: ["moments"],
          },
        },
      },
      input: [
        {
          role: "system",
          content:
            "Extract sports moments from pasted text. Use web search to verify year, venue, city, country, coordinates, sport, and the visual appearance of the iconic moment. Return only structured JSON. If multiple moments are pasted, return all of them.",
        },
        {
          role: "user",
          content: input,
        },
      ],
    }),
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(readOpenAIError(payload) ?? `OpenAI returned ${response.status}.`);
  }

  const outputText = readResponseOutputText(payload);
  const parsed = JSON.parse(outputText) as { moments?: unknown[] };

  return (parsed.moments ?? [])
    .map(normalizeMoment)
    .filter((moment): moment is ImportedMoment => isImportedMoment(moment));
}

async function researchVisualReference(draft: MomentDraft) {
  if (process.env.OPENAI_ENABLE_VISUAL_RESEARCH === "false") {
    return draft.referenceNotes ?? "";
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_RESEARCH_MODEL ?? "gpt-5-mini",
      tools: [{ type: "web_search" }],
      input: [
        {
          role: "system",
          content:
            "Research the most recognizable published images and footage stills of a historic sports event. Do not reproduce copyrighted photos. Summarize only visual facts needed to create a historically faithful but original immersive 360 scene.",
        },
        {
          role: "user",
          content: [
            `Event: ${draft.title}`,
            `Year: ${draft.actualYear}`,
            `Venue: ${draft.actualLocation.name}, ${draft.actualLocation.city}, ${draft.actualLocation.country}`,
            `Description: ${draft.description}`,
            "Return concise visual reference notes covering athlete/body positioning, uniforms or era details, crowd reaction, camera/viewpoint cues, venue geometry, lighting, and the exact recognizable action moment.",
          ].join("\n"),
        },
      ],
    }),
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(readOpenAIError(payload) ?? `OpenAI returned ${response.status}.`);
  }

  return readResponseOutputText(payload).slice(0, 4000);
}

function parseImportInput(input: unknown): ImportedMoment[] {
  if (Array.isArray(input)) {
    return input
      .map(normalizeMoment)
      .filter((moment): moment is ImportedMoment => isImportedMoment(moment));
  }

  if (typeof input !== "string") {
    return [];
  }

  const trimmed = input.trim();

  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed);
    const items = Array.isArray(parsed) ? parsed : [parsed];

    return items
      .map(normalizeMoment)
      .filter((moment): moment is ImportedMoment => isImportedMoment(moment));
  }

  if (looksLikeCsv(trimmed)) {
    return parseCsv(trimmed)
      .map(normalizeMoment)
      .filter((moment): moment is ImportedMoment => isImportedMoment(moment));
  }

  return parseLabeledMoments(trimmed)
    .map(normalizeMoment)
    .filter((moment): moment is ImportedMoment => isImportedMoment(moment));
}

function normalizeMoment(value: unknown): ImportedMoment | null {
  if (!isObject(value)) {
    return null;
  }

  const title = stringValue(value.title);
  const actualYear = numberValue(value.actualYear ?? value.year);
  const name = stringValue(value.locationName ?? value.name ?? value.venue);
  const city = stringValue(value.city);
  const country = stringValue(value.country);
  const lat = numberValue(value.lat ?? value.latitude);
  const lng = numberValue(value.lng ?? value.longitude);
  const description = stringValue(value.description);
  const prompt = stringValue(value.prompt);
  const sport = stringValue(value.sport);
  const referenceNotes = stringValue(value.referenceNotes);

  const moment: ImportedMoment = {
    title,
    actualYear,
    actualLocation: { name, city, country, lat, lng },
    description,
  };

  if (prompt) {
    moment.prompt = prompt;
  }

  if (sport) {
    moment.sport = sport;
  }

  if (referenceNotes) {
    moment.referenceNotes = referenceNotes;
  }

  return moment;
}

function isImportedMoment(value: ReturnType<typeof normalizeMoment>): value is ImportedMoment {
  return Boolean(
    value &&
      value.title &&
      Number.isFinite(value.actualYear) &&
      value.actualLocation.name &&
      value.actualLocation.city &&
      value.actualLocation.country &&
      Number.isFinite(value.actualLocation.lat) &&
      Number.isFinite(value.actualLocation.lng) &&
      value.description,
  );
}

function parseCsv(input: string) {
  const rows = input
    .split(/\r?\n/)
    .map(parseCsvLine)
    .filter((row) => row.some((cell) => cell.trim()));
  const headers = rows[0]?.map((header) => header.trim()) ?? [];

  return rows.slice(1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
  );
}

function looksLikeCsv(input: string) {
  const firstLine = input.split(/\r?\n/, 1)[0] ?? "";

  return firstLine.includes(",") && /title/i.test(firstLine) && /year/i.test(firstLine);
}

function parseLabeledMoments(input: string) {
  const blocks = input
    .replace(/\r/g, "")
    .split(/\n(?=\s*\d+\.\s+)/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map(parseLabeledMoment);
}

function parseLabeledMoment(block: string) {
  const title = readLabel(block, "title") || readHeadingTitle(block);
  const year = readLabel(block, "year");
  const locationName =
    readLabel(block, "locationName") ||
    readLabel(block, "location name") ||
    readLabel(block, "venue") ||
    readLabel(block, "name");
  const city = readLabel(block, "city");
  const country = readLabel(block, "country");
  const lat = readLabel(block, "lat") || readLabel(block, "latitude");
  const lng =
    readLabel(block, "lng") ||
    readLabel(block, "long") ||
    readLabel(block, "longitude");
  const description = readDescription(block);
  const prompt = readLabel(block, "prompt");

  return {
    title,
    year,
    locationName,
    city,
    country,
    lat,
    lng,
    description,
    prompt,
  };
}

function readHeadingTitle(block: string) {
  const heading = block.match(/^\s*\d+\.\s*(.+?)\s*$/m)?.[1]?.trim();

  return heading ?? "";
}

function readLabel(block: string, label: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^\\s*${escapedLabel}\\s*:\\s*(.+?)\\s*$`, "im");

  return block.match(pattern)?.[1]?.trim() ?? "";
}

function readDescription(block: string) {
  const match = block.match(
    /^\s*description\s*:\s*([\s\S]*?)(?=\n\s*(?:prompt|title|year|locationName|location name|venue|name|city|country|lat|latitude|lng|long|longitude)\s*:|$)/im,
  );

  return match?.[1]?.replace(/\s+/g, " ").trim() ?? "";
}

async function extractPdfText(file: File) {
  const loadPdfParse = new Function("specifier", "return import(specifier)") as (
    specifier: string,
  ) => Promise<typeof import("pdf-parse")>;
  const { PDFParse } = await loadPdfParse("pdf-parse");
  const buffer = Buffer.from(await file.arrayBuffer());
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();

    return result.text;
  } finally {
    await parser.destroy();
  }
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const next = line[index + 1];

    if (character === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += character;
    }
  }

  cells.push(current);

  return cells;
}

async function readStore(): Promise<ImportStore> {
  try {
    const content = await readFile(storePath, "utf8");
    const parsed = JSON.parse(content);

    if (Array.isArray(parsed.drafts)) {
      return parsed;
    }
  } catch {
    return { drafts: [] };
  }

  return { drafts: [] };
}

async function writeStore(store: ImportStore) {
  await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`);
}

async function writeImportedRounds(drafts: MomentDraft[]) {
  const approvedRounds = drafts
    .filter((draft) => draft.status === "approved")
    .map(draftToRound);
  const content = [
    'import type { Round } from "@/types/game";',
    "",
    "// Generated by the password-protected moment import tool.",
    "// Approved imported rounds are written here so they become part of the app.",
    `export const importedRounds: Round[] = ${JSON.stringify(approvedRounds, null, 2)};`,
    "",
  ].join("\n");

  await writeFile(importedRoundsPath, content);
}

function draftToRound(draft: MomentDraft): Round {
  return {
    id: draft.id,
    title: draft.title,
    imageUrl: draft.imageUrl ?? "",
    actualYear: draft.actualYear,
    actualLocation: draft.actualLocation,
    description: draft.description,
  };
}

function applyDraftUpdates(draft: MomentDraft, updates: Record<string, unknown>) {
  const title = stringValue(updates.title);
  const actualYear = numberValue(updates.actualYear);
  const description = stringValue(updates.description);
  const prompt = stringValue(updates.prompt);
  const sport = stringValue(updates.sport);
  const referenceNotes = stringValue(updates.referenceNotes);
  const location = isObject(updates.actualLocation) ? updates.actualLocation : {};
  const name = stringValue(location.name);
  const city = stringValue(location.city);
  const country = stringValue(location.country);
  const lat = numberValue(location.lat);
  const lng = numberValue(location.lng);

  if (title) draft.title = title;
  if (Number.isFinite(actualYear)) draft.actualYear = actualYear;
  if (description) draft.description = description;
  draft.prompt = prompt;
  draft.sport = sport;
  draft.referenceNotes = referenceNotes;
  if (name) draft.actualLocation.name = name;
  if (city) draft.actualLocation.city = city;
  if (country) draft.actualLocation.country = country;
  if (Number.isFinite(lat)) draft.actualLocation.lat = lat;
  if (Number.isFinite(lng)) draft.actualLocation.lng = lng;
}

function readOpenAIError(payload: unknown) {
  if (!isObject(payload)) {
    return null;
  }

  if (isObject(payload.error) && typeof payload.error.message === "string") {
    return payload.error.message;
  }

  return null;
}

function readResponseOutputText(payload: unknown) {
  if (!isObject(payload)) {
    return "";
  }

  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }

  if (!Array.isArray(payload.output)) {
    return "";
  }

  return payload.output
    .flatMap((item) => (isObject(item) && Array.isArray(item.content) ? item.content : []))
    .map((content) => {
      if (!isObject(content)) {
        return "";
      }

      return typeof content.text === "string" ? content.text : "";
    })
    .filter(Boolean)
    .join("\n");
}

function getSportPromptAdditions(draft: MomentDraft) {
  const sport = inferSport(draft);

  if (sport === "basketball") {
    return [
      "BASKETBALL ENVIRONMENT LOGIC",
      "Viewer seated courtside or front-row lower bowl. Camera height approximately seated human eye level. Hardwood court remains completely flat and rectangular. Baselines and sidelines remain straight with no curvature. Arena bowl wraps horizontally around viewer. Hoop and backboard clearly visible and proportionally realistic.",
      "Historic action occurs near the free throw line, top of key, rim, or corner three depending on event.",
      /jordan|1998|bryon russell|last shot/i.test(`${draft.title} ${draft.description}`)
        ? "For the Jordan 1998 shot: POV from opposite lower bowl side, watching Jordan create separation from Bryon Russell near the top of key/right elbow. Utah crowd frozen in anticipation. Bulls bench and media table visible peripherally. Delta Center atmosphere tense, loud, historic, emotionally suspended."
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (sport === "baseball") {
    return [
      "BASEBALL ENVIRONMENT LOGIC",
      "Viewer seated front-row near foul line or behind home plate. Baseball diamond remains geographically correct. Baselines remain straight. Outfield extends naturally into distance. Stadium bowl wraps horizontally. Dirt, grass, warning track, and foul territory remain realistic.",
      /bonds|756|home run/i.test(`${draft.title} ${draft.description}`)
        ? "For Barry Bonds 756: POV from opposite side of stadium relative to left field home run trajectory. Viewer sees ball traveling into left-center stands. Barry Bonds remains visible near batter's box/follow-through. Crowd eruption isolated around landing area. McCovey Cove atmosphere visible in distance. Night game lighting realism critical."
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (sport === "soccer") {
    return [
      "SOCCER ENVIRONMENT LOGIC",
      "Viewer seated front-row lower bowl near sideline or behind goal. Pitch remains perfectly flat and geographically realistic. Goal structure proportionally accurate. Stadium scale should feel massive and atmospheric. Crowd choreography and density highly emphasized.",
      "The field MUST extend naturally forward from the viewer with realistic penalty-box geometry and a properly proportioned goal area.",
      /maradona|hand of god/i.test(`${draft.title} ${draft.description}`)
        ? "For Maradona Hand of God: POV from lower bowl stands behind goal. Goal clearly visible. Maradona and goalkeeper isolated near penalty area. Event centered around aerial handball moment. Azteca Stadium scale enormous. Historic 1986 atmosphere with analog broadcast realism, midday Mexico sunlight, vintage crowd density, slight film grain."
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (sport === "golf") {
    return [
      "GOLF ENVIRONMENT LOGIC",
      "Viewer positioned front-row behind gallery ropes at natural human eye level. Fairway and green contours remain realistic and subtle. Trees wrap naturally around course environment. Gallery surrounds green organically. No stadium-style seating. Environment behaves like real outdoor space.",
      "The putting surface should remain naturally sloped but never warped or curved unnaturally by panoramic distortion.",
      /tiger|woods|chip|masters|augusta/i.test(`${draft.title} ${draft.description}`)
        ? "For Tiger 2005 chip-in: Viewer positioned beside 16th green near gallery rope. Tiger located on fringe just off green. Hole location clearly visible near upper green slope. Ball path visually readable. Green contour realism critical. Augusta sunlight filtering through trees. Crowd tension before eruption. Ball visibly approaching cup."
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (sport === "track") {
    return [
      "TRACK AND FIELD ENVIRONMENT LOGIC",
      "Viewer seated front-row near podium or track rail. Running track remains perfectly oval and planar. Stadium architecture wraps naturally around viewer. Olympic scale emphasized. Historic ceremony atmosphere prioritized.",
      /jesse owens|owens|1936|berlin/i.test(`${draft.title} ${draft.description}`)
        ? "For Jesse Owens 1936: POV from lower bowl facing medal podium. Jesse Owens visually isolated on podium. Nazi-era Berlin stadium architecture visible. Massive Olympic crowd surrounding venue. Historical tension and atmosphere emphasized. Natural daylight realism. Vintage 1930s documentary photography aesthetic."
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (sport === "hockey") {
    return [
      "HOCKEY ENVIRONMENT LOGIC",
      "Viewer seated front-row lower bowl behind glass or just above rink boards with unobstructed view. Ice rink remains flat and regulation-shaped. Boards, glass, blue lines, goal crease, and rink perspective remain straight and proportionally accurate. Arena seating wraps horizontally around viewer.",
      /miracle|lake placid|soviet|hockey/i.test(`${draft.title} ${draft.description}`)
        ? "For Miracle on Ice: Olympic Center atmosphere, 1980 uniforms and equipment, players clustered in urgent motion on flat ice, American crowd energy building toward disbelief and eruption, cold arena lighting, documentary broadcast realism."
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return "SPORT-SPECIFIC ENVIRONMENT LOGIC\nUse the exact sport's real venue geometry, field markings, equipment scale, athlete spacing, and spectator layout. Preserve flat playing surfaces and believable human eye-level perspective.";
}

function getSportNegativeAdditions(draft: MomentDraft) {
  const sport = inferSport(draft);

  if (sport === "basketball") {
    return "curved basketball court, warped hardwood, floating hoop, distorted backboard, bent sidelines, duplicated players, center-court fisheye effect";
  }

  if (sport === "baseball") {
    return "curved baseball diamond, spherical outfield, bent foul poles, warped infield dirt, duplicated baseballs, floating stadium sections";
  }

  if (sport === "soccer") {
    return "curved soccer field, warped goalposts, spherical pitch, distorted penalty box, floating players, bent touchlines";
  }

  if (sport === "golf") {
    return "warped green, curved putting surface, spherical fairway, distorted bunker edges, floating gallery, curved horizon, bent flagstick";
  }

  if (sport === "track") {
    return "curved running track, distorted podium, floating crowd, warped stadium geometry, fisheye Olympic stadium";
  }

  if (sport === "hockey") {
    return "curved ice rink, warped boards, bent glass, duplicated pucks, floating players, distorted goal crease";
  }

  return "";
}

function inferSport(draft: MomentDraft) {
  const value = `${draft.sport ?? ""} ${draft.title} ${draft.description}`.toLowerCase();

  if (/basketball|nba|jordan|lebron|finals/.test(value)) return "basketball";
  if (/baseball|mlb|home run|bonds|world series/.test(value)) return "baseball";
  if (/soccer|football|fifa|world cup|maradona|ronaldo|goal/.test(value)) {
    return "soccer";
  }
  if (/golf|masters|tiger|woods|augusta|putt|chip/.test(value)) return "golf";
  if (/track|olympic|olympics|jesse owens|podium|sprint/.test(value)) {
    return "track";
  }
  if (/hockey|nhl|stanley cup|miracle on ice|rink|puck/.test(value)) return "hockey";

  return "other";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function uniqueId(baseId: string, existingIds: Set<string>) {
  let id = baseId || "moment";
  let suffix = 2;

  while (existingIds.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return id;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);

  return Number.isFinite(number) ? number : Number.NaN;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
