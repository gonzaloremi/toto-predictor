import type { AgentEvent, StructuredAnalysis } from './agent';

interface FakeStep {
  delayMs: number;
  event: AgentEvent;
}

export function simulateFakeAgent(
  analysis: StructuredAnalysis,
  onEvent: (event: AgentEvent) => void,
  signal?: AbortSignal,
): void {
  const steps: FakeStep[] = [
    { delayMs: 0, event: { type: 'llm_call', text: 'Phase 1 — Collecte de données', iteration: 1 } },
    { delayMs: 800, event: { type: 'thinking', text: 'Recherche des analyses Wiloo...' } },
    { delayMs: 1500, event: { type: 'tool_start', toolName: 'search_wiloo', toolArgs: '{"teams": [...]}' } },
    { delayMs: 3200, event: { type: 'tool_done', toolName: 'search_wiloo', toolResult: 'Transcripts trouvés et analysés.' } },
    { delayMs: 3800, event: { type: 'tool_start', toolName: 'get_match_stats', toolArgs: '{}' } },
    { delayMs: 5000, event: { type: 'tool_done', toolName: 'get_match_stats', toolResult: 'Statistiques récupérées.' } },
    { delayMs: 5500, event: { type: 'tool_start', toolName: 'get_tournament_odds', toolArgs: '{}' } },
    { delayMs: 6200, event: { type: 'tool_done', toolName: 'get_tournament_odds', toolResult: 'Cotes récupérées.' } },
    { delayMs: 6800, event: { type: 'tool_start', toolName: 'search_sofoot', toolArgs: '{"query": "..."}' } },
    { delayMs: 8000, event: { type: 'tool_done', toolName: 'search_sofoot', toolResult: 'Articles So Foot récupérés.' } },
    { delayMs: 8300, event: { type: 'thinking', text: 'Phase 2 — Synthèse avec Claude Opus 4.6...' } },
    { delayMs: 9500, event: { type: 'structured', structured: analysis } },
    { delayMs: 10000, event: { type: 'done' } },
  ];

  for (const step of steps) {
    setTimeout(() => {
      if (signal?.aborted) return;
      onEvent(step.event);
    }, step.delayMs);
  }
}
