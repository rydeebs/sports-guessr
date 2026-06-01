import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import type { Round, RoundLevel, RoundLocation } from "@/types/game";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MomentStatus = "queued" | "generated" | "approved" | "rejected";

type MomentDraft = {
  id: string;
  title: string;
  level?: RoundLevel;
  actualYear: number;
  actualMonth: string;
  actualDay: number;
  actualLocation: RoundLocation;
  description: string;
  prompt?: string;
  sport?: string;
  promptRecommendation?: string;
  referenceImageUrl?: string;
  referenceImageUrls?: string[];
  layoutInstructions?: string;
  customPov?: string;
  actionFlow?: string;
  sportRules?: string;
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
const referencePublicDir = path.join(rootDir, "public", "moment-references");
const simpleImagePrompt = [
  "Create one single continuous 360 equirectangular image of this play.",
  "Use the attached image as the primary reference for the best representative angle, player positioning, field/court orientation, and moment composition.",
  "Zoom out slightly from the attached image so the generated scene includes more surrounding field/court, nearby players, sideline or venue context, and breathing room around the action.",
  "Keep the main play clearly readable, but do not crop tightly around the athlete, ball, goal, hoop, or central collision.",
  "Do not create multiple angles, alternate views, panels, tiles, thumbnails, split-screen options, comparison grids, or storyboard frames.",
  "The final output must be one unified 360 scene from one camera position.",
].join("\n");

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
    return handleMultipartAction(request);
  }

  const body = await request.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "";

  if (action === "import") {
    return importMoments(body);
  }

  if (action === "generate") {
    return generateMoment(body);
  }

  if (action === "generatePrompt") {
    return generateMomentPrompt(body);
  }

  if (action === "approve") {
    return approveMoment(body);
  }

  if (action === "improve") {
    return improveMomentPrompt(body);
  }

  if (action === "reject") {
    return updateMomentStatus(body?.id, "rejected");
  }

  if (action === "delete") {
    return deleteMoment(body?.id);
  }

  if (action === "removeReference") {
    return removeReferenceImage(body);
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

async function handleMultipartAction(request: NextRequest) {
  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "importPdf") {
    return importPdfMomentsFromForm(formData);
  }

  if (action === "uploadReference") {
    return uploadReferenceImage(formData);
  }

  return NextResponse.json({ error: "Unknown multipart action." }, { status: 400 });
}

