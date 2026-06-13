import { useState, useEffect, useMemo } from 'react';
import type { ScheduleMatch } from '../types';
import { getFlag, getFr } from '../data/nameMapping';
import { getWilooContext, getEurosportContext } from '../api/reportGenerator';
import type { WilooTeamSummary, EurosportContext } from '../api/reportGenerator';
import { generateBriefing, getCachedBriefing } from '../api/briefing';
import type { Briefing, BriefingSources } from '../api/briefing';
import { fetchFigaroPronostic } from '../api/figaro';
import type { FigaroPronostic } from '../api/figaro';
import oddsData from '../data/generated/tournament-odds.json';
import QuantitativeSection from './QuantitativeSection';
import { getQuantitativeData } from '../api/reportGenerator';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getMatchTimes } from '../utils/matchTime';

const teamsOdds = oddsData.teams as Record<string, { odds: number; rank: number; probability: number }>;

import { useWeather } from '../hooks/useWeather';

function WeatherBadge({ match }: { match: ScheduleMatch }) {
  const weather = useWeather(match.ground, match.date, match.time);
  if (!weather) return null;

  return (
    <div className="flex items-center gap-2 bg-wc-dark/40 border border-wc-border/50 rounded-full px-3 py-1">
      <span className="text-lg">{weather.icon}</span>
      <span className="text-sm font-bold">{weather.temp}°C</span>
      <span className="text-[10px] text-wc-muted">💨 {weather.wind} km/h</span>
      <span className="text-[10px] text-wc-muted">💧 {weather.humidity}%</span>
    </div>
  );
}

function OddsBadge({ team }: { team: string }) {
  const info = teamsOdds[team];
  if (!info) return null;
  return (
    <span className={`text-[10px] ${info.rank <= 10 ? 'text-wc-gold' : 'text-wc-muted'}`}>
      #{info.rank} · {info.probability}%
    </span>
  );
}

interface Props {
  match: ScheduleMatch;
}

type TabKey = 'briefing' | 'sources' | 'stats';

