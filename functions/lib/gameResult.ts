import type { Difficulty, GameMode } from '../../src/engine/types';
import { calculateScore } from '../../src/lib/scoring';

const MAX_BODY_BYTES = 16 * 1024;
const MODES = new Set<GameMode>(['classic', 'killer']);
const DIFFICULTIES = new Set<Difficulty>(['easy', 'medium', 'hard', 'expert']);
const FIELDS = new Set([
  'mode', 'difficulty', 'solveTimeMs', 'hintsUsed', 'maxHintDepth', 'errorsMade',
  'completionId',
]);

export type ValidGameResult = {
  mode: GameMode;
  difficulty: Difficulty;
  solveTimeMs: number;
  hintsUsed: number;
  maxHintDepth: number;
  errorsMade: number;
  completionId: string;
  score: number;
};

export class RequestValidationError extends Error {
  constructor(message: string, readonly status: 400 | 413 | 415 = 400) {
    super(message);
    this.name = 'RequestValidationError';
  }
}

async function readBoundedBody(request: Request): Promise<string> {
  const declaredLength = Number(request.headers.get('Content-Length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new RequestValidationError('Request body is too large', 413);
  }

  if (!request.body) throw new RequestValidationError('JSON body is required');
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new RequestValidationError('Request body is too large', 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function integerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}

export async function parseGameResult(request: Request): Promise<ValidGameResult> {
  const contentType = request.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw new RequestValidationError('Content-Type must be application/json', 415);
  }

  let value: unknown;
  try {
    value = JSON.parse(await readBoundedBody(request));
  } catch (error) {
    if (error instanceof RequestValidationError) throw error;
    throw new RequestValidationError('Request body must be valid JSON');
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RequestValidationError('Request body must be a JSON object');
  }
  const body = value as Record<string, unknown>;
  const unknownField = Object.keys(body).find((key) => !FIELDS.has(key));
  if (unknownField) throw new RequestValidationError(`Unknown field: ${unknownField}`);
  if (!MODES.has(body.mode as GameMode)) throw new RequestValidationError('Invalid mode');
  if (!DIFFICULTIES.has(body.difficulty as Difficulty)) throw new RequestValidationError('Invalid difficulty');
  if (!integerInRange(body.solveTimeMs, 0, 86_400_000)) throw new RequestValidationError('Invalid solveTimeMs');
  if (!integerInRange(body.hintsUsed, 0, 81)) throw new RequestValidationError('Invalid hintsUsed');
  if (!integerInRange(body.maxHintDepth, 0, 3)) throw new RequestValidationError('Invalid maxHintDepth');
  if (!integerInRange(body.errorsMade, 0, 1_000)) throw new RequestValidationError('Invalid errorsMade');
  if (typeof body.completionId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.completionId)) {
    throw new RequestValidationError('Invalid completionId');
  }

  const result = {
    mode: body.mode as GameMode,
    difficulty: body.difficulty as Difficulty,
    solveTimeMs: body.solveTimeMs,
    hintsUsed: body.hintsUsed,
    maxHintDepth: body.maxHintDepth,
    errorsMade: body.errorsMade,
    completionId: body.completionId,
  };
  return { ...result, score: calculateScore(result) };
}
