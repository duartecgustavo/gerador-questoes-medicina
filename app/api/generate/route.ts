import { DocumentError, extractDocumentText, extractReadyExam } from "@/lib/extract-text";
import { GenerateError, generateQuestions, type SimuladoModo } from "@/lib/generate-questions";
import { MAX_UPLOAD_FILES } from "@/lib/upload-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function isMode(value: unknown): value is SimuladoModo {
  return value === "pronto" || value === "novo";
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Envio inválido. Use multipart/form-data." }, { status: 400 });
  }

  const mode = form.get("mode");
  if (!isMode(mode)) {
    return Response.json({ error: "Escolha simulado pronto ou simulado novo." }, { status: 400 });
  }

  const files = form.getAll("files").filter((item): item is File => item instanceof File);
  if (files.length === 0) {
    return Response.json({ error: "Selecione pelo menos um PDF." }, { status: 400 });
  }
  if (files.length > MAX_UPLOAD_FILES) {
    return Response.json({ error: `Envie no máximo ${MAX_UPLOAD_FILES} PDFs.` }, { status: 400 });
  }

  try {
    if (mode === "pronto") {
      const parts: string[] = [];
      const imagesByPage = new Map<number, string[]>();
      let nextPage = 0;
      let remaining = 80_000;
      for (const file of files) {
        if (remaining < 400) break;
        const exam = await extractReadyExam(file, nextPage, remaining);
        if (exam.text.trim()) parts.push(exam.text);
        for (const [page, images] of exam.imagesByPage) imagesByPage.set(page, images);
        nextPage = exam.nextPage;
        remaining -= exam.usedChars;
      }
      const questoes = await generateQuestions(parts.join("\n\n"), mode, imagesByPage);
      return Response.json({ questoes });
    }

    const parts: string[] = [];
    for (const file of files) {
      const text = await extractDocumentText(file);
      if (text) parts.push(`Arquivo: ${file.name}\n${text}`);
    }
    const questoes = await generateQuestions(parts.join("\n\n"), mode);
    return Response.json({ questoes });
  } catch (error) {
    if (error instanceof DocumentError || error instanceof GenerateError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json(
      { error: "Falha inesperada ao gerar o simulado." },
      { status: 500 },
    );
  }
}
