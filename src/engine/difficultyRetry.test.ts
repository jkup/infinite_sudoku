import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_DIFFICULTY_ATTEMPTS, DifficultyUnreachableError, generateMatching, generateMatchingAsync } from './difficultyRetry';
import type { Difficulty, GameMode, Puzzle } from './types';

function puzzle(difficulty: Difficulty, mode: GameMode = 'classic'): Puzzle {
  return { initial: [], solution: [], difficulty, mode, gridSize: 9 };
}

describe('generateMatching', () => {
  it('returns the first puzzle whose difficulty and mode match', () => {
    const generate = vi.fn().mockReturnValueOnce(puzzle('easy')).mockReturnValueOnce(puzzle('hard'));
    const onMiss = vi.fn();
    expect(generateMatching('hard', 'classic', generate, { onMiss })).toEqual(puzzle('hard'));
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate).toHaveBeenCalledWith('hard', 'classic');
    expect(onMiss).toHaveBeenCalledOnce();
    expect(onMiss).toHaveBeenCalledWith(1, 'easy');
  });

  it('treats a mode mismatch as a miss', () => {
    const generate = vi.fn().mockReturnValueOnce(puzzle('hard', 'classic')).mockReturnValueOnce(puzzle('hard', 'killer'));
    expect(generateMatching('hard', 'killer', generate).mode).toBe('killer');
  });

  it('gives up after the attempt budget with a descriptive error', () => {
    const generate = vi.fn().mockReturnValue(puzzle('easy'));
    expect(() => generateMatching('hard', 'classic', generate, { attempts: 2 })).toThrow(DifficultyUnreachableError);
    expect(() => generateMatching('hard', 'classic', generate, { attempts: 2 }))
      .toThrow("Couldn't generate a hard classic puzzle after 2 attempts");
    expect(generate).toHaveBeenCalledTimes(4);
  });

  it('uses a bounded default budget and rejects invalid ones', () => {
    const generate = vi.fn().mockReturnValue(puzzle('easy'));
    expect(() => generateMatching('expert', 'classic', generate)).toThrow(DifficultyUnreachableError);
    expect(generate).toHaveBeenCalledTimes(DEFAULT_DIFFICULTY_ATTEMPTS);
    expect(() => generateMatching('expert', 'classic', generate, { attempts: 0 })).toThrow('Invalid attempt count');
  });
});

describe('generateMatchingAsync', () => {
  it('retries sequentially until the label matches', async () => {
    const generate = vi.fn().mockResolvedValueOnce(puzzle('medium')).mockResolvedValueOnce(puzzle('hard'));
    const onMiss = vi.fn();
    await expect(generateMatchingAsync('hard', 'classic', generate, { onMiss })).resolves.toEqual(puzzle('hard'));
    expect(generate).toHaveBeenCalledTimes(2);
    expect(onMiss).toHaveBeenCalledWith(1, 'medium');
  });

  it('rejects after the budget and propagates generator failures immediately', async () => {
    const miss = vi.fn().mockResolvedValue(puzzle('easy'));
    await expect(generateMatchingAsync('hard', 'classic', miss, { attempts: 3 })).rejects.toThrow(DifficultyUnreachableError);
    expect(miss).toHaveBeenCalledTimes(3);

    const failing = vi.fn().mockRejectedValue(new Error('Puzzle worker failed'));
    await expect(generateMatchingAsync('hard', 'classic', failing)).rejects.toThrow('Puzzle worker failed');
    expect(failing).toHaveBeenCalledOnce();
  });
});
