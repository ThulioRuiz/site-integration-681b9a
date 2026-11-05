import type { ExamId } from "./types";

export interface LegacyQuestion {
  id: string;
  exam: ExamId;
  subject: string;
  topic: string;
  statement: string;
  options: string[];
  answer: number;
  explanation: string;
}

/**
 * Questões de treino da versão antiga da aba "Praticar" (originais, não são de provas).
 * Usadas apenas pela migração: quem já tinha respondido alguma delas recebe a questão
 * no próprio banco, com a tentativa registrada. Não aparecem para alunos novos.
 */
export const LEGACY_PRACTICE: LegacyQuestion[] = [
  // ITA
  { id: "ita-m1", exam: "ITA", subject: "Matemática", topic: "Números complexos", statement: "Seja z = 1 + i. O valor de z⁸ é:", options: ["16", "−16", "16i", "8", "−8i"], answer: 0, explanation: "z = √2·cis(45°) ⇒ z⁸ = (√2)⁸·cis(360°) = 16." },
  { id: "ita-m2", exam: "ITA", subject: "Matemática", topic: "Polinômios", statement: "A soma das raízes de x³ − 6x² + 11x − 6 = 0 é:", options: ["6", "−6", "11", "3", "1"], answer: 0, explanation: "Por Girard, soma = −b/a = 6 (raízes 1, 2 e 3)." },
  { id: "ita-f1", exam: "ITA", subject: "Física", topic: "Cinemática", statement: "Um corpo é lançado verticalmente para cima com 20 m/s (g = 10 m/s²). A altura máxima atingida é:", options: ["10 m", "20 m", "40 m", "15 m", "30 m"], answer: 1, explanation: "h = v²/2g = 400/20 = 20 m." },
  { id: "ita-q1", exam: "ITA", subject: "Química", topic: "Estequiometria", statement: "Quantos mols de O₂ são necessários para queimar completamente 2 mol de CH₄?", options: ["2", "3", "4", "1", "6"], answer: 2, explanation: "CH₄ + 2O₂ → CO₂ + 2H₂O ⇒ 2 mol CH₄ exigem 4 mol O₂." },
  { id: "ita-i1", exam: "ITA", subject: "Inglês", topic: "Gramática", statement: "Choose the correct option: \"If I ___ more time, I would study physics every day.\"", options: ["have", "had", "will have", "having", "has"], answer: 1, explanation: "Segunda condicional: if + passado simples, would + verbo." },
  // IME
  { id: "ime-m1", exam: "IME", subject: "Matemática", topic: "Logaritmos", statement: "Se log₂(x) + log₂(x − 2) = 3, então x vale:", options: ["2", "4", "−2", "8", "6"], answer: 1, explanation: "x(x−2) = 8 ⇒ x² − 2x − 8 = 0 ⇒ x = 4 (x = −2 não serve)." },
  { id: "ime-m2", exam: "IME", subject: "Matemática", topic: "Combinatória", statement: "Quantos anagramas tem a palavra IME?", options: ["3", "6", "9", "12", "27"], answer: 1, explanation: "3 letras distintas ⇒ 3! = 6." },
  { id: "ime-f1", exam: "IME", subject: "Física", topic: "Eletrodinâmica", statement: "Dois resistores de 6 Ω em paralelo, ligados em série com um de 3 Ω. A resistência equivalente é:", options: ["15 Ω", "6 Ω", "9 Ω", "3 Ω", "12 Ω"], answer: 1, explanation: "6∥6 = 3 Ω; 3 + 3 = 6 Ω." },
  { id: "ime-q1", exam: "IME", subject: "Química", topic: "Soluções", statement: "Dissolvem-se 4 g de NaOH (M = 40 g/mol) em água até 500 mL. A concentração é:", options: ["0,1 mol/L", "0,2 mol/L", "0,5 mol/L", "1 mol/L", "2 mol/L"], answer: 1, explanation: "0,1 mol ÷ 0,5 L = 0,2 mol/L." },
  // EFOMM
  { id: "efomm-m1", exam: "EFOMM", subject: "Matemática", topic: "Progressões", statement: "Numa PA, a₁ = 3 e r = 4. O 10º termo é:", options: ["39", "40", "43", "36", "35"], answer: 0, explanation: "a₁₀ = 3 + 9·4 = 39." },
  { id: "efomm-f1", exam: "EFOMM", subject: "Física", topic: "Hidrostática", statement: "Qual a pressão hidrostática a 10 m de profundidade na água (d = 1000 kg/m³, g = 10 m/s²)?", options: ["10⁴ Pa", "10⁵ Pa", "10⁶ Pa", "10³ Pa", "2·10⁵ Pa"], answer: 1, explanation: "p = dgh = 1000·10·10 = 10⁵ Pa." },
  { id: "efomm-p1", exam: "EFOMM", subject: "Português", topic: "Concordância", statement: "Assinale a frase correta quanto à concordância:", options: ["Fazem dois anos que embarquei.", "Faz dois anos que embarquei.", "Houveram muitos problemas.", "Existe muitas dúvidas.", "Haviam navios no porto."], answer: 1, explanation: "\"Fazer\" indicando tempo é impessoal: fica no singular." },
  { id: "efomm-i1", exam: "EFOMM", subject: "Inglês", topic: "Vocabulário", statement: "In nautical English, \"starboard\" means the ___ side of a ship.", options: ["left", "right", "back", "front", "lower"], answer: 1, explanation: "Starboard = boreste (direita); port = bombordo (esquerda)." },
  // EsPCEx
  { id: "espcex-m1", exam: "EsPCEx", subject: "Matemática", topic: "Funções", statement: "O vértice da parábola y = x² − 4x + 3 tem abscissa:", options: ["1", "2", "3", "−2", "4"], answer: 1, explanation: "xv = −b/2a = 4/2 = 2." },
  { id: "espcex-h1", exam: "EsPCEx", subject: "História", topic: "Brasil República", statement: "A Proclamação da República no Brasil ocorreu em:", options: ["1822", "1888", "1889", "1891", "1930"], answer: 2, explanation: "15 de novembro de 1889." },
  { id: "espcex-g1", exam: "EsPCEx", subject: "Geografia", topic: "Climatologia", statement: "O clima predominante na Amazônia é o:", options: ["Semiárido", "Equatorial", "Subtropical", "Tropical de altitude", "Temperado"], answer: 1, explanation: "Quente e úmido o ano todo: clima equatorial." },
  { id: "espcex-q1", exam: "EsPCEx", subject: "Química", topic: "Tabela periódica", statement: "O elemento de número atômico 11 pertence à família dos:", options: ["Halogênios", "Metais alcalinos", "Gases nobres", "Calcogênios", "Alcalinoterrosos"], answer: 1, explanation: "Z = 11 é o sódio (Na), metal alcalino." },
  { id: "espcex-f1", exam: "EsPCEx", subject: "Física", topic: "Dinâmica", statement: "Uma força resultante de 20 N atua num corpo de 4 kg. A aceleração é:", options: ["2 m/s²", "4 m/s²", "5 m/s²", "80 m/s²", "16 m/s²"], answer: 2, explanation: "a = F/m = 20/4 = 5 m/s²." },
  { id: "espcex-p1", exam: "EsPCEx", subject: "Português", topic: "Crase", statement: "Assinale a alternativa em que a crase está correta:", options: ["Fui à pé.", "Entreguei o relatório à ela.", "Chegamos à cidade cedo.", "Começou à chover.", "Refiro-me à você."], answer: 2, explanation: "\"Chegar a\" + \"a cidade\" ⇒ à cidade." },
];