async function importPdfMomentsFromForm(formData: FormData) {
  const file = formData.get("file");

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

async function uploadReferenceImage(formData: FormData) {
  const id = formData.get("id");
  const files = formData.getAll("file");

  if (typeof id !== "string") {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  if (
    files.length === 0 ||
    !files.every((file): file is File => file instanceof File && isSupportedReferenceImage(file))
  ) {
    return NextResponse.json(
      { error: "Upload PNG, JPEG, or WebP reference images." },
      { status: 400 },
    );
  }

  const store = await readStore();
  const draft = store.drafts.find((item) => item.id === id);

  if (!draft) {
    return NextResponse.json({ error: "Moment not found." }, { status: 404 });
  }

  await mkdir(referencePublicDir, { recursive: true });
  const existingReferenceUrls = getReferenceImageUrls(draft);
  const uploadedReferenceUrls: string[] = [];

  for (const [index, file] of files.entries()) {
    const extension = getImageExtension(file);
    const fileName = `${draft.id}-reference-${Date.now()}-${existingReferenceUrls.length + index + 1}.${extension}`;
    const imageBytes = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(referencePublicDir, fileName), imageBytes);
    uploadedReferenceUrls.push(`/moment-references/${fileName}`);
  }

  draft.referenceImageUrls = [...existingReferenceUrls, ...uploadedReferenceUrls];
  draft.referenceImageUrl = draft.referenceImageUrls[0];
  draft.updatedAt = new Date().toISOString();
  await writeStore(store);

  return NextResponse.json({ draft });
}

async function removeReferenceImage(body: unknown) {
  const id = isObject(body) && typeof body.id === "string" ? body.id : "";
  const referenceImageUrl =
    isObject(body) && typeof body.referenceImageUrl === "string"
      ? body.referenceImageUrl
      : "";

  if (!id || !referenceImageUrl) {
    return NextResponse.json(
      { error: "Missing reference image." },
      { status: 400 },
    );
  }

  const store = await readStore();
  const draft = store.drafts.find((item) => item.id === id);

  if (!draft) {
    return NextResponse.json({ error: "Moment not found." }, { status: 404 });
  }

  const remainingReferenceUrls = getReferenceImageUrls(draft).filter(
    (url) => url !== referenceImageUrl,
  );

  draft.referenceImageUrls = remainingReferenceUrls;
  draft.referenceImageUrl = remainingReferenceUrls[0];
  draft.updatedAt = new Date().toISOString();
  await deleteLocalReferenceImage(referenceImageUrl);
  await writeStore(store);

  return NextResponse.json({ draft });
}

async function generateMoment(body: unknown) {
  const id = isObject(body) && typeof body.id === "string" ? body.id : "";
  const updates = isObject(body) && isObject(body.updates) ? body.updates : {};
  const store = await readStore();
  const draft = store.drafts.find((item) => item.id === id);

  if (!draft) {
    return NextResponse.json({ error: "Moment not found." }, { status: 404 });
  }

  applyDraftUpdates(draft, updates);

  try {
    draft.prompt = await createImagePrompt(draft);
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

async function generateMomentPrompt(body: unknown) {
  const id = isObject(body) && typeof body.id === "string" ? body.id : "";
  const updates = isObject(body) && isObject(body.updates) ? body.updates : {};
  const store = await readStore();
  const draft = store.drafts.find((item) => item.id === id);

  if (!draft) {
    return NextResponse.json({ error: "Moment not found." }, { status: 404 });
  }

  applyDraftUpdates(draft, updates);

  try {
    draft.prompt = await createImagePrompt(draft);
    draft.promptRecommendation = undefined;
    draft.error = undefined;
    draft.updatedAt = new Date().toISOString();
    await writeStore(store);

    return NextResponse.json({ draft });
  } catch (error) {
    draft.error =
      error instanceof Error ? error.message : "Prompt generation failed.";
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
  await upsertImportedRounds([draftToRound(draft)]);
  await verifyApprovedMomentSaved(draft, finalPath);
  store.drafts = store.drafts.filter((item) => item.id !== draft.id);
  await writeStore(store);

  return NextResponse.json({ draft });
}

async function improveMomentPrompt(body: unknown) {
  const id = isObject(body) && typeof body.id === "string" ? body.id : "";
  const updates = isObject(body) && isObject(body.updates) ? body.updates : {};
  const store = await readStore();
  const draft = store.drafts.find((item) => item.id === id);

  if (!draft) {
    return NextResponse.json({ error: "Moment not found." }, { status: 404 });
  }

  applyDraftUpdates(draft, updates);

  try {
    draft.promptRecommendation = await recommendPromptImprovement(draft);
    draft.error = undefined;
    draft.updatedAt = new Date().toISOString();
    await writeStore(store);

    return NextResponse.json({ draft });
  } catch (error) {
    draft.error =
      error instanceof Error ? error.message : "Prompt recommendation failed.";
    draft.updatedAt = new Date().toISOString();
    await writeStore(store);

    return NextResponse.json({ error: draft.error, draft }, { status: 502 });
  }
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
  const deletedDraft = store.drafts.find((draft) => draft.id === id);
  store.drafts = store.drafts.filter((draft) => draft.id !== id);
  await writeStore(store);

  if (deletedDraft?.status === "approved") {
    await removeImportedRound(id);
  }

  return NextResponse.json({ ok: true });
}

async function generateImage(draft: MomentDraft) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  if (getReferenceImageUrls(draft).length > 0) {
    return generateImageWithReference(draft, apiKey);
  }

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getImageModel(),
      prompt: simpleImagePrompt,
      n: 1,
      size: process.env.OPENAI_IMAGE_SIZE ?? "1536x1024",
      quality: process.env.OPENAI_IMAGE_QUALITY ?? "medium",
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    if (isSafetyRejection(payload)) {
      return generateImageWithoutReferences(
        apiKey,
        buildSafetyRetryPrompt(draft),
      );
    }

    throw new Error(readOpenAIError(payload) ?? `OpenAI returned ${response.status}.`);
  }

  const base64 = payload?.data?.[0]?.b64_json;

  if (typeof base64 !== "string") {
    throw new Error("OpenAI response did not include image data.");
  }

  return Buffer.from(base64, "base64");
}

async function generateImageWithReference(draft: MomentDraft, apiKey: string) {
  const referenceImageUrls = getReferenceImageUrls(draft);

  if (referenceImageUrls.length === 0) {
    throw new Error("Reference image is missing.");
  }

  const formData = new FormData();

  formData.append("model", getImageModel());
  formData.append("prompt", simpleImagePrompt);
  formData.append("n", "1");
  formData.append("size", process.env.OPENAI_IMAGE_SIZE ?? "1536x1024");
  formData.append("quality", process.env.OPENAI_IMAGE_QUALITY ?? "medium");

  for (const referenceImageUrl of referenceImageUrls) {
    const referencePath = publicPathFromUrl(referenceImageUrl);
    const referenceBytes = await readFile(referencePath);
    formData.append(
      referenceImageUrls.length === 1 ? "image" : "image[]",
      new Blob([referenceBytes], { type: mimeTypeFromUrl(referenceImageUrl) }),
      path.basename(referencePath),
    );
  }

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    if (isSafetyRejection(payload)) {
      return generateImageWithoutReferences(
        apiKey,
        buildSafetyRetryPrompt(draft),
      );
    }

    throw new Error(readOpenAIError(payload) ?? `OpenAI returned ${response.status}.`);
  }

  const base64 = payload?.data?.[0]?.b64_json;

  if (typeof base64 !== "string") {
    throw new Error("OpenAI response did not include image data.");
  }

  return Buffer.from(base64, "base64");
}

async function generateImageWithoutReferences(apiKey: string, prompt: string) {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getImageModel(),
      prompt,
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

async function createImagePrompt(draft: MomentDraft) {
  void draft;
  return simpleImagePrompt;
}

function buildConciseImagePrompt(draft: MomentDraft) {
  void draft;
  return simpleImagePrompt;
}

function buildImagePrompt(draft: MomentDraft) {
  void draft;
  return simpleImagePrompt;
}

function buildDetailedImagePrompt(draft: MomentDraft) {
  const sport = (draft.sport?.trim() || inferSport(draft) || "sports").toUpperCase();
  const customPov =
    draft.customPov?.trim() ||
    "front-row lower-bowl spectator seat near the playing surface, chosen to match the uploaded reference geometry and the historic moment";
  const actionFlow =
    draft.actionFlow?.trim() ||
    "the primary action flows naturally across the viewer's central field of view without crossing the panorama seam";
  const sportRules =
    draft.sportRules?.trim() ||
    draft.layoutInstructions?.trim() ||
    getSportPromptAdditions(draft);
  const negativeAdditions = getSportNegativeAdditions(draft);
  const location = [
    draft.actualLocation.name,
    draft.actualLocation.city,
    draft.actualLocation.country,
  ]
    .filter(Boolean)
    .join(", ");

  return [
    "ULTRA-REALISTIC TRUE 360 VR SPORTS WORLD",
    "",
    "Create an ultra-realistic TRUE EQUIRECTANGULAR 360 VR WORLD sports environment captured as a physically believable live spectator memory inside a real sports venue.",
    "",
    "This must look like:",
    "a real sports photograph",
    "authentic documentary sports imagery",
    "a physically captured live VR environment",
    "a genuine courtside or stadium spectator experience",
    "",
    "NOT:",
    "a video game",
    "cinematic poster",
    "broadcast screenshot",
    "stylized render",
    "fisheye panorama",
    "tiny-planet effect",
    "curved world distortion",
    "CGI environment",
    "",
    "TRUE 360 VR FORMAT RULES",
    "Render as:",
    "TRUE EQUIRECTANGULAR projection",
    "full 2:1 panoramic aspect ratio",
    "seamless left-to-right cylindrical stadium wrap",
    "immersive VR-compatible world",
    "",
    "The image must:",
    "rotate naturally in VR",
    "wrap horizontally like real architecture",
    "preserve realistic environmental geometry",
    "maintain flat level playing surfaces",
    "",
    "360 VIEWER FRAMING RULE",
    "Optimize for viewing inside a 360-degree panorama viewer, not as a flat cropped photograph.",
    "Compose slightly zoomed out with generous surrounding venue context because the 360 viewer will effectively zoom in when mapped onto a sphere.",
    "Keep the viewer physically close enough to feel present, but far enough back that athletes, goals, hoops, field markings, and nearby crowd context remain visible together.",
    "Leave breathing room above, below, and around the defining action so it is comfortable to inspect in VR.",
    "Avoid close-up framing even if the source reference image is tight or cropped.",
    "",
    "NO:",
    "spherical warping",
    "curved courts",
    "warped fields",
    "bent sidelines",
    "fisheye distortion",
    "panoramic bubble distortion",
    "stretched geometry",
    "GoPro look",
    "",
    "CAMERA / POV RULES",
    "Viewer position:",
    customPov,
    "",
    "Viewer eye level:",
    "approximately 1.2 meters above ground",
    "physically attached to a real stadium seat",
    "",
    "Camera must feel:",
    "grounded",
    "stable",
    "human-scale",
    "physically present",
    "",
    "NO:",
    "floating camera",
    "drone angle",
    "crane shot",
    "impossible elevation",
    "broadcast camera positioning",
    "",
    "CUSTOM EVENT BLOCK",
    "SPORT:",
    sport,
    "",
    "EVENT NAME:",
    draft.title,
    "",
    "YEAR:",
    String(draft.actualYear),
    "",
    "LOCATION:",
    location,
    "",
    "CUSTOM EVENT DESCRIPTION:",
    draft.description,
    "",
    "REFERENCE IMAGE GEOMETRY BLOCK",
    "REFERENCE IMAGE USAGE:",
    getReferenceImageUrls(draft).length > 0
      ? "Use the attached images as the PRIMARY REFERENCE for different perspectives and angles of:"
      : "Use the provided reference information as the PRIMARY REFERENCE for:",
    "player positioning",
    "spatial geometry",
    "crowd orientation",
    "focal action placement",
    "body posture",
    "environmental composition",
    "arena/stadium structure",
    "camera perspective",
    "",
    "DO NOT recreate the image exactly.",
    "DO NOT make a broadcast screenshot.",
    getReferenceImageUrls(draft).length > 1
      ? "Synthesize the attached images into one physically coherent spectator POV; do not collage them or create multiple repeated versions of the action."
      : "",
    "ONLY preserve:",
    "the geometry",
    "the timing",
    "the player positioning",
    "the environmental layout",
    "",
    "ACTION COMPOSITION RULES",
    "The defining historic moment should occupy:",
    "approximately 18-30% of the panoramic width",
    "near the central horizon line",
    "",
    "The action must remain:",
    "instantly recognizable",
    "naturally scaled",
    "readable in VR",
    "visually isolated from distractions",
    "",
    "DO NOT:",
    "crop too close",
    "make players gigantic",
    "overfill the VR viewer with the main athlete or ball",
    "hide the play inside crowd detail",
    "place the play across the panorama seam",
    "",
    "PLAYER MOVEMENT & DIRECTION",
    "PRIMARY ACTION DIRECTION:",
    actionFlow,
    "",
    "SPORT-SPECIFIC GEOMETRY",
    sportRules,
    "",
    "CROWD & ATMOSPHERE",
    "Crowd should feel:",
    "organic",
    "chaotic",
    "emotional",
    "reactive",
    "historically authentic",
    "",
    "Include:",
    "realistic arena lighting",
    "subtle film grain",
    "natural exposure",
    "practical reflections",
    "authentic crowd density",
    "realistic motion blur",
    "",
    "Avoid:",
    "repeated faces",
    "AI-looking crowds",
    "empty seating",
    "fake HDR glow",
    "plastic skin textures",
    "",
    "LEFT / RIGHT VR SEAM RULE",
    "The left and right edges MUST align seamlessly:",
    "continuous seating rows",
    "matching lighting",
    "uninterrupted architecture",
    "continuous crowd density",
    "realistic environmental continuity",
    "",
    "NO visible panoramic seam.",
    "",
    "NEGATIVE PROMPT",
    [
      "No fisheye distortion.",
      "No curved floor.",
      "No spherical panorama.",
      "No video game graphics.",
      "No CGI look.",
      "No warped field.",
      "No floating camera.",
      "No repeated crowd patterns.",
      "No duplicated players.",
      "No impossible geometry.",
      "No cinematic poster composition.",
      "No fake HDR glow.",
      "No over-sharpening.",
      "No distorted anatomy.",
      "No action crossing panorama seam.",
      negativeAdditions,
    ]
      .filter(Boolean)
      .join("\n"),
    "",
    "FINAL GOAL",
    "The viewer should genuinely feel:",
    "\"I am physically inside this exact historic sports moment witnessing it live in person.\"",
  ]
    .filter(Boolean)
    .join("\n");
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
                    level: {
                      type: "string",
                      enum: ["Easy", "Medium", "Hard", "Brutal"],
                    },
                    actualYear: { type: "number" },
                    actualMonth: { type: "string" },
                    actualDay: { type: "number" },
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
                    customPov: { type: "string" },
                    actionFlow: { type: "string" },
                    sportRules: { type: "string" },
                  },
                  required: [
                    "title",
                    "level",
                    "actualYear",
                    "actualMonth",
                    "actualDay",
                    "actualLocation",
                    "description",
                    "sport",
                    "customPov",
                    "actionFlow",
                    "sportRules",
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
            "Extract sports moments from pasted text. Use web search to verify the exact year, month, day, venue, city, country, coordinates, sport, and the visual appearance of the iconic moment. Also provide a level from Easy, Medium, Hard, or Brutal; a human spectator customPov; primary actionFlow; and sportRules for realistic 360 equirectangular generation. Return only structured JSON. If multiple moments are pasted, return all of them.",
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

async function recommendPromptImprovement(draft: MomentDraft) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const currentPrompt = draft.prompt?.trim() || buildConciseImagePrompt(draft);
  const referenceImageContent = (
    await Promise.all(
      getReferenceImageUrls(draft).map(async (referenceImageUrl, index) => [
        {
          type: "input_text",
          text: `User-provided reference image ${index + 1} for event appearance, perspective, angle, and composition:`,
        },
        {
          type: "input_image",
          image_url: await imageUrlToDataUrl(referenceImageUrl),
        },
      ]),
    )
  ).flat();
  const imageContent = [
    ...(draft.imageUrl
      ? [
          {
            type: "input_text",
            text: "Generated candidate image to critique:",
          },
          {
            type: "input_image",
            image_url: await imageUrlToDataUrl(draft.imageUrl),
          },
        ]
      : []),
    ...referenceImageContent,
  ];
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_RESEARCH_MODEL ?? "gpt-5-mini",
      input: [
        {
          role: "system",
          content:
            "You are a strict creative director for equirectangular 360 sports image generation. Identify concrete prompt improvements that make the next generation more historically recognizable, more immersive in VR, and less distorted. Do not praise. Return actionable prompt text only.",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `Event: ${draft.title}`,
                `Date: ${draft.actualMonth} ${draft.actualDay}, ${draft.actualYear}`,
                `Sport: ${draft.sport ?? inferSport(draft)}`,
                `Venue: ${draft.actualLocation.name}, ${draft.actualLocation.city}, ${draft.actualLocation.country}`,
                `Description: ${draft.description}`,
                `User field/court layout instructions: ${draft.layoutInstructions ?? ""}`,
                "",
                "Current prompt:",
                currentPrompt,
                "",
                "Task: Recommend a concise replacement/addendum for the prompt that fixes the most likely weaknesses. Focus on exact action readability, athlete scale, 360 edge continuity, flat venue geometry, clean foreground, sport-specific accuracy, and historically recognizable details.",
                "If images are attached, critique visible issues in the generated image and use all reference images to recommend positioning, environment, era details, and emotional atmosphere without copying any reference as a flat photo.",
              ].join("\n"),
            },
            ...imageContent,
          ],
        },
      ],
    }),
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(readOpenAIError(payload) ?? `OpenAI returned ${response.status}.`);
  }

  return readResponseOutputText(payload).slice(0, 6000);
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
  const level = roundLevelValue(value.level);
  const actualYear = numberValue(value.actualYear ?? value.year);
  const actualMonth = monthNameValue(value.actualMonth ?? value.month);
  const actualDay = numberValue(value.actualDay ?? value.day);
  const name = stringValue(value.locationName ?? value.name ?? value.venue);
  const city = stringValue(value.city);
  const country = stringValue(value.country);
  const lat = numberValue(value.lat ?? value.latitude);
  const lng = numberValue(value.lng ?? value.longitude);
  const description = stringValue(value.description);
  const prompt = stringValue(value.prompt);
  const sport = stringValue(value.sport);
  const promptRecommendation = stringValue(value.promptRecommendation);
  const referenceImageUrl = stringValue(value.referenceImageUrl);
  const referenceImageUrls = stringArrayValue(value.referenceImageUrls);
  const layoutInstructions = stringValue(value.layoutInstructions);
  const customPov = stringValue(value.customPov ?? value.pov ?? value.cameraPov);
  const actionFlow = stringValue(value.actionFlow ?? value.primaryActionDirection);
  const sportRules = stringValue(value.sportRules ?? value.sportSpecificGeometry);

  const moment: ImportedMoment = {
    title,
    ...(level ? { level } : {}),
    actualYear,
    actualMonth,
    actualDay,
    actualLocation: { name, city, country, lat, lng },
    description,
  };

  if (prompt) {
    moment.prompt = prompt;
  }

  if (sport) {
    moment.sport = sport;
  }

  if (promptRecommendation) {
    moment.promptRecommendation = promptRecommendation;
  }

  if (referenceImageUrl) {
    moment.referenceImageUrl = referenceImageUrl;
  }

  if (referenceImageUrls.length > 0) {
    moment.referenceImageUrls = referenceImageUrls;
    moment.referenceImageUrl = moment.referenceImageUrl ?? referenceImageUrls[0];
  }

  if (layoutInstructions) {
    moment.layoutInstructions = layoutInstructions;
  }

  if (customPov) {
    moment.customPov = customPov;
  }

  if (actionFlow) {
    moment.actionFlow = actionFlow;
  }

  if (sportRules) {
    moment.sportRules = sportRules;
  }

  return moment;
}

