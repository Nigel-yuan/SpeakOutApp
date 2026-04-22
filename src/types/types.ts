export type PracticeLanguage = 'zh-CN' | 'en-US';

export type RecordingStatus = 'idle' | 'preparing' | 'recording' | 'analyzing' | 'finished';

export type PracticeSceneKey =
  | 'hosting'
  | 'presentation'
  | 'impromptu'
  | 'briefing-defense'
  | 'interview-pitch';

export type RadarMetricKey =
  | 'contentStructure'
  | 'languageExpression'
  | 'fluencyRhythm'
  | 'vocalDelivery'
  | 'nonverbalPresence'
  | 'audienceImpact';

export interface PracticeScene {
  id: string;
  key: PracticeSceneKey;
  title: string;
  subtitle: string;
  goal: string;
  description: string;
  tags: string[];
  focusKeywords: string[];
  accentColor: [string, string];
  supportedLanguages: PracticeLanguage[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedDurationSec: number;
  coverVariant: string;
  isRecommended?: boolean;
}

export interface MetricChange {
  key: string;
  label: string;
  delta: number;
}

export interface SpeechRecord {
  id: string;
  sceneId: string;
  sceneTitle: string;
  title: string;
  language: PracticeLanguage;
  createdAt: string;
  durationSec: number;
  overallScore: number;
  scoreDelta: number;
  summary: string;
  metricChanges: MetricChange[];
  previewTranscript: string;
  reportId?: string;
}

export interface RadarMetricMeta {
  label: string;
  shortLabel: string;
  description: string;
}

export interface ReportSuggestion {
  id: string;
  title: string;
  detail: string;
  priority: 'high' | 'medium' | 'low';
  metricKey: RadarMetricKey;
}

export interface ReportComparisonPoint {
  recordId: string;
  label: string;
  overallScore: number;
}

export interface ReportData {
  id: string;
  relatedRecordId?: string;
  generatedAt: string;
  language: PracticeLanguage;
  sceneId: string;
  sceneTitle: string;
  headline: string;
  overview: string;
  overallScore: number;
  stars: number;
  scoreTrend: {
    delta: number;
    comparedToLabel: string;
  };
  radar: Record<RadarMetricKey, number>;
  radarMeta: Record<RadarMetricKey, RadarMetricMeta>;
  rawMetrics: Array<{
    key: RadarMetricKey;
    score: number;
  }>;
  highlights: string[];
  suggestions: ReportSuggestion[];
  coachSummary: string;
  comparison: ReportComparisonPoint[];
}

export interface TranscriptLine {
  id: string;
  text: string;
  timestampMs: number;
  confidence: number;
  speaker: 'user' | 'ai-note';
}

export interface LiveCoachMessage {
  id: string;
  tone: 'encouraging' | 'analytical' | 'celebratory';
  title: string;
  body: string;
  generatedAt: string;
  source: 'system' | 'ai';
}
