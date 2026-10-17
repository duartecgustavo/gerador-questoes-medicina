"use client";

import { useState } from "react";
import type { Alternativa, Questao } from "@/lib/types";

const LETRAS: Alternativa[] = ["A", "B", "C", "D", "E"];

export function Quiz({
  questions,
  onRestart,
}: {
  questions: Questao[];
  onRestart: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Alternativa | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const question = questions[index];
  const total = questions.length;

  function confirm() {
    if (!selected || revealed || !question) return;
    if (selected === question.respostaCorreta) setScore((value) => value + 1);
    setRevealed(true);
  }

  function next() {
    if (index + 1 >= total) {
      setFinished(true);
      return;
    }
    setIndex((value) => value + 1);
    setSelected(null);
    setRevealed(false);
  }

  if (finished) {
    return (
      <section className="mx-auto w-full max-w-5xl rounded-2xl border border-[var(--sky)] bg-white/80 p-5 shadow-sm sm:p-6">
        <p className="text-sm uppercase tracking-[0.14em] text-[var(--sky-deep)]">Resultado</p>
        <h2 className="mt-1 text-5xl font-semibold">
          {score} de {total}
        </h2>
        <p className="mt-2 text-xl leading-8 text-[var(--muted)]">
          {score === total
            ? "Você acertou o simulado inteiro."
            : "Revise as explicações das questões que ficaram em dúvida e tente outro material."}
        </p>
        <button
          type="button"
          onClick={onRestart}
          className="mt-5 rounded-full bg-[var(--lime)] px-5 py-3 text-lg font-medium text-[var(--ink)]"
        >
          Gerar outro simulado
        </button>
      </section>
    );
  }

  if (!question) return null;

  return (
    <section className="mx-auto w-full max-w-5xl">
      <div className="mb-3 flex items-center justify-between text-sm text-[var(--muted)]">
        <span>
          Questão {index + 1} de {total}
        </span>
        <span>
          Acertos: {score}
        </span>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/80">
        <div
          className="h-full bg-[var(--lime)]"
          style={{ width: `${((index + (revealed ? 1 : 0)) / total) * 100}%` }}
        />
      </div>
      <article className="rounded-2xl border border-[var(--sky)] bg-white/85 p-5 shadow-sm sm:p-7">
        <h2 className="text-2xl leading-8 font-semibold">{question.enunciado}</h2>
        {question.imagens && question.imagens.length > 0 ? (
          <div className="mt-3 space-y-3">
            {question.imagens.map((src, imageIndex) => (
              <img
                key={`${question.id}-${imageIndex}`}
                src={src}
                alt="Figura da página da questão"
                className="max-h-96 w-full rounded-xl bg-white object-contain"
              />
            ))}
          </div>
        ) : null}
        {question.textoApoio ? (
          <p className="mt-3 rounded-xl bg-[var(--sky-soft)] px-3 py-2 text-sm leading-6 text-[var(--muted)]">
            {question.textoApoio}
          </p>
        ) : null}
        <ul className="mt-4 space-y-2">
          {LETRAS.map((letra) => {
            const isSelected = selected === letra;
            const isCorrect = revealed && letra === question.respostaCorreta;
            const isWrong = revealed && isSelected && letra !== question.respostaCorreta;
            return (
              <li key={letra}>
                <button
                  type="button"
                  disabled={revealed}
                  onClick={() => setSelected(letra)}
                  className={`flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left text-xl transition ${
                    isCorrect
                      ? "border-[var(--correct)] bg-[#e7f8ee]"
                      : isWrong
                        ? "border-[var(--wrong)] bg-[#fdecec]"
                        : isSelected
                          ? "border-[var(--lime-deep)] bg-[var(--lime)]/45"
                          : "border-[var(--line)] bg-white hover:border-[var(--sky)]"
                  }`}
                >
                  <span className="mt-0.5 font-semibold">{letra}</span>
                  <span>{question.alternativas[letra]}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {revealed ? (
          <div className="mt-4 rounded-xl bg-[var(--sky-soft)] px-3 py-3 text-sm leading-6">
            <p className="font-semibold text-[var(--sky-deep)]">
              Gabarito: {question.respostaCorreta}
              {selected === question.respostaCorreta ? " · você acertou" : " · você errou"}
            </p>
            <p className="mt-2">{question.explicacao}</p>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {revealed ? (
            <button
              type="button"
              onClick={next}
              className="rounded-full bg-[var(--sky-deep)] px-5 py-3 text-lg font-medium text-white"
            >
              {index + 1 === total ? "Ver resultado" : "Próxima questão"}
            </button>
          ) : (
            <button
              type="button"
              onClick={confirm}
              disabled={!selected}
              className="rounded-full bg-[var(--lime)] px-5 py-3 text-lg font-medium text-[var(--ink)] disabled:opacity-40"
            >
              Confirmar resposta
            </button>
          )}
          <button
            type="button"
            onClick={onRestart}
            className="rounded-full px-5 py-3 text-lg text-[var(--muted)]"
          >
            Trocar material
          </button>
        </div>
      </article>
    </section>
  );
}
