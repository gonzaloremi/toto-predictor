export interface ScheduleMatch {
  id: number;
  round: string;
  date: string;
  time: string;
  team1: string;
  team2: string;
  group?: string;
  ground: string;
  score?: { ft: [number, number]; ht?: [number, number] };
}

export interface TeamLastMatch {
  date: string;
  opponent: string;
  home: boolean;
  score: [number, number];
  tournament: string;
  result: 'W' | 'D' | 'L';
}

export interface TeamWcHistory {
  appearances: number;
  stats: {
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
  };
  matches: Array<{
    year: number;
    date: string;
    opponent: string;
    score: [number, number];
    home: boolean;
  }>;
}

export interface HeadToHeadRecord {
  totalMatches: number;
  wins: Record<string, number>;
  goals: Record<string, number>;
  lastMeetings: Array<{
    date: string;
    homeTeam: string;
    score: [number, number];
    tournament: string;
  }>;
  inWorldCup: Array<{
    date: string;
    homeTeam: string;
    score: [number, number];
    tournament: string;
  }>;
}

export interface TeamStats {
  recentForm: string;
  last10: {
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
  };
  avgGoalsScored: number;
  avgGoalsConceded: number;
  wcAppearances: number;
}

export interface MatchReport {
  matchId: number;
  generatedAt: string;
  team1: string;
  team2: string;
  odds: {
    raw: string;
    citations: string[];
  };
  pressAnalysis: {
    raw: string;
    citations: string[];
  };
  historicalBehavior: {
    raw: string;
    citations: string[];
  };
  prediction: {
    suggestedScore: [number, number];
    confidence: 1 | 2 | 3 | 4 | 5;
    reasoning: string;
    keyFactors: string[];
    riskFactors: string[];
  };
}