export default function MatchReportView({ match }: Props) {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('stats');

  useEffect(() => {
    const cached = getCachedBriefing(match.id);
    setBriefing(cached);
    setError('');
    setActiveTab('stats');

    if (!cached) {
      setLoading(true);
      generateBriefing(match, setProgress)
        .then((b) => setBriefing(b))
        .catch((e) => setError(e instanceof Error ? e.message : 'Erreur inconnue'))
        .finally(() => { setLoading(false); setProgress(''); });
    }
  }, [match.id]);

  const quantData = getQuantitativeData(match.team1, match.team2);

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'stats', label: 'Stats détaillées' },
    { key: 'briefing', label: 'Briefing' },
    { key: 'sources', label: 'Sources' },
  ];

  return (
    <div className="bg-wc-card border border-wc-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-wc-green/20 border-b border-wc-border p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <span className="text-xs text-wc-muted">
            {match.date} · {match.group ?? match.round}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-xs text-wc-text font-medium">
              🇫🇷 {getMatchTimes(match.date, match.time, match.ground).france}
            </span>
            <span className="text-xs text-wc-muted">
              {getMatchTimes(match.date, match.time, match.ground).local} loc.
            </span>
            <WeatherBadge match={match} />
          </div>
          <span className="text-xs text-wc-muted">{match.ground}</span>
        </div>
        <div className="flex items-center justify-center gap-6">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{getFlag(match.team1)}</span>
            <div>
              <span className="text-xl font-bold italic">{getFr(match.team1)}</span>
              <div><OddsBadge team={match.team1} /></div>
            </div>
          </div>
          <span className="text-wc-muted font-bold italic text-lg">vs</span>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-xl font-bold italic">{getFr(match.team2)}</span>
              <div><OddsBadge team={match.team2} /></div>
            </div>
            <span className="text-4xl">{getFlag(match.team2)}</span>
          </div>
        </div>
        {briefing && (
          <div className="mt-4 text-center">
            <div className="inline-flex items-center gap-2.5 bg-wc-gold/15 border border-wc-gold/30 px-5 py-2 rounded-full">
              <span className="text-sm font-bold italic text-wc-gold">Prono</span>
              <span className="text-lg">{getFlag(match.team1)}</span>
              <div className="flex items-center gap-1">
                <span className="w-7 h-7 rounded-lg bg-wc-gold/25 text-wc-gold font-black text-base flex items-center justify-center">{briefing.score[0]}</span>
                <span className="text-wc-muted text-xs">-</span>
                <span className="w-7 h-7 rounded-lg bg-wc-gold/25 text-wc-gold font-black text-base flex items-center justify-center">{briefing.score[1]}</span>
              </div>
              <span className="text-lg">{getFlag(match.team2)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-wc-border overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-3 text-sm font-bold italic whitespace-nowrap transition ${
              activeTab === tab.key
                ? 'text-wc-gold border-b-2 border-wc-gold'
                : 'text-wc-muted hover:text-wc-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-5">
        {activeTab === 'briefing' && (
          <BriefingTab briefing={briefing} loading={loading} progress={progress} error={error} match={match} />
        )}
        {activeTab === 'sources' && (
          <SourcesTab match={match} briefingSources={briefing?.sources ?? null} />
        )}
        {activeTab === 'stats' && (
          <QuantitativeSection team1={match.team1} team2={match.team2} data={quantData} />
        )}
      </div>
    </div>
  );
}

// ─── Briefing Tab ────────────────────────────────────────────────────────────

function BriefingTab({ briefing, loading, progress, error, match }: {
  briefing: Briefing | null;
  loading: boolean;
  progress: string;
  error: string;
  match: ScheduleMatch;
}) {
  if (loading) {
    return (
      <div className="py-12 text-center space-y-4">
        <div className="inline-block w-8 h-8 border-2 border-wc-gold border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-wc-muted">{progress || 'Génération du briefing GPT-5.5...'}</p>
        <p className="text-xs text-wc-muted/60">Collecte des sources + synthèse · ~10-15s</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center space-y-3">
        <p className="text-red-400 text-sm">{error}</p>
        <p className="text-xs text-wc-muted">Rechargez la page ou sélectionnez un autre match pour réessayer.</p>
      </div>
    );
  }

  if (!briefing) return null;

  return (
    <div className="space-y-6">
      {/* Score hero */}
      <div className="flex items-center justify-center gap-6 py-3">
        <div className="text-center">
          <span className="text-4xl">{getFlag(match.team1)}</span>
          <div className="text-sm font-bold italic mt-1">{getFr(match.team1)}</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="w-12 h-12 rounded-xl bg-wc-gold/20 text-wc-gold font-black text-2xl flex items-center justify-center">
              {briefing.score[0]}
            </span>
            <span className="text-wc-muted font-bold">-</span>
            <span className="w-12 h-12 rounded-xl bg-wc-gold/20 text-wc-gold font-black text-2xl flex items-center justify-center">
              {briefing.score[1]}
            </span>
          </div>
          <div className="text-sm text-wc-muted mt-2">
            Confiance : {'⭐'.repeat(briefing.confidence)}{'☆'.repeat(5 - briefing.confidence)}
          </div>
        </div>
        <div className="text-center">
          <span className="text-4xl">{getFlag(match.team2)}</span>
          <div className="text-sm font-bold italic mt-1">{getFr(match.team2)}</div>
        </div>
      </div>

      {/* Briefing text */}
      <div className="prose-report">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => (
              <p className="text-sm text-wc-text/90 leading-relaxed mb-3">{children}</p>
            ),
            strong: ({ children }) => (
              <strong className="text-wc-text font-bold">{children}</strong>
            ),
            h1: ({ children }) => (
              <h1 className="text-xl font-bold text-wc-gold mt-5 mb-3">{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-lg font-bold text-wc-gold mt-4 mb-2">{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-base font-bold text-wc-gold mt-3 mb-2">{children}</h3>
            ),
            ul: ({ children }) => (
              <ul className="space-y-1.5 mb-3 ml-1">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="space-y-1.5 mb-3 ml-1 list-decimal list-inside">{children}</ol>
            ),
            li: ({ children }) => (
              <li className="text-sm text-wc-text/90 leading-relaxed flex gap-2">
                <span className="text-wc-gold mt-0.5 shrink-0">•</span>
                <span>{children}</span>
              </li>
            ),
            a: ({ children, href }) => (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                {children}
              </a>
            ),
          }}
        >
          {briefing.briefing}
        </ReactMarkdown>
      </div>

      <p className="text-xs text-wc-muted text-center pt-2 border-t border-wc-border">
        Briefing généré le {new Date(briefing.generatedAt).toLocaleString('fr-FR')} · GPT-5.5
      </p>
    </div>
  );
}

// ─── Sources Tab (Audit) ─────────────────────────────────────────────────────

function SourcesTab({ match, briefingSources }: { match: ScheduleMatch; briefingSources: BriefingSources | null }) {
  const wilooData = useMemo(() => getWilooContext(match.team1, match.team2), [match.team1, match.team2]);
  const hasWiloo = !!(wilooData.team1?.summary || wilooData.team2?.summary);

  return (
    <div className="space-y-6">
      <p className="text-xs text-wc-muted italic mb-4">
        Contenu brut de chaque source injecté dans le briefing GPT-5.5, pour vérification.
      </p>

      <CollapsibleSection icon="📊" title="Données quantitatives" subtitle="(statique)">
        {briefingSources?.quantiText ? (
          <pre className="text-xs text-wc-text/80 bg-wc-dark/50 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed border border-wc-border">
            {briefingSources.quantiText}
          </pre>
        ) : (
          <p className="text-sm text-wc-muted">Données disponibles dans l'onglet Stats détaillées.</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection icon="▶" title="Wiloo — Analyse YouTube" subtitle="(1M+ abonnés)">
        {hasWiloo ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {wilooData.team1?.summary && <WilooTeamCard team={match.team1} data={wilooData.team1} />}
            {wilooData.team2?.summary && <WilooTeamCard team={match.team2} data={wilooData.team2} />}
          </div>
        ) : (
          <p className="text-sm text-wc-muted py-2">Aucune analyse Wiloo disponible pour ces équipes.</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection icon="📰" title="Le Figaro — Pronostics" subtitle="(paris-sportifs.lefigaro.fr)">
        <FigaroBlock match={match} />
      </CollapsibleSection>

      <CollapsibleSection icon="🎙️" title="Eurosport — Articles récents" subtitle="(via Perplexity)">
        <EurosportBlock match={match} />
      </CollapsibleSection>

      <CollapsibleSection icon="🎰" title="Cotes tournoi" subtitle="(Winamax)">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[match.team1, match.team2].map((team) => {
            const odds = teamsOdds[team];
            return (
              <div key={team} className="bg-wc-dark/50 rounded-lg border border-wc-border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{getFlag(team)}</span>
                  <span className="font-bold">{team}</span>
                </div>
                {odds ? (
                  <div className="space-y-1 text-sm text-wc-text/80">
                    <p>Cote victoire tournoi : <span className="text-wc-gold font-bold">{odds.odds}</span></p>
                    <p>Rang : <span className="font-bold">#{odds.rank}</span></p>
                    <p>Probabilité implicite : <span className="font-bold">{odds.probability}%</span></p>
                  </div>
                ) : (
                  <p className="text-sm text-wc-muted">Non disponible</p>
                )}
              </div>
            );
          })}
        </div>
      </CollapsibleSection>
    </div>
  );
}

// ─── Shared sub-components ───────────────────────────────────────────────────

function CollapsibleSection({ icon, title, subtitle, children }: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 mb-3 w-full text-left group cursor-pointer"
      >
        <span className={`text-wc-muted text-xs transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
        <span className="text-lg">{icon}</span>
        <h3 className="text-lg font-bold text-wc-gold group-hover:text-wc-gold/80 transition">{title}</h3>
        {subtitle && <span className="text-xs text-wc-muted">{subtitle}</span>}
      </button>
      {open && children}
    </section>
  );
}

function WilooTeamCard({ team, data }: { team: string; data: WilooTeamSummary }) {
  const tierColors: Record<string, string> = {
    'Favori #1': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    'Favori #2': 'bg-yellow-600/20 text-yellow-500 border-yellow-600/30',
    'Peut gagner': 'bg-green-500/20 text-green-400 border-green-500/30',
    'Top 4 mais pas vainqueur': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'Outsider rang 1B': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    'Surprise possible': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  };
  const tierClass = tierColors[data.tier] ?? 'bg-wc-dark/50 text-wc-muted border-wc-border';

  return (
    <div className="bg-wc-dark/50 rounded-lg border border-wc-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{getFlag(team)}</span>
          <h4 className="font-bold text-wc-text">{team}</h4>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${tierClass}`}>
          {data.tier}
        </span>
      </div>
      <p className="text-sm text-wc-text/90 leading-relaxed">{data.summary}</p>
      {data.strengths && (
        <div className="bg-green-900/15 border border-green-800/20 rounded-lg p-3">
          <h5 className="text-xs font-bold text-green-400 mb-1.5 uppercase tracking-wider">Forces</h5>
          <p className="text-sm text-wc-text/80 leading-relaxed">{data.strengths}</p>
        </div>
      )}
      {data.weaknesses && (
        <div className="bg-red-900/15 border border-red-800/20 rounded-lg p-3">
          <h5 className="text-xs font-bold text-red-400 mb-1.5 uppercase tracking-wider">Faiblesses</h5>
          <p className="text-sm text-wc-text/80 leading-relaxed">{data.weaknesses}</p>
        </div>
      )}
      {data.players && (
        <div>
          <h5 className="text-xs font-bold text-wc-muted mb-1.5 uppercase tracking-wider">Joueurs clés</h5>
          <div className="flex flex-wrap gap-1.5">
            {data.players.split(', ').map((p) => (
              <span key={p} className="text-xs bg-wc-green/30 text-wc-text/80 px-2 py-0.5 rounded-full">{p}</span>
            ))}
          </div>
        </div>
      )}
      {data.videos.length > 0 && (
        <div className="flex gap-2 pt-1 flex-wrap">
          {data.videos.map((v) => (
            <a key={v} href={`https://www.youtube.com/watch?v=${v}`} target="_blank" rel="noopener noreferrer"
              className="text-xs text-red-400 hover:text-red-300 transition flex items-center gap-1">
              <span>▶</span> Vidéo Wiloo
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function FigaroBlock({ match }: { match: ScheduleMatch }) {
  const [figaro, setFigaro] = useState<FigaroPronostic | null>(null);
  const [status, setStatus] = useState<'loading' | 'done' | 'notfound'>('loading');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setFigaro(null);
    fetchFigaroPronostic(match.id, match.team1, match.team2, match.date)
      .then((f) => { if (!cancelled) { setFigaro(f); setStatus(f ? 'done' : 'notfound'); } })
      .catch(() => !cancelled && setStatus('notfound'));
    return () => { cancelled = true; };
  }, [match.id, match.team1, match.team2, match.date]);

  if (status === 'loading') return <p className="text-sm text-wc-muted py-3">Chargement...</p>;
  if (status === 'notfound' || !figaro) {
    return <p className="text-sm text-wc-muted py-3">Article pas encore publié — paraît ~2 jours avant le match.</p>;
  }

  const p = figaro.winProbability;
  return (
    <div className="space-y-4">
      {p && (
        <div className="bg-wc-dark/50 rounded-lg border border-wc-border p-4">
          <h5 className="text-xs font-bold text-wc-muted mb-3 uppercase tracking-wider">Chances de victoire</h5>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold w-28 text-right">{getFlag(match.team1)} {p.team1}%</span>
            <div className="flex-1 h-3 rounded-full overflow-hidden bg-wc-dark flex">
              <div className="bg-wc-gold" style={{ width: `${p.team1}%` }} />
              <div className="bg-wc-border/60" style={{ width: `${100 - p.team1 - p.team2}%` }} />
              <div className="bg-blue-500" style={{ width: `${p.team2}%` }} />
            </div>
            <span className="text-sm font-bold w-28">{p.team2}% {getFlag(match.team2)}</span>
          </div>
        </div>
      )}
      {figaro.summary ? (
        <div className="prose-report">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
            p: ({ children }) => <p className="text-sm text-wc-text/90 leading-relaxed mb-3">{children}</p>,
            strong: ({ children }) => <strong className="text-wc-text font-bold">{children}</strong>,
            h2: ({ children }) => <h2 className="text-base font-bold text-wc-gold mt-4 mb-2">{children}</h2>,
            h3: ({ children }) => <h3 className="text-sm font-bold text-wc-gold mt-3 mb-1.5">{children}</h3>,
            ul: ({ children }) => <ul className="space-y-1 mb-3 ml-1">{children}</ul>,
            li: ({ children }) => <li className="text-sm text-wc-text/80 flex gap-2"><span className="text-wc-gold">•</span><span>{children}</span></li>,
          }}>
            {figaro.summary}
          </ReactMarkdown>
        </div>
      ) : (
        <p className="text-sm text-wc-muted">Résumé en cours de génération...</p>
      )}
      <a href={figaro.url} target="_blank" rel="noopener noreferrer" className="inline-block text-xs text-wc-gold hover:underline">
        Lire l'article complet sur Le Figaro →
      </a>
    </div>
  );
}

const EUROSPORT_NO_CONTENT_PATTERNS = [
  /pas d['']article/i, /pas de contenu/i, /rien publi[ée]/i, /ne publie pas/i,
  /ne donne pas/i, /pas de lecture [ée]ditoriale/i, /je ne vois pas/i, /je ne trouve pas/i,
  /aucun article/i, /pas d['']information/i, /pas de synth[eè]se/i,
  /se limitent au calendrier/i, /pas d['']analyse/i, /pas de couverture/i,
];

function EurosportBlock({ match }: { match: ScheduleMatch }) {
  const [ctx, setCtx] = useState<EurosportContext | null>(null);
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setCtx(null);
    getEurosportContext(match.id, match.team1, match.team2, match.date)
      .then((c) => { if (!cancelled) { setCtx(c); setStatus('done'); } })
      .catch(() => !cancelled && setStatus('error'));
    return () => { cancelled = true; };
  }, [match.id, match.team1, match.team2, match.date]);

  if (status === 'loading') return <p className="text-sm text-wc-muted py-3">Recherche Eurosport (Perplexity)...</p>;
  if (status === 'error' || !ctx) return <p className="text-sm text-red-400 py-3">Impossible de récupérer le contexte Eurosport.</p>;

  const noContent = EUROSPORT_NO_CONTENT_PATTERNS.filter((p) => p.test(ctx.content)).length >= 3;

  if (noContent) {
    return (
      <div>
        <p className="text-sm text-wc-muted italic py-3">Pas de contenu Eurosport pertinent pour ce match.</p>
        {ctx.citations.length > 0 && <CitationPills citations={ctx.citations} />}
      </div>
    );
  }

  return <ReportMarkdown content={ctx.content} citations={ctx.citations} />;
}

function CitationPills({ citations }: { citations: string[] }) {
  return (
    <div className="mt-3 pt-3 border-t border-wc-border">
      <h4 className="text-xs font-bold text-wc-muted mb-2 uppercase tracking-wider">Sources</h4>
      <div className="flex flex-wrap gap-2">
        {citations.map((url, i) => {
          let label = url;
          try { label = new URL(url).hostname.replace('www.', ''); } catch { /* ignore */ }
          return (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs bg-wc-dark/60 border border-wc-border/50 text-blue-400 hover:text-blue-300 hover:border-blue-400/30 px-2.5 py-1 rounded-full transition">
              <span className="opacity-60">↗</span>{label}
            </a>
          );
        })}
      </div>
    </div>
  );
}

function ReportMarkdown({ content, citations }: { content: string; citations: string[] }) {
  const cleaned = useMemo(() => content.replace(/\[\d+\]/g, '').replace(/\n{3,}/g, '\n\n').trim(), [content]);
  return (
    <div>
      <div className="prose-report">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            table: ({ children }) => <div className="overflow-x-auto my-4 rounded-lg border border-wc-border"><table className="w-full text-sm">{children}</table></div>,
            thead: ({ children }) => <thead className="bg-wc-green/30 text-wc-gold">{children}</thead>,
            th: ({ children }) => <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider border-b border-wc-border">{children}</th>,
            td: ({ children }) => <td className="px-3 py-2 border-b border-wc-border/50 text-wc-text/90">{children}</td>,
            tr: ({ children }) => <tr className="even:bg-wc-dark/30 hover:bg-wc-dark/50 transition">{children}</tr>,
            p: ({ children }) => <p className="text-sm text-wc-text/90 leading-relaxed mb-3">{children}</p>,
            strong: ({ children }) => <strong className="text-wc-text font-bold">{children}</strong>,
            h2: ({ children }) => <h2 className="text-lg font-bold text-wc-gold mt-4 mb-2">{children}</h2>,
            h3: ({ children }) => <h3 className="text-base font-bold text-wc-gold mt-3 mb-2">{children}</h3>,
            ul: ({ children }) => <ul className="space-y-1.5 mb-3 ml-1">{children}</ul>,
            li: ({ children }) => <li className="text-sm text-wc-text/90 leading-relaxed flex gap-2"><span className="text-wc-gold mt-0.5 shrink-0">•</span><span>{children}</span></li>,
            a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{children}</a>,
          }}
        >
          {cleaned}
        </ReactMarkdown>
      </div>
      {citations.length > 0 && <CitationPills citations={citations} />}
    </div>
  );
}
