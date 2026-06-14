import { useState, useEffect, useRef, useCallback } from 'react';
import type { ScheduleMatch } from '../types';
import { runAgent, type AgentEvent, type StructuredAnalysis, type AgentSource } from '../api/agent';
import { getFlag, getFr } from '../data/nameMapping';

type AgentState = 'idle' | 'running' | 'paused' | 'done' | 'error';

interface LogEntry {
  id: number;
  timestamp: Date;
  event: AgentEvent;
}

const TOOL_META: Record<string, { icon: string; label: string; desc: string }> = {
  search_wiloo: { icon: '▶', label: 'search_wiloo', desc: 'Recherche dans les transcripts Wiloo' },
  get_match_stats: { icon: '📊', label: 'get_match_stats', desc: 'Statistiques du match' },
  get_tournament_odds: { icon: '🎰', label: 'get_tournament_odds', desc: 'Cotes tournoi Winamax' },
  get_group_context: { icon: '📋', label: 'get_group_context', desc: 'Contexte du groupe' },
  search_sofoot: { icon: '📰', label: 'search_sofoot', desc: 'Articles So Foot' },
};

export default function AgenticTab({ match }: { match: ScheduleMatch }) {
  const [state, setState] = useState<AgentState>('idle');
  const [analysis, setAnalysis] = useState<StructuredAnalysis | null>(null);
  const [fallbackText, setFallbackText] = useState('');
  const [log, setLog] = useState<LogEntry[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [showTrace, setShowTrace] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const logIdRef = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((event: AgentEvent) => {
    const entry: LogEntry = { id: logIdRef.current++, timestamp: new Date(), event };
    setLog((prev) => [...prev, entry]);
  }, []);

  useEffect(() => {
    if (showTrace) logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log, showTrace]);

  const launch = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState('running');
    setAnalysis(null);
    setFallbackText('');
    setLog([]);
    setErrorMsg('');
    logIdRef.current = 0;

    runAgent(
      match,
      (event: AgentEvent) => {
        if (controller.signal.aborted) return;
        addLog(event);
        switch (event.type) {
          case 'structured':
            if (event.structured) setAnalysis(event.structured);
            break;
          case 'text':
            setFallbackText((prev) => prev + (event.text ?? ''));
            break;
          case 'done':
            setState('done');
            break;
          case 'error':
            setState('error');
            setErrorMsg(event.text ?? 'Erreur inconnue');
            break;
        }
      },
      controller.signal,
    );
  }, [match, addLog]);

  const pause = useCallback(() => {
    abortRef.current?.abort();
    setState('paused');
    addLog({ type: 'thinking', text: 'Agent mis en pause par l\'utilisateur' });
  }, [addLog]);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, [match.id]);

  const toolCallCount = log.filter((l) => l.event.type === 'tool_done').length;
  const iterationCount = log.filter((l) => l.event.type === 'llm_call').length;
  const currentPhase = log.some((l) => l.event.type === 'thinking' && l.event.text?.includes('Phase 2'))
    ? 2 : (log.length > 0 ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h3 className="text-sm font-bold italic text-wc-gold uppercase tracking-wider">Agent Analyst</h3>
          <StateBadge state={state} />
          {state === 'running' && (
            <span className="text-[10px] text-wc-muted">
              {currentPhase === 1 ? 'Collecte (GPT-4o-mini)' : 'Synthese (Opus 4.6)'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {log.length > 0 && (
            <button
              onClick={() => setShowTrace((v) => !v)}
              className="text-[10px] text-wc-muted hover:text-wc-text transition cursor-pointer"
            >
              {showTrace ? 'Masquer trace' : 'Voir trace'}
            </button>
          )}
          {(state === 'idle' || state === 'paused' || state === 'done' || state === 'error') && (
            <button
              onClick={launch}
              className="flex items-center gap-1.5 text-xs font-bold text-wc-dark bg-wc-gold hover:bg-wc-gold/80 transition px-3 py-1.5 rounded-lg cursor-pointer"
            >
              {state === 'idle' ? 'Lancer' : 'Relancer'}
            </button>
          )}
          {state === 'running' && (
            <button
              onClick={pause}
              className="flex items-center gap-1.5 text-xs font-bold text-wc-gold border border-wc-gold/40 hover:bg-wc-gold/10 transition px-3 py-1.5 rounded-lg cursor-pointer"
            >
              Pause
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {state === 'running' && (
        <div className="flex items-center gap-3 text-[10px] text-wc-muted uppercase tracking-wider">
          <div className="flex-1 bg-wc-dark/60 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-wc-gold/60 rounded-full transition-all duration-700"
              style={{ width: currentPhase === 2 ? '80%' : `${Math.min(70, toolCallCount * 15)}%` }}
            />
          </div>
          <span>Outils: {toolCallCount} | Iter: {iterationCount}</span>
        </div>
      )}

      {/* Idle */}
      {state === 'idle' && log.length === 0 && (
        <div className="py-12 text-center space-y-3">
          <p className="text-sm text-wc-muted">
            Analyse de <strong className="text-wc-text">{getFr(match.team1)}</strong> vs <strong className="text-wc-text">{getFr(match.team2)}</strong>
          </p>
          <p className="text-xs text-wc-muted/60">
            Phase 1: GPT-4o-mini collecte les donnees (Wiloo, stats, cotes, groupe).
            Phase 2: Claude Opus 4.6 synthetise une analyse structuree.
          </p>
        </div>
      )}

      {/* Live trace (collapsible) */}
      {showTrace && log.length > 0 && (
        <div className="bg-wc-dark/40 border border-wc-border rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-wc-border/50 flex items-center justify-between">
            <span className="text-[10px] font-bold text-wc-muted uppercase tracking-wider">Live trace</span>
            {state === 'running' && <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
          </div>
          <div className="max-h-[400px] overflow-y-auto divide-y divide-wc-border/20">
            {log.map((entry) => (
              <LogEntryRow key={entry.id} entry={entry} />
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      )}

      {/* Structured analysis */}
      {analysis && <StructuredView analysis={analysis} match={match} />}

      {/* Fallback text */}
      {!analysis && fallbackText && (
        <div className="bg-wc-dark/30 border border-wc-gold/20 rounded-lg p-5">
          <p className="text-sm text-wc-text/90 leading-relaxed whitespace-pre-wrap">{fallbackText}</p>
        </div>
      )}

      {/* Error */}
      {state === 'error' && (
        <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-4">
          <p className="text-sm text-red-400 font-mono">{errorMsg}</p>
        </div>
      )}

      {/* Footer */}
      {state === 'done' && (
        <p className="text-xs text-wc-muted text-center pt-2 border-t border-wc-border">
          {getFlag(match.team1)} {getFr(match.team1)} vs {getFr(match.team2)} {getFlag(match.team2)} — GPT-4o-mini + Claude Opus 4.6 | {toolCallCount} outils
        </p>
      )}
    </div>
  );
}

// ─── Structured analysis view ────────────────────────────────────────────────

function StructuredView({ analysis, match }: { analysis: StructuredAnalysis; match: ScheduleMatch }) {
  const { team1, team2, headToHead, wilooVerdict, prediction, keyFactors } = analysis;

  return (
    <div className="space-y-4">
      {/* Prediction hero */}
      <div className="bg-wc-dark/50 border border-wc-gold/30 rounded-xl p-5 text-center space-y-3">
        <div className="text-[10px] text-wc-muted uppercase tracking-wider font-bold">Pronostic</div>
        <div className="flex items-center justify-center gap-6">
          <div className="text-right">
            <div className="text-xs text-wc-muted">{getFlag(match.team1)}</div>
            <div className="text-sm font-bold text-wc-text">{getFr(match.team1)}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black italic text-wc-gold tabular-nums">{prediction.score1}</span>
            <span className="text-sm text-wc-muted">-</span>
            <span className="text-2xl font-black italic text-wc-gold tabular-nums">{prediction.score2}</span>
          </div>
          <div className="text-left">
            <div className="text-xs text-wc-muted">{getFlag(match.team2)}</div>
            <div className="text-sm font-bold text-wc-text">{getFr(match.team2)}</div>
          </div>
        </div>
        <div className="flex items-center justify-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className={`text-sm ${i < prediction.confidence ? 'text-wc-gold' : 'text-wc-muted/30'}`}>
              ★
            </span>
          ))}
          <span className="text-[10px] text-wc-muted ml-1">Confiance</span>
        </div>
        <p className="text-xs text-wc-text/70 leading-relaxed max-w-lg mx-auto">{prediction.reasoning}</p>
      </div>

      {/* Team cards side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TeamCard team={team1} flag={getFlag(match.team1)} />
        <TeamCard team={team2} flag={getFlag(match.team2)} />
      </div>

      {/* Wiloo verdict */}
      <div className="bg-wc-dark/40 border border-purple-500/20 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Verdict Wiloo</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-wc-muted">Classement groupe:</span>
            <div className="mt-1 space-y-0.5">
              {wilooVerdict.groupRanking.map((team, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center ${i === 0 ? 'bg-wc-gold/20 text-wc-gold' : 'bg-wc-dark/60 text-wc-muted'}`}>
                    {i + 1}
                  </span>
                  <span className="text-wc-text/80">{team}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <span className="text-wc-muted">Favori:</span>
              <span className="text-wc-gold font-bold ml-1">{wilooVerdict.favorite}</span>
            </div>
            <div>
              <span className="text-wc-muted">Coach:</span>
              <span className="text-wc-text/80 ml-1">{wilooVerdict.coachComparison}</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-purple-300/70 italic leading-relaxed border-l-2 border-purple-500/30 pl-3">
          "{wilooVerdict.keyArgument}"
        </p>
      </div>

      {/* Key factors */}
      {keyFactors.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-wc-muted uppercase tracking-wider">Facteurs cles</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {keyFactors.map((kf, i) => (
              <div key={i} className="bg-wc-dark/30 border border-wc-border/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] text-wc-gold font-bold">{kf.team}</span>
                  <span className="text-xs text-wc-text font-semibold">{kf.advantage}</span>
                </div>
                <p className="text-[11px] text-wc-text/60 leading-relaxed">{kf.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Head to head */}
      {headToHead && (
        <div className="bg-wc-dark/30 border border-wc-border/50 rounded-lg p-3">
          <div className="text-[10px] font-bold text-wc-muted uppercase tracking-wider mb-1">Confrontations directes</div>
          <p className="text-xs text-wc-text/70 leading-relaxed">{headToHead}</p>
        </div>
      )}

      {/* Sources */}
      {analysis.sources && analysis.sources.length > 0 && (
        <SourcesList sources={analysis.sources} />
      )}
    </div>
  );
}

function TeamCard({ team, flag }: { team: StructuredAnalysis['team1']; flag: string }) {
  return (
    <div className="bg-wc-dark/40 border border-wc-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm">{flag}</span>
        <span className="text-sm font-bold italic text-wc-text">{team.name}</span>
      </div>

      <div className="text-xs text-wc-text/70 leading-relaxed">{team.form}</div>

      <div className="space-y-1.5">
        {team.strengths.map((s, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <span className="text-green-400 text-[10px] mt-0.5 shrink-0">+</span>
            <span className="text-[11px] text-wc-text/70">{s}</span>
          </div>
        ))}
        {team.weaknesses.map((w, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <span className="text-red-400 text-[10px] mt-0.5 shrink-0">-</span>
            <span className="text-[11px] text-wc-text/70">{w}</span>
          </div>
        ))}
      </div>

      {team.keyPlayers.length > 0 && (
        <div>
          <div className="text-[10px] text-wc-muted uppercase tracking-wider mb-1">Joueurs cles</div>
          <div className="space-y-0.5">
            {team.keyPlayers.map((p, i) => (
              <div key={i} className="text-[11px] text-wc-text/60">{p}</div>
            ))}
          </div>
        </div>
      )}

      <div className="text-[11px] text-blue-300/60 italic leading-relaxed border-l-2 border-blue-500/20 pl-2">
        "{team.wilooQuote}"
      </div>
    </div>
  );
}

function SourcesList({ sources }: { sources: AgentSource[] }) {
  const wiloo = sources.filter((s) => s.type === 'wiloo');
  const sofoot = sources.filter((s) => s.type === 'sofoot');

  return (
    <div className="bg-wc-dark/30 border border-wc-border/50 rounded-lg p-3 space-y-2">
      <div className="text-[10px] font-bold text-wc-muted uppercase tracking-wider">Sources</div>
      {wiloo.length > 0 && (
        <div className="space-y-1">
          {wiloo.map((s, i) => (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[11px] text-red-400/80 hover:text-red-300 transition"
            >
              <span className="shrink-0">▶</span>
              <span className="truncate">{s.label}</span>
            </a>
          ))}
        </div>
      )}
      {sofoot.length > 0 && (
        <div className="space-y-1">
          {sofoot.map((s, i) => (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[11px] text-blue-400/80 hover:text-blue-300 transition"
            >
              <span className="shrink-0">📰</span>
              <span className="truncate">{s.label}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StateBadge({ state }: { state: AgentState }) {
  const map: Record<AgentState, { label: string; cls: string }> = {
    idle: { label: 'Pret', cls: 'bg-wc-dark/50 text-wc-muted' },
    running: { label: 'En cours', cls: 'bg-wc-gold/15 text-wc-gold animate-pulse' },
    paused: { label: 'Pause', cls: 'bg-orange-500/15 text-orange-400' },
    done: { label: 'Termine', cls: 'bg-green-500/15 text-green-400' },
    error: { label: 'Erreur', cls: 'bg-red-500/15 text-red-400' },
  };
  const c = map[state];
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${c.cls}`}>
      {c.label}
    </span>
  );
}

function LogEntryRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const { event } = entry;
  const time = entry.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const getIcon = () => {
    switch (event.type) {
      case 'llm_call': return '🧠';
      case 'llm_response': return '💬';
      case 'tool_start': return TOOL_META[event.toolName!]?.icon ?? '🔧';
      case 'tool_done': return '✅';
      case 'text': return '✍️';
      case 'thinking': return '💭';
      case 'structured': return '📦';
      case 'done': return '🏁';
      case 'error': return '❌';
    }
  };

  const getLabel = () => {
    switch (event.type) {
      case 'llm_call': return event.text ?? `Appel LLM #${event.iteration}`;
      case 'llm_response': return event.text ?? 'Reponse';
      case 'tool_start': return `${TOOL_META[event.toolName!]?.desc ?? event.toolName}`;
      case 'tool_done': return `${event.toolName} termine (${event.toolResult?.length ?? 0} chars)`;
      case 'text': return `Texte (${event.text?.length ?? 0} chars)`;
      case 'thinking': return event.text ?? '';
      case 'structured': return 'Analyse structuree recue';
      case 'done': return 'Analyse complete';
      case 'error': return event.text ?? 'Erreur';
    }
  };

  const hasDetail = event.type === 'tool_start' || event.type === 'tool_done' || event.type === 'text';

  const getTypeColor = () => {
    switch (event.type) {
      case 'llm_call': return 'text-blue-400';
      case 'llm_response': return 'text-purple-400';
      case 'tool_start': return 'text-yellow-400';
      case 'tool_done': return 'text-green-400';
      case 'text': return 'text-wc-gold';
      case 'thinking': return 'text-cyan-400';
      case 'structured': return 'text-wc-gold';
      case 'done': return 'text-green-400';
      case 'error': return 'text-red-400';
      default: return 'text-wc-muted';
    }
  };

  return (
    <div className="group">
      <button
        onClick={() => hasDetail && setExpanded((o) => !o)}
        className={`w-full flex items-start gap-2 px-3 py-1.5 text-left ${hasDetail ? 'cursor-pointer hover:bg-wc-dark/30' : ''}`}
      >
        <span className="text-xs mt-0.5 shrink-0 w-4 text-center">{getIcon()}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-mono ${getTypeColor()}`}>{event.type}</span>
            <span className="text-[11px] text-wc-text/70 truncate">{getLabel()}</span>
          </div>
        </div>
        <span className="text-[10px] text-wc-muted/50 font-mono shrink-0">{time}</span>
        {hasDetail && (
          <span className={`text-[10px] text-wc-muted/40 transition-transform shrink-0 ${expanded ? 'rotate-90' : ''}`}>▶</span>
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-2 pl-9">
          {event.type === 'tool_start' && event.toolArgs && (
            <pre className="text-[10px] text-blue-300/60 bg-wc-dark/60 rounded p-2 font-mono whitespace-pre-wrap max-h-20 overflow-y-auto border border-wc-border/30">
              {event.toolArgs}
            </pre>
          )}
          {event.type === 'tool_done' && event.toolResult && (
            <pre className="text-[10px] text-green-300/50 bg-wc-dark/60 rounded p-2 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto border border-wc-border/30">
              {event.toolResult.slice(0, 3000)}{event.toolResult.length > 3000 ? '\n...' : ''}
            </pre>
          )}
          {event.type === 'text' && event.text && (
            <pre className="text-[10px] text-wc-text/40 bg-wc-dark/60 rounded p-2 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto border border-wc-border/30">
              {event.text.slice(0, 2000)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
