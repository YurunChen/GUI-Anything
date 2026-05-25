import {
  generatePotentialDirectionsAI,
  type DirectionExplorationInput,
  type PotentialDirectionsResult,
} from './flow-summaries';
import type { Exploration } from '../../data/protocol/observer-protocol';
import { extractExplorationMetrics } from '../../utils/exploration-utils';

export interface PotentialDirectionsService {
  suggest(input: {
    runtimeModel: string;
    context: DirectionExplorationInput[];
    summaryModel?: string;
  }): Promise<PotentialDirectionsResult>;
  suggestFromExplorations(input: {
    runtimeModel: string;
    explorations: Exploration[];
    summaries: Record<string, string>;
    summaryModel?: string;
  }): Promise<PotentialDirectionsResult>;
}

export class DefaultPotentialDirectionsService implements PotentialDirectionsService {
  async suggest(input: {
    runtimeModel: string;
    context: DirectionExplorationInput[];
    summaryModel?: string;
  }): Promise<PotentialDirectionsResult> {
    return generatePotentialDirectionsAI(
      input.runtimeModel,
      input.context,
      input.summaryModel,
    );
  }

  async suggestFromExplorations(input: {
    runtimeModel: string;
    explorations: Exploration[];
    summaries: Record<string, string>;
    summaryModel?: string;
  }): Promise<PotentialDirectionsResult> {
    const completed = input.explorations.filter((e) => e.status === 'complete');
    if (completed.length < 2) {
      return {
        status: 'insufficient',
        message: '当前证据不足：至少需要2轮已完成探索。',
        directions: [],
      };
    }
    const hasEvidence = completed.some((e) =>
      e.nodes.some((n: Exploration['nodes'][number]) => n.type === 'tool' || n.type === 'response' || n.type === 'result')
    );
    if (!hasEvidence) {
      return {
        status: 'insufficient',
        message: '当前证据不足：尚未观察到有效工具或响应输出。',
        directions: [],
      };
    }

    const context = completed.slice(-5).map((e) => ({
      ...extractExplorationMetrics(e.nodes),
      id: e.id,
      question: e.question,
      summary: input.summaries[e.id],
    }));

    return this.suggest({
      runtimeModel: input.runtimeModel,
      context,
      summaryModel: input.summaryModel,
    });
  }
}