function isImportedMoment(value: ReturnType<typeof normalizeMoment>): value is ImportedMoment {
  return Boolean(
    value &&
      value.title &&
      Number.isFinite(value.actualYear) &&
      value.actualMonth &&
      Number.isFinite(value.actualDay) &&
      value.actualDay >= 1 &&
      value.actualDay <= 31 &&
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
  const level = readLabel(block, "level");
  const year = readLabel(block, "year");
  const month = readLabel(block, "month");
  const day = readLabel(block, "day");
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
  const sport = readLabel(block, "sport");
  const layoutInstructions =
    readLabel(block, "layoutInstructions") ||
    readLabel(block, "layout instructions") ||
    readLabel(block, "field layout") ||
    readLabel(block, "court layout") ||
    readLabel(block, "field/court layout");
  const customPov =
    readLabel(block, "customPov") ||
    readLabel(block, "custom pov") ||
    readLabel(block, "pov") ||
    readLabel(block, "camera pov");
  const actionFlow =
    readLabel(block, "actionFlow") ||
    readLabel(block, "action flow") ||
    readLabel(block, "primary action direction");
  const sportRules =
    readLabel(block, "sportRules") ||
    readLabel(block, "sport rules") ||
    readLabel(block, "sport-specific geometry") ||
    readLabel(block, "sport specific geometry");

  return {
    title,
    level,
    year,
    month,
    day,
    locationName,
    city,
    country,
    lat,
    lng,
    description,
    prompt,
    sport,
    layoutInstructions,
    customPov,
    actionFlow,
    sportRules,
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
    /^\s*description\s*:\s*([\s\S]*?)(?=\n\s*(?:prompt|sport|level|layoutInstructions|layout instructions|field layout|court layout|field\/court layout|customPov|custom pov|pov|camera pov|actionFlow|action flow|primary action direction|sportRules|sport rules|sport-specific geometry|sport specific geometry|title|year|month|day|locationName|location name|venue|name|city|country|lat|latitude|lng|long|longitude)\s*:|$)/im,
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
      return {
        drafts: parsed.drafts.map((draft: MomentDraft) => ({
          ...draft,
          actualMonth: monthNameValue(draft.actualMonth) || "January",
          actualDay: Number.isFinite(draft.actualDay) ? draft.actualDay : 1,
        })),
      };
    }
  } catch {
    return { drafts: [] };
  }

  return { drafts: [] };
}

