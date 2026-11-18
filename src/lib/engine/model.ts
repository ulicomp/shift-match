/**
 * Logistic regression: P(accept) = sigmoid(w · standardized(x) + b).
 * Trained with full-batch gradient descent on past offers, then nudged with one
 * small online step every time a new yes/no comes back from a live dispatch.
 */
import { FEATURES } from "./features.ts";

export interface Example {
  x: number[];
  y: 0 | 1;
}

export interface TrainedModel {
  weights: number[];
  bias: number;
  mean: number[];
  sd: number[];
  trainingOffers: number;
  holdoutOffers: number;
  holdoutAccuracy: number;
  holdoutAuc: number;
  baseAcceptRate: number;
  onlineUpdates: number;
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

const standardize = (m: Pick<TrainedModel, "mean" | "sd">, x: number[]) =>
  x.map((v, i) => (v - (m.mean[i] ?? 0)) / (m.sd[i] ?? 1));

export function logit(m: TrainedModel, x: number[], weightScale?: number[]): number {
  const z = standardize(m, x);
  return z.reduce((sum, v, i) => sum + v * (m.weights[i] ?? 0) * (weightScale?.[i] ?? 1), m.bias);
}

export const predict = (m: TrainedModel, x: number[], weightScale?: number[]) => sigmoid(logit(m, x, weightScale));

/** Each feature's push on the logit, used to explain a ranking in plain words. */
export function contributions(m: TrainedModel, x: number[], weightScale?: number[]): number[] {
  return standardize(m, x).map((v, i) => v * (m.weights[i] ?? 0) * (weightScale?.[i] ?? 1));
}

function auc(scores: number[], labels: (0 | 1)[]): number {
  const pairs = scores.map((s, i) => [s, labels[i] ?? 0] as const).sort((a, b) => a[0] - b[0]);
  let rankSum = 0;
  let pos = 0;
  pairs.forEach(([, y], i) => {
    if (y === 1) {
      rankSum += i + 1;
      pos++;
    }
  });
  const neg = pairs.length - pos;
  return pos && neg ? (rankSum - (pos * (pos + 1)) / 2) / (pos * neg) : 0.5;
}

export function train(examples: Example[], opts = { epochs: 500, lr: 0.4, l2: 0.002 }): TrainedModel {
  const dims = FEATURES.length;
  // Deterministic 80/20 split: every fifth offer is held out.
  const trainSet = examples.filter((_, i) => i % 5 !== 0);
  const holdout = examples.filter((_, i) => i % 5 === 0);
  const mean = Array.from({ length: dims }, (_, j) => trainSet.reduce((s, e) => s + (e.x[j] ?? 0), 0) / trainSet.length);
  const sd = Array.from({ length: dims }, (_, j) => {
    const v = trainSet.reduce((s, e) => s + ((e.x[j] ?? 0) - (mean[j] ?? 0)) ** 2, 0) / trainSet.length;
    return Math.sqrt(v) || 1;
  });
  const z = trainSet.map((e) => standardize({ mean, sd }, e.x));
  const weights = new Array<number>(dims).fill(0);
  const baseRate = trainSet.reduce((s, e) => s + e.y, 0) / trainSet.length;
  let bias = Math.log(baseRate / (1 - baseRate));
  for (let epoch = 0; epoch < opts.epochs; epoch++) {
    const grad = new Array<number>(dims).fill(0);
    let gb = 0;
    z.forEach((row, i) => {
      const err = sigmoid(row.reduce((s, v, j) => s + v * (weights[j] ?? 0), bias)) - (trainSet[i]?.y ?? 0);
      gb += err;
      row.forEach((v, j) => (grad[j] = (grad[j] ?? 0) + err * v));
    });
    for (let j = 0; j < dims; j++)
      weights[j] = (weights[j] ?? 0) - opts.lr * ((grad[j] ?? 0) / z.length + opts.l2 * (weights[j] ?? 0));
    bias -= (opts.lr * gb) / z.length;
  }
  const model: TrainedModel = {
    weights,
    bias,
    mean,
    sd,
    trainingOffers: trainSet.length,
    holdoutOffers: holdout.length,
    holdoutAccuracy: 0,
    holdoutAuc: 0.5,
    baseAcceptRate: baseRate,
    onlineUpdates: 0,
  };
  const scores = holdout.map((e) => predict(model, e.x));
  model.holdoutAccuracy = holdout.length
    ? holdout.filter((e, i) => ((scores[i] ?? 0) >= 0.5 ? 1 : 0) === e.y).length / holdout.length
    : 0;
  model.holdoutAuc = auc(scores, holdout.map((e) => e.y));
  return model;
}

/** One stochastic gradient step from a fresh answer: the model keeps learning live. */
export function learnFrom(m: TrainedModel, example: Example, lr = 0.05): void {
  const z = standardize(m, example.x);
  const err = predict(m, example.x) - example.y;
  m.weights = m.weights.map((w, j) => w - lr * err * (z[j] ?? 0));
  m.bias -= lr * err;
  m.onlineUpdates++;
}
