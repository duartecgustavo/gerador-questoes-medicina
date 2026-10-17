import { encode as encodeJpeg } from "jpeg-js";
import { extractImages, extractText, getDocumentProxy } from "unpdf";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/upload-limit";

const PDF_MIME = "application/pdf";

export class DocumentError extends Error {
  status: number;

  constructor(message: string, status = 422) {
    super(message);
    this.name = "DocumentError";
    this.status = status;
  }
}

function isPdf(file: File) {
  return file.type === PDF_MIME || file.name.toLowerCase().endsWith(".pdf");
}

export async function extractDocumentText(file: File): Promise<string> {
  assertPdf(file);

  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    const joined = Array.isArray(text) ? text.join("\n") : String(text ?? "");
    return joined.replace(/\s+\n/g, "\n").trim();
  } catch {
    throw new DocumentError(
      `Não foi possível ler ${file.name}. Verifique se o PDF não está corrompido ou protegido por senha.`,
    );
  }
}

const MIN_FIGURE_PX = 140;
const MAX_FIGURES_PER_PAGE = 2;
const MAX_FIGURE_EDGE = 960;

export interface ReadyExamSlice {
  text: string;
  imagesByPage: Map<number, string[]>;
  nextPage: number;
  usedChars: number;
}

function toRgba(data: Uint8ClampedArray | Uint8Array, width: number, height: number, channels: number) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  if (channels === 4) {
    rgba.set(data.subarray(0, rgba.length));
    return rgba;
  }
  if (channels === 3) {
    for (let source = 0, target = 0; source < data.length; source += 3, target += 4) {
      rgba[target] = data[source] ?? 0;
      rgba[target + 1] = data[source + 1] ?? 0;
      rgba[target + 2] = data[source + 2] ?? 0;
      rgba[target + 3] = 255;
    }
    return rgba;
  }
  for (let source = 0, target = 0; source < data.length; source += 1, target += 4) {
    const tone = data[source] ?? 0;
    rgba[target] = tone;
    rgba[target + 1] = tone;
    rgba[target + 2] = tone;
    rgba[target + 3] = 255;
  }
  return rgba;
}

function shrink(data: Uint8ClampedArray, width: number, height: number) {
  const scale = Math.min(1, MAX_FIGURE_EDGE / Math.max(width, height));
  if (scale === 1) return { data, width, height };
  const nextWidth = Math.max(1, Math.round(width * scale));
  const nextHeight = Math.max(1, Math.round(height * scale));
  const output = new Uint8ClampedArray(nextWidth * nextHeight * 4);
  for (let y = 0; y < nextHeight; y += 1) {
    const sourceY = Math.min(height - 1, Math.floor(y / scale));
    for (let x = 0; x < nextWidth; x += 1) {
      const sourceX = Math.min(width - 1, Math.floor(x / scale));
      const sourceIndex = (sourceY * width + sourceX) * 4;
      const targetIndex = (y * nextWidth + x) * 4;
      output[targetIndex] = data[sourceIndex] ?? 0;
      output[targetIndex + 1] = data[sourceIndex + 1] ?? 0;
      output[targetIndex + 2] = data[sourceIndex + 2] ?? 0;
      output[targetIndex + 3] = data[sourceIndex + 3] ?? 255;
    }
  }
  return { data: output, width: nextWidth, height: nextHeight };
}

function figureToDataUrl(image: { data: Uint8ClampedArray | Uint8Array; width: number; height: number; channels: number }) {
  try {
    const rgba = toRgba(image.data, image.width, image.height, image.channels);
    const fitted = shrink(rgba, image.width, image.height);
    const jpeg = encodeJpeg({ data: fitted.data, width: fitted.width, height: fitted.height }, 60);
    if (jpeg.data.byteLength > 350_000) return null;
    return `data:image/jpeg;base64,${Buffer.from(jpeg.data).toString("base64")}`;
  } catch {
    return null;
  }
}

async function figuresOnPage(pdf: Awaited<ReturnType<typeof getDocumentProxy>>, pageNumber: number) {
  try {
    const images = await extractImages(pdf, pageNumber);
    return images
      .filter((image) => image.width >= MIN_FIGURE_PX && image.height >= MIN_FIGURE_PX)
      .sort((a, b) => b.width * b.height - a.width * a.height)
      .slice(0, MAX_FIGURES_PER_PAGE)
      .map((image) => figureToDataUrl(image))
      .filter((src): src is string => Boolean(src));
  } catch {
    return [];
  }
}

export async function extractReadyExam(
  file: File,
  startPage: number,
  remainingChars: number,
): Promise<ReadyExamSlice> {
  assertPdf(file);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const imagesByPage = new Map<number, string[]>();

  try {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: false });
    const pages = Array.isArray(text) ? text : [String(text ?? "")];
    const blocks = [`Arquivo: ${file.name}`];
    let usedChars = blocks[0]?.length ?? 0;
    let nextPage = startPage;

    for (let index = 0; index < pages.length; index += 1) {
      const pageText = pages[index]?.replace(/\s+\n/g, "\n").trim() ?? "";
      if (!pageText) continue;
      const pageNumber = nextPage + 1;
      const block = `[Página ${pageNumber}]\n${pageText}`;
      if (usedChars + block.length > remainingChars && usedChars > 0) break;
      usedChars += block.length + 2;
      nextPage = pageNumber;
      blocks.push(block);
      const figures = await figuresOnPage(pdf, index + 1);
      if (figures.length > 0) imagesByPage.set(pageNumber, figures);
    }

    return {
      text: blocks.join("\n\n"),
      imagesByPage,
      nextPage,
      usedChars,
    };
  } catch (error) {
    if (error instanceof DocumentError) throw error;
    throw new DocumentError(
      `Não foi possível ler ${file.name}. Verifique se o PDF não está corrompido ou protegido por senha.`,
    );
  }
}

function assertPdf(file: File) {
  if (!isPdf(file)) {
    throw new DocumentError("Envie apenas arquivos PDF.", 400);
  }
  if (file.size === 0) {
    throw new DocumentError(`${file.name} está vazio.`, 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new DocumentError(`${file.name} passa de ${MAX_UPLOAD_MB} MB.`, 400);
  }
}
