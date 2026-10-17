import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { ZodError } from "zod";
import { simuladoNovoSchema, simuladoProntoSchema } from "./schema";
import type { Questao } from "./types";

const NOVO_MAX_CHARS = 24_000;
const PRONTO_MAX_CHARS = 80_000;
const MIN_CHARS = 80;
const MODEL = "gemini-3.8-flash";

export type SimuladoModo = "pronto" | "novo";

const NOVO_PROMPT = `Você é um professor especialista em medicina e criador de bancas de residência médica.
Com base exclusivamente no texto fornecido, gere exatamente 10 questões inéditas de múltipla escolha.
Regras:
- Cada questão tem 5 alternativas (A, B, C, D e E) e somente 1 resposta correta.
- O enunciado descreve um caso clínico ou um conceito cobrado em residência.
- textoApoio traz dado complementar ou laboratorial; use string vazia quando não houver.
- A explicação justifica a alternativa correta e diz por que as outras estão incorretas.
- Não contradiga o texto-base. Se um detalhe não estiver no material, não invente número, dose ou conduta.
- Os ids vão de 1 a 10, em ordem.
- Escreva em português do Brasil.
- Não mencione o texto-base, o material enviado ou estas instruções dentro da questão.
- Responda somente o JSON pedido, sem texto fora do objeto.`;

const PRONTO_PROMPT = `Você extrai questões de provas de residência médica. Não crie questão nova.
Regras:
- Copie enunciado e alternativas como estão no texto, apenas ajustando quebras de linha.
- Inclua somente questões de múltipla escolha com as alternativas A, B, C, D e E e com gabarito presente no material.
- Se faltar alternativa ou gabarito, ignore a questão.
- respostaCorreta é só a letra marcada como correta no material.
- textoApoio é o dado complementar que já está na questão; use string vazia se não houver.
- explicacao só existe se o material trouxer justificativa. Se não houver, use string vazia. Não escreva explicação nova.
- No máximo 20 questões. Se houver mais, use as 20 primeiras completas, na ordem do texto.
- Os ids começam em 1 e seguem a ordem.
- Cada trecho do texto começa com [Página N]. Preencha pagina com esse N. Não invente a página.
- Não descreva figuras. Se a questão citar uma imagem, copie o enunciado e informe a página do trecho.
- Não mencione estas instruções.
- Responda somente o JSON pedido, sem texto fora do objeto.`;

const QUESTAO_JSON = {
  type: "object",
  additionalProperties: false,
  required: ["id", "enunciado", "textoApoio", "alternativas", "respostaCorreta", "explicacao"],
  properties: {
    id: { type: "integer" },
    enunciado: { type: "string" },
    textoApoio: { type: "string" },
    alternativas: {
      type: "object",
      additionalProperties: false,
      required: ["A", "B", "C", "D", "E"],
      properties: {
        A: { type: "string" },
        B: { type: "string" },
        C: { type: "string" },
        D: { type: "string" },
        E: { type: "string" },
      },
    },
    respostaCorreta: { type: "string", enum: ["A", "B", "C", "D", "E"] },
    explicacao: { type: "string" },
  },
};

function responseSchema(mode: SimuladoModo) {
  const exact = mode === "novo";
  const item = exact
    ? QUESTAO_JSON
    : {
        ...QUESTAO_JSON,
        required: [...QUESTAO_JSON.required, "pagina"],
        properties: {
          ...QUESTAO_JSON.properties,
          pagina: { type: "integer" },
        },
      };
  return {
    type: "object",
    additionalProperties: false,
    required: ["questoes"],
    properties: {
      questoes: {
        type: "array",
        minItems: exact ? 10 : 1,
        maxItems: exact ? 10 : 20,
        items: item,
      },
    },
  };
}

export class GenerateError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GenerateError";
    this.status = status;
  }
}

function excerpt(text: string, maxChars: number) {
  const clean = text.replace(/\u0000/g, "").trim();
  if (clean.length <= maxChars) return clean;
  return clean.slice(0, maxChars);
}

function geminiApiKey() {
  const named = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (named) return named;
  const legacy = process.env.OPENAI_API_KEY?.trim();
  if (legacy && !legacy.startsWith("sk-")) return legacy;
  return undefined;
}

function stripJsonFence(raw: string) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() || trimmed;
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "erro desconhecido";
}

