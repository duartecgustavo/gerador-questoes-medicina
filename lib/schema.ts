import { z } from "zod";

export const alternativaSchema = z.enum(["A", "B", "C", "D", "E"]);

const questaoBase = {
  id: z.number().int(),
  enunciado: z.string().min(1),
  textoApoio: z.string(),
  alternativas: z.object({
    A: z.string().min(1),
    B: z.string().min(1),
    C: z.string().min(1),
    D: z.string().min(1),
    E: z.string().min(1),
  }),
  respostaCorreta: alternativaSchema,
};

export const questaoSchema = z.object({
  ...questaoBase,
  explicacao: z.string().min(1),
});

export const questaoProntaSchema = z.object({
  ...questaoBase,
  explicacao: z.string(),
  pagina: z.number().int().min(1),
});

export const simuladoNovoSchema = z.object({
  questoes: z.array(questaoSchema).length(10),
});

export const simuladoProntoSchema = z.object({
  questoes: z.array(questaoProntaSchema).min(1).max(20),
});

export type SimuladoNovo = z.infer<typeof simuladoNovoSchema>;
export type SimuladoPronto = z.infer<typeof simuladoProntoSchema>;
