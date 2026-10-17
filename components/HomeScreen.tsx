"use client";

import { useState } from "react";
import { Quiz } from "@/components/Quiz";
import { sampleQuestions } from "@/lib/sample-questions";
import type { Questao } from "@/lib/types";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_FILES, MAX_UPLOAD_MB } from "@/lib/upload-limit";

type Modo = "pronto" | "novo";

function isPdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export default function HomeScreen() {
  const [modo, setModo] = useState<Modo>("novo");
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Questao[] | null>(null);

  function switchMode(next: Modo) {
    setModo(next);
    setFiles([]);
    setError(null);
  }

  function addFiles(list: FileList | File[] | null) {
    const incoming = [...(list ?? [])];
    if (incoming.length === 0) return;

    const rejectedType = incoming.some((file) => !isPdf(file));
    const tooBig = incoming.find((file) => file.size > MAX_UPLOAD_BYTES);
    const pdfs = incoming.filter(isPdf);

    setFiles((current) => {
      const merged = [...current];
      for (const file of pdfs) {
        if (merged.length >= MAX_UPLOAD_FILES) break;
        const duplicate = merged.some((item) => item.name === file.name && item.size === file.size);
        if (!duplicate) merged.push(file);
      }
      return merged;
    });

    if (rejectedType) {
      setError("Envie apenas PDF.");
      return;
    }
    if (tooBig) {
      setError(`${tooBig.name} passa de ${MAX_UPLOAD_MB} MB.`);
      return;
    }
    if (files.length + pdfs.length > MAX_UPLOAD_FILES) {
      setError(`O limite é de ${MAX_UPLOAD_FILES} PDFs.`);
      return;
    }
    setError(null);
  }

  async function generate() {
    if (files.length === 0 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("mode", modo);
      for (const file of files) body.append("files", file);
      const response = await fetch("/api/generate", { method: "POST", body });
      const payload = (await response.json()) as { questoes?: Questao[]; error?: string };
      if (!response.ok || !payload.questoes) {
        throw new Error(payload.error || "Não foi possível gerar o simulado.");
      }
      setQuestions(payload.questoes);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao gerar o simulado.");
    } finally {
      setLoading(false);
    }
  }

  if (questions) {
    return (
      <main className="min-h-screen px-4 pt-6 pb-8 sm:px-6">
        <Quiz questions={questions} onRestart={() => setQuestions(null)} />
      </main>
    );
  }

  const pronto = modo === "pronto";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-start px-4 pt-6 pb-10 sm:px-6">
      <p className="text-sm uppercase tracking-[0.14em] text-[var(--sky-deep)]">Residência médica</p>
      <h1 className="mt-2 text-5xl leading-tight font-semibold">Simulado a partir dos seus PDFs</h1>
      <p className="mt-3 max-w-3xl text-xl leading-8 text-[var(--muted)]">
        {pronto
          ? "Envie até 3 provas. O simulado reúne só questões que já estão nesses arquivos, sem criar enunciado novo."
          : "Envie até 3 PDFs de aula ou capítulo. A inteligência artificial cria 10 questões inéditas a partir desse material."}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => switchMode("pronto")}
          className={`rounded-full px-5 py-3 text-lg font-medium ${
            pronto ? "bg-[var(--lime)] text-[var(--ink)]" : "border border-[var(--sky)] bg-white/80"
          }`}
        >
          Simulado pronto
        </button>
        <button
          type="button"
          onClick={() => switchMode("novo")}
          className={`rounded-full px-5 py-3 text-lg font-medium ${
            pronto ? "border border-[var(--sky)] bg-white/80" : "bg-[var(--lime)] text-[var(--ink)]"
          }`}
        >
          Simulado novo
        </button>
      </div>

      <label
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
        className={`mt-5 block cursor-pointer rounded-2xl border border-dashed px-6 py-12 text-center ${
          dragging ? "border-[var(--lime-deep)] bg-[var(--lime)]/35" : "border-[var(--sky)] bg-white/75"
        }`}
      >
        <input
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="sr-only"
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <span className="block text-xl">Arraste os PDFs ou clique para escolher</span>
        <span className="mt-1 block text-sm text-[var(--muted)]">
          Até {MAX_UPLOAD_FILES} PDFs, {MAX_UPLOAD_MB} MB cada
        </span>
      </label>

      {files.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {files.map((file) => (
            <li
              key={`${file.name}-${file.size}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--sky)] bg-white/80 px-3 py-2.5 text-sm"
            >
              <span className="truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => setFiles((current) => current.filter((item) => item !== file))}
                className="shrink-0 text-[var(--muted)]"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-2xl bg-[#fdf1f1] px-4 py-3 text-sm text-[var(--wrong)]">{error}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={generate}
          disabled={files.length === 0 || loading}
          className="rounded-full bg-[var(--lime)] px-5 py-3 text-lg font-medium text-[var(--ink)] disabled:opacity-40"
        >
          {loading
            ? pronto
              ? "Lendo as provas e separando as questões…"
              : "Lendo os arquivos e gerando questões…"
            : pronto
              ? "Montar simulado pronto"
              : "Gerar simulado novo"}
        </button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setQuestions(sampleQuestions);
          }}
          className="rounded-full border border-[var(--sky)] bg-[var(--sky-soft)] px-5 py-3 text-lg"
        >
          Ver um exemplo
        </button>
      </div>
      <p className="mt-4 text-sm text-[var(--muted)]">
        A chave do Gemini fica só no servidor, no arquivo .env.
      </p>
    </main>
  );
}
