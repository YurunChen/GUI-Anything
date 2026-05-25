/**
 * usePotentialDirections - application adapter for next-step direction suggestions.
 */

import { useCallback, useRef, useState } from 'react';
import type { Exploration } from '../../../data/protocol/observer-protocol';
import type { PotentialDirection } from '../../../services/ai/flow-summaries';
import { DefaultPotentialDirectionsService } from '../../../services/ai/potential-directions-service';

export type DirectionsStatus = 'idle' | 'generating' | 'ready' | 'insufficient' | 'error';

export interface PotentialDirectionsState {
  potentialDirections: PotentialDirection[];
  directionsStatus: DirectionsStatus;
  directionsMessage: string;
  triggerDirections: () => void;
}

export function usePotentialDirections(input: {
  runtimeModel: string;
  explorations: Exploration[];
  summaries: Record<string, string>;
  summaryModel?: string;
}): PotentialDirectionsState {
  const { runtimeModel, explorations, summaries, summaryModel } = input;
  const [potentialDirections, setPotentialDirections] = useState<PotentialDirection[]>([]);
  const [directionsStatus, setDirectionsStatus] = useState<DirectionsStatus>('idle');
  const [directionsMessage, setDirectionsMessage] = useState('');
  const serviceRef = useRef(new DefaultPotentialDirectionsService());

  const triggerDirections = useCallback(() => {
    setDirectionsStatus('generating');
    setDirectionsMessage('');
    serviceRef.current.suggestFromExplorations({
      runtimeModel,
      explorations,
      summaries,
      summaryModel,
    })
      .then((result) => {
        if (result.status === 'insufficient') {
          setPotentialDirections([]);
          setDirectionsStatus('insufficient');
          setDirectionsMessage(result.message || '当前证据不足，请继续补充探索。');
        } else {
          setPotentialDirections(result.directions);
          setDirectionsStatus('ready');
          setDirectionsMessage('');
        }
      })
      .catch(() => {
        setPotentialDirections([]);
        setDirectionsStatus('error');
        setDirectionsMessage('方向建议生成失败，请稍后重试。');
      });
  }, [runtimeModel, explorations, summaries, summaryModel]);

  return {
    potentialDirections,
    directionsStatus,
    directionsMessage,
    triggerDirections,
  };
}