async function writeStore(store: ImportStore) {
  await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`);
}

async function upsertImportedRounds(roundsToUpsert: Round[]) {
  const roundMap = new Map(
    (await readImportedRounds()).map((round) => [round.id, round]),
  );

  for (const round of roundsToUpsert) {
    roundMap.set(round.id, round);
  }

  await writeImportedRounds([...roundMap.values()]);
}

async function removeImportedRound(id: string) {
  const existingRounds = await readImportedRounds();

  await writeImportedRounds(existingRounds.filter((round) => round.id !== id));
}

async function verifyApprovedMomentSaved(draft: MomentDraft, finalPath: string) {
  await readFile(finalPath);
  const savedRounds = await readImportedRounds();
  const savedRound = savedRounds.find((round) => round.id === draft.id);

  if (!savedRound || savedRound.imageUrl !== draft.imageUrl) {
    throw new Error(
      "Approval failed because the moment was not saved to importedRounds.ts.",
    );
  }
}

async function readImportedRounds(): Promise<Round[]> {
  try {
    const content = await readFile(importedRoundsPath, "utf8");
    const match = content.match(
      /export const importedRounds: Round\[\] = ([\s\S]*?);\s*$/,
    );

    if (!match) {
      return [];
    }

    const parsed = JSON.parse(match[1]);

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeImportedRounds(approvedRounds: Round[]) {
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
    ...(draft.level ? { level: draft.level } : {}),
    actualYear: draft.actualYear,
    actualMonth: draft.actualMonth,
    actualDay: draft.actualDay,
    actualLocation: draft.actualLocation,
    description: draft.description,
  };
}

function applyDraftUpdates(draft: MomentDraft, updates: Record<string, unknown>) {
  const title = stringValue(updates.title);
  const level = roundLevelValue(updates.level);
  const actualYear = numberValue(updates.actualYear);
  const actualMonth = monthNameValue(updates.actualMonth);
  const actualDay = numberValue(updates.actualDay);
  const description = stringValue(updates.description);
  const prompt = stringValue(updates.prompt);
  const sport = stringValue(updates.sport);
  const promptRecommendation = stringValue(updates.promptRecommendation);
  const referenceImageUrl = stringValue(updates.referenceImageUrl);
  const referenceImageUrls = stringArrayValue(updates.referenceImageUrls);
  const layoutInstructions = stringValue(updates.layoutInstructions);
  const customPov = stringValue(updates.customPov);
  const actionFlow = stringValue(updates.actionFlow);
  const sportRules = stringValue(updates.sportRules);
  const location = isObject(updates.actualLocation) ? updates.actualLocation : {};
  const name = stringValue(location.name);
  const city = stringValue(location.city);
  const country = stringValue(location.country);
  const lat = numberValue(location.lat);
  const lng = numberValue(location.lng);

  if (title) draft.title = title;
  draft.level = level;
  if (Number.isFinite(actualYear)) draft.actualYear = actualYear;
  if (actualMonth) draft.actualMonth = actualMonth;
  if (Number.isFinite(actualDay)) draft.actualDay = actualDay;
  if (description) draft.description = description;
  draft.prompt = prompt;
  draft.sport = sport;
  draft.promptRecommendation = promptRecommendation;
  if (referenceImageUrl) draft.referenceImageUrl = referenceImageUrl;
  if (referenceImageUrls.length > 0) {
    draft.referenceImageUrls = referenceImageUrls;
    draft.referenceImageUrl = referenceImageUrls[0];
  }
  draft.layoutInstructions = layoutInstructions;
  draft.customPov = customPov;
  draft.actionFlow = actionFlow;
  draft.sportRules = sportRules;
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

function isSafetyRejection(payload: unknown) {
  const message = readOpenAIError(payload)?.toLowerCase() ?? "";

  return message.includes("safety system") || message.includes("safety");
}

function buildSafetyRetryPrompt(draft: MomentDraft) {
  const safeDraft: MomentDraft = {
    ...draft,
    title: `Historic ${draft.sport || inferSport(draft)} sports moment`,
    description: redactLivingAthleteNames(draft.description),
    referenceImageUrl: undefined,
    referenceImageUrls: [],
    prompt: undefined,
  };

  return [
    buildImagePrompt(safeDraft),
    "",
    "SAFETY RETRY MODE",
    "This is a text-only retry after a reference-image safety rejection.",
    "Do not rely on uploaded reference photos.",
    "SAFETY-SENSITIVE REAL PERSON HANDLING",
    "Do not recreate the exact face, biometric likeness, or identifiable facial features of any real living person from the title, description, or reference images.",
    "Represent any named living athlete as an era-appropriate, generic professional athlete with matching uniform colors, body posture, action timing, court or field position, and team context, without copying their exact facial identity.",
    "Do not use uploaded reference photos for face matching or identity transfer.",
    "Preserve the historic moment through venue, sport geometry, uniforms, crowd reaction, action flow, and composition rather than exact personal likeness.",
  ]
    .filter(Boolean)
    .join("\n");
}

function redactLivingAthleteNames(value: string) {
  return value
    .replace(/\bLeBron James\b/gi, "the featured basketball player")
    .replace(/\bLeBron\b/gi, "the featured basketball player")
    .replace(/\bSerena Williams\b/gi, "the featured tennis player")
    .replace(/\bCristiano Ronaldo\b/gi, "the featured soccer player")
    .replace(/\bTiger Woods\b/gi, "the featured golfer")
    .replace(/\bBarry Bonds\b/gi, "the featured baseball player")
    .replace(/\bAllen Iverson\b/gi, "the featured basketball player")
    .replace(/\bRandy Johnson\b/gi, "the featured baseball player")
    .replace(/\bRay Allen\b/gi, "the featured basketball player")
    .replace(/\bDevin Hester\b/gi, "the featured football player")
    .replace(/\bMatt Leinart\b/gi, "the featured quarterback")
    .replace(/\bReggie Bush\b/gi, "the featured running back")
    .replace(/\bZinedine Zidane\b/gi, "the featured soccer player");
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

async function imageUrlToDataUrl(imageUrl: string) {
  const imagePath = publicPathFromUrl(imageUrl);
  const imageBytes = await readFile(imagePath);

  return `data:${mimeTypeFromUrl(imageUrl)};base64,${imageBytes.toString("base64")}`;
}

function publicPathFromUrl(imageUrl: string) {
  const relativePath = imageUrl.split("?")[0].replace(/^\/+/, "");

  return path.join(rootDir, "public", relativePath);
}

function isSupportedReferenceImage(file: File) {
  return ["image/jpeg", "image/png", "image/webp"].includes(file.type);
}

function getImageExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";

  return "jpg";
}

async function deleteLocalReferenceImage(imageUrl: string) {
  const relativePath = imageUrl.split("?")[0].replace(/^\/+/, "");

  if (!relativePath.startsWith("moment-references/")) {
    return;
  }

  await unlink(path.join(rootDir, "public", relativePath)).catch(() => undefined);
}

function mimeTypeFromUrl(imageUrl: string) {
  const extension = path.extname(imageUrl.split("?")[0]).toLowerCase();

  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";

  return "image/png";
}

function getSpatialLayoutContract(draft: MomentDraft) {
  const sport = inferSport(draft);
  const eventText = `${draft.title} ${draft.description}`.toLowerCase();
  const userLayout = draft.layoutInstructions?.trim();

  if (userLayout) {
    return [
      "USER-SPECIFIED FIELD/COURT LAYOUT",
      userLayout,
    ].join("\n");
  }

  if (sport === "basketball") {
    const eventSpecific = /jordan|1998|bryon russell|last shot/.test(eventText)
      ? [
          "Event-specific anchor: Michael Jordan is just inside the three-point arc near the right elbow/top of key, squared toward the basket. Bryon Russell is between Jordan and the hoop, falling or trailing after the separation move.",
          "The basket is on the baseline behind Russell's defensive side. The painted lane and free throw circle align directly between Jordan and that basket.",
        ]
      : [
          "Event-specific anchor: place the ballhandler, defender, shooter, rebounders, and nearest basket according to the event description. The active player must face or move toward the correct basket, not toward a random sideline or center court.",
        ];

    return [
      "FIELD/COURT POSITIONING CONTRACT",
      "Basketball court coordinate system: baseline with basket = far end, opposite baseline = behind the offense, left/right sidelines run the full court length, center line crosses the court at midcourt.",
      "Exactly two baskets exist, one centered on each baseline. Each backboard is parallel to its baseline and perpendicular to the sidelines. Never put a hoop on a sideline, corner, center circle, or above empty hardwood.",
      "The nearest scoring end must show a correct stack of landmarks in order: baseline, backboard/rim, restricted circle, painted lane, free throw line and circle, three-point arc, then half-court line farther away.",
      "Player placement must obey basketball roles: shooter or driver oriented toward the rim, primary defender between ball and basket, help defenders near lane or wings, other players spaced at wing, corner, top of key, dunker spot, or perimeter.",
      ...eventSpecific,
    ].join("\n");
  }

  if (sport === "baseball") {
    const eventSpecific = /bonds|756|home run/.test(eventText)
      ? [
          "Event-specific anchor: Barry Bonds is a left-handed batter at home plate in follow-through. Catcher and umpire are behind home plate, pitcher is on or near the mound watching, and the ball travels toward left-center field stands.",
        ]
      : [
          "Event-specific anchor: place the batter at home plate, the pitcher on the mound, catcher and umpire behind home plate, infielders near their defensive positions, and outfielders in left, center, and right field unless the event description says otherwise.",
        ];

    return [
      "FIELD/COURT POSITIONING CONTRACT",
      "Baseball diamond coordinate system: home plate is the near point of the diamond, first base is to the batter's right, third base is to the batter's left, second base is straight away from home, and the pitcher's mound is centered between home and second.",
      "The first-base and third-base foul lines must begin at home plate, pass through first and third base, and continue straight into the outfield corners. The infield dirt forms a true diamond around the bases, not a random oval or soccer-like field.",
      "Player placement must obey baseball roles: batter in the batter's box at home plate, catcher and umpire behind home, pitcher on the mound, baserunners on basepaths or bases, infielders on dirt/edge of grass, outfielders in left/center/right field.",
      "Camera may be behind home, along a foul line, or in lower bowl, but the field orientation must remain readable from home plate through the mound to second base and center field.",
      ...eventSpecific,
    ].join("\n");
  }

  if (sport === "soccer") {
    return [
      "FIELD/COURT POSITIONING CONTRACT",
      "Soccer pitch coordinate system: goal line with goal, penalty box around that goal, six-yard box inside it, penalty spot centered in front of goal, touchlines running lengthwise, halfway line far from the goal.",
      "Players must occupy real soccer positions relative to the ball, goal, penalty area, goalkeeper, defenders, and attacking player. Do not place players randomly across the pitch or detach the goal from the penalty box.",
    ].join("\n");
  }

  if (sport === "football") {
    return [
      "FIELD/COURT POSITIONING CONTRACT",
      "American football field coordinate system: straight sidelines, straight end lines, accurate yard-line spacing every 5 yards, hash marks aligned downfield, goal line at the front of each end zone, and goalposts centered on the end line.",
      "Players must occupy real football positions relative to the line of scrimmage, end zone, goal line, ball carrier, blockers, defenders, and sideline. Do not use soccer goals, penalty boxes, or soccer pitch markings.",
      "For goal-line moments, anchor the ball carrier at or just beyond the goal line, with blockers and defenders compressed around the pile and the end zone directly behind the scoring plane.",
    ].join("\n");
  }

  if (sport === "hockey") {
    return [
      "FIELD/COURT POSITIONING CONTRACT",
      "Hockey rink coordinate system: goal centered on end boards, crease in front of goal, faceoff circles and dots in correct zones, blue lines dividing rink zones, boards and glass wrapping the flat ice surface.",
      "Players must occupy real hockey positions relative to puck, goal, crease, slot, blue line, and boards. Do not detach the goal from the crease or curve rink markings unnaturally.",
    ].join("\n");
  }

  return [
    "FIELD/COURT POSITIONING CONTRACT",
    "Use the regulation coordinate system of this sport. Anchor the action to exact field markings, goals, bases, boundaries, equipment, and legal athlete positions. Do not infer venue geometry from a cropped reference image when the sport's real layout is known.",
  ].join("\n");
}

function getSportPromptAdditions(draft: MomentDraft) {
  const sport = inferSport(draft);

  if (sport === "basketball") {
    return [
      "BASKETBALL ENVIRONMENT LOGIC",
      "Viewer seated courtside or front-row lower bowl. Camera height approximately seated human eye level. Hardwood court remains completely flat and rectangular. Baselines and sidelines remain straight with no curvature. Arena bowl wraps horizontally around viewer. Hoop and backboard clearly visible and proportionally realistic.",
      "Court topology must be physically valid: exactly two baskets, one centered on each baseline, with each backboard parallel to its baseline and perpendicular to the sideline. Do not place a hoop on a sideline, corner, center court, or above the wrong painted area.",
      "The nearest visible basket must anchor the correct end of the court: rim above the lane, rectangular paint below it, free throw circle connected to the lane, three-point arc wrapping around that same basket, half-court line farther away. Player spacing must follow real basketball positions relative to the basket, lane, elbow, wing, corner, and top of key.",
      "Historic action occurs near the free throw line, top of key, rim, or corner three depending on event.",
      /jordan|1998|bryon russell|last shot/i.test(`${draft.title} ${draft.description}`)
        ? "For the Jordan 1998 shot: set the basket on the baseline behind Bryon Russell's defensive side. Jordan is just inside the three-point arc near the right elbow/top-of-key area, squared toward that basket, with Bryon Russell falling or trailing in front of him. The painted lane and free throw circle must align directly between Jordan and the hoop. POV from the opposite lower bowl side. Utah crowd frozen in anticipation. Bulls bench and media table visible peripherally. Delta Center atmosphere tense, loud, historic, emotionally suspended."
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (sport === "baseball") {
    return [
      "BASEBALL ENVIRONMENT LOGIC",
      "Viewer seated front-row near foul line or behind home plate. Baseball diamond remains geographically correct. Baselines remain straight. Outfield extends naturally into distance. Stadium bowl wraps horizontally. Dirt, grass, warning track, and foul territory remain realistic.",
      "Baseball field topology must be physically valid: home plate at the point of the diamond, first base to the batter's right, third base to the batter's left, second base straight away from home, pitcher's mound centered between home and second. Foul lines must run straight from home plate through first and third base to the outfield corners.",
      "Players must occupy real baseball locations for the described moment: batter in the batter's box at home plate, catcher and umpire behind home, pitcher on or near the mound, infielders around the bases, outfielders in left/center/right field. Do not scatter players randomly on grass or place the batter away from home plate.",
      /bonds|756|home run/i.test(`${draft.title} ${draft.description}`)
        ? "For Barry Bonds 756: Barry Bonds must be at home plate in a left-handed batter's follow-through, catcher and umpire behind him, pitcher on the mound watching, infield diamond correctly oriented. POV from opposite side of stadium relative to left field home run trajectory. Viewer sees ball traveling into left-center stands. Crowd eruption isolated around landing area. McCovey Cove atmosphere visible in distance. Night game lighting realism critical."
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

  if (sport === "football") {
    return [
      "AMERICAN FOOTBALL ENVIRONMENT LOGIC",
      "Field remains perfectly flat and rectangular with realistic yard-line spacing, straight sidelines, accurate hash marks, proportional end zones, and centered goalposts. Stadium bowl wraps horizontally around viewer.",
      /bush push|leinart|reggie bush|notre dame|usc/i.test(`${draft.title} ${draft.description}`)
        ? "For The Bush Push: Viewer positioned low near the goal line or first rows beside the end zone. Matt Leinart is lunging across the goal line with USC teammates driving behind him, Notre Dame defenders compressed at the pile, Reggie Bush positioned behind or beside Leinart in the controversial push posture. Notre Dame Stadium crowd tension and late-game chaos are historically recognizable."
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

  if (sport === "football") {
    return "curved football field, warped yard lines, bent sidelines, soccer goals, penalty boxes, distorted hash marks, floating goalposts";
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
  if (
    /american football|college football|nfl|ncaa football|touchdown|quarterback|running back|linebacker|yard line|end zone|goal line|super bowl|rose bowl|bush push|leinart|reggie bush|notre dame|usc/.test(
      value,
    )
  ) {
    return "football";
  }
  if (/soccer|fifa|world cup|maradona|ronaldo|association football/.test(value)) {
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

function stringArrayValue(value: unknown) {
  return Array.isArray(value)
    ? value.map(stringValue).filter(Boolean)
    : [];
}

function roundLevelValue(value: unknown): RoundLevel | undefined {
  const normalized = stringValue(value).toLowerCase();

  if (normalized === "easy") return "Easy";
  if (normalized === "medium") return "Medium";
  if (normalized === "hard") return "Hard";
  if (normalized === "brutal") return "Brutal";

  return undefined;
}

function getReferenceImageUrls(draft: Pick<MomentDraft, "referenceImageUrl" | "referenceImageUrls">) {
  return Array.from(
    new Set([
      ...(draft.referenceImageUrls ?? []),
      ...(draft.referenceImageUrl ? [draft.referenceImageUrl] : []),
    ]),
  ).filter(Boolean);
}

function numberValue(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);

  return Number.isFinite(number) ? number : Number.NaN;
}

function monthNameValue(value: unknown) {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const numericMonth = numberValue(value);

  if (Number.isInteger(numericMonth) && numericMonth >= 1 && numericMonth <= 12) {
    return months[numericMonth - 1];
  }

  const month = stringValue(value).toLowerCase();

  return months.find((name) => name.toLowerCase() === month) ?? "";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
