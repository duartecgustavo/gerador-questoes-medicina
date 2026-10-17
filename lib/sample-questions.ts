import type { Questao } from "./types";

export const sampleQuestions: Questao[] = [
  {
    id: 1,
    enunciado:
      "Homem de 58 anos, hipertenso, chega à emergência com dor torácica em aperto há 40 minutos, irradiada para o membro superior esquerdo, acompanhada de sudorese. O eletrocardiograma mostra supradesnivelamento de ST em D2, D3 e aVF. Qual artéria está mais provavelmente ocluída?",
    textoApoio: "PA 150x90 mmHg. Sem sopros. Troponina ainda dentro do prazo de negatividade.",
    alternativas: {
      A: "Artéria descendente anterior",
      B: "Artéria circunflexa",
      C: "Artéria coronária direita",
      D: "Tronco da coronária esquerda",
      E: "Artéria diagonal",
    },
    respostaCorreta: "C",
    explicacao:
      "Supradesnivelamento em D2, D3 e aVF indica parede inferior, território mais frequentemente irrigado pela coronária direita. A descendente anterior costuma alterar V1–V4; a circunflexa, a parede lateral; o tronco produz apresentação mais extensa e instável.",
  },
  {
    id: 2,
    enunciado:
      "Mulher de 24 anos refere poliúria, polidipsia e emagrecimento há três semanas. Glicemia ao acaso de 312 mg/dL, cetonúria positiva e pH venoso de 7,22. Além da hidratação, qual conduta inicial é prioritária?",
    textoApoio: "Potássio sérico 4,8 mEq/L. Bicarbonato 12 mEq/L.",
    alternativas: {
      A: "Insulina regular endovenosa",
      B: "Metformina via oral",
      C: "Apenas observação por 6 horas",
      D: "Sulfonilureia de ação rápida",
      E: "Bicarbonato de sódio de rotina",
    },
    respostaCorreta: "A",
    explicacao:
      "O quadro é de cetoacidose diabética. Depois de confirmar potássio adequado, a insulina regular endovenosa interrompe a cetogênese. Metformina e sulfonilureia não tratam a crise. Bicarbonato não é rotina com pH acima de 7,0 na maioria dos protocolos.",
  },
];
