export type Alternativa = "A" | "B" | "C" | "D" | "E";

export interface Questao {
  id: number;
  enunciado: string;
  textoApoio: string;
  alternativas: Record<Alternativa, string>;
  respostaCorreta: Alternativa;
  explicacao: string;
  imagens?: string[];
}