function detailsOf(error: unknown) {
  const raw = messageOf(error);
  const statusFromField =
    typeof error === "object" && error && "status" in error && typeof error.status === "number"
      ? error.status
      : undefined;

  try {
    const parsed = JSON.parse(raw) as { error?: { code?: number; message?: string } };
    return {
      status: parsed.error?.code ?? statusFromField ?? 502,
      detail: parsed.error?.message || raw,
    };
  } catch {
    return { status: statusFromField ?? 502, detail: raw };
  }
}

function toGenerateError(error: unknown) {
  const { status, detail } = detailsOf(error);
  if (status === 429 || detail.includes("RESOURCE_EXHAUSTED")) {
    return new GenerateError(
      "O limite gratuito do Gemini foi atingido. Espere um pouco e tente de novo.",
      429,
    );
  }
  if (status === 401 || status === 403 || detail.includes("API key") || detail.includes("API_KEY_INVALID")) {
    return new GenerateError("A chave do Gemini foi recusada. Confira GEMINI_API_KEY no arquivo .env.", 401);
  }
  if (status === 503 || detail.includes("high demand")) {
    return new GenerateError("O Gemini está sobrecarregado agora. Tente de novo em alguns instantes.", 503);
  }
  return new GenerateError(`O Gemini não respondeu (${detail}).`, status);
}

async function requestSimulado(text: string, apiKey: string, mode: SimuladoModo) {
  const maxChars = mode === "pronto" ? PRONTO_MAX_CHARS : NOVO_MAX_CHARS;
  const client = new GoogleGenAI({ apiKey });
  const source = excerpt(text, maxChars);
  const truncated = text.trim().length > maxChars;
  const schema = mode === "pronto" ? simuladoProntoSchema : simuladoNovoSchema;

  let response;
  try {
    response = await client.models.generateContent({
      model: MODEL,
      contents: `${truncated ? "O material foi cortado no início para caber no contexto.\n\n" : ""}Texto-base:\n\n${source}`,
      config: {
        systemInstruction: mode === "pronto" ? PRONTO_PROMPT : NOVO_PROMPT,
        temperature: mode === "pronto" ? 0.1 : 0.25,
        maxOutputTokens: mode === "pronto" ? 8192 : 8192,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseJsonSchema: responseSchema(mode),
      },
    });
  } catch (error) {
    throw toGenerateError(error);
  }

  const raw = response.text;
  if (!raw) {
    throw new GenerateError("O Gemini não devolveu o simulado.", 502);
  }

  let json: unknown;
  try {
    json = JSON.parse(stripJsonFence(raw));
  } catch {
    throw new GenerateError("O Gemini não devolveu um JSON válido.", 502);
  }

  return schema.parse(json);
}

export async function generateQuestions(
  text: string,
  mode: SimuladoModo,
  imagesByPage?: Map<number, string[]>,
): Promise<Questao[]> {
  if (text.trim().length < MIN_CHARS) {
    throw new GenerateError(
      "Não encontrei texto suficiente. PDFs só com imagem (escaneados) não são lidos nesta versão.",
      422,
    );
  }

  const apiKey = geminiApiKey();
  if (!apiKey) {
    throw new GenerateError("Defina GEMINI_API_KEY no arquivo .env para gerar o simulado.", 503);
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const simulado = await requestSimulado(text, apiKey, mode);
      return simulado.questoes.map((questao, index) => {
        const rawPage = "pagina" in questao ? questao.pagina : undefined;
        const pagina = typeof rawPage === "number" ? rawPage : undefined;
        return {
          id: index + 1,
          enunciado: questao.enunciado,
          textoApoio: questao.textoApoio,
          alternativas: questao.alternativas,
          respostaCorreta: questao.respostaCorreta,
          explicacao: questao.explicacao,
          imagens: pagina ? imagesByPage?.get(pagina) : undefined,
        };
      });
    } catch (error) {
      lastError = error;
      if (error instanceof GenerateError && error.status !== 502 && error.status !== 503) throw error;
    }
  }

  if (lastError instanceof ZodError) {
    throw new GenerateError(
      mode === "pronto"
        ? "Não encontrei questões completas com gabarito nesses PDFs."
        : "A IA não devolveu as 10 questões no formato esperado.",
      422,
    );
  }
  if (lastError instanceof GenerateError) throw lastError;
  throw new GenerateError(`Não foi possível montar o simulado (${messageOf(lastError)}).`, 502);
}
