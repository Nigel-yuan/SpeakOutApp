import { create } from 'zustand';

import {
  type LiveCoachMessage,
  type PracticeLanguage,
  type PracticeScene,
  type RadarMetricKey,
  type RecordingStatus,
  type ReportData,
  type ReportSuggestion,
  type SpeechRecord,
  type TranscriptLine,
} from '../types/types';

const now = '2026-04-11T21:45:00+08:00';

const sceneCatalog: PracticeScene[] = [
  {
    id: 'host-cn',
    key: 'hosting',
    title: '主持人场景',
    subtitle: '控场、引导、节奏推进',
    description:
      '适合发布会、活动串场与舞台主持，重点训练镜头感、节奏推进和自然转场。',
    tags: ['控场', '引导', '节奏推进'],
    accentColor: ['#8B5CF6', '#D946EF'],
    supportedLanguages: ['zh-CN', 'en-US'],
    difficulty: 'intermediate',
    estimatedDurationSec: 180,
    coverVariant: 'violet-stage',
    isRecommended: true,
  },
  {
    id: 'guest-en',
    key: 'guest-sharing',
    title: '嘉宾分享场景',
    subtitle: '观点表达、故事讲述、逻辑递进',
    description:
      '面向专题分享与访谈表达，强调结构组织、论点落地和信息密度。',
    tags: ['故事讲述', '逻辑递进', '英文表达'],
    accentColor: ['#6D28D9', '#9333EA'],
    supportedLanguages: ['zh-CN', 'en-US'],
    difficulty: 'advanced',
    estimatedDurationSec: 240,
    coverVariant: 'nebula-glow',
  },
  {
    id: 'impromptu-cn',
    key: 'impromptu',
    title: '脱口秀场景',
    subtitle: '节奏、停顿、包袱与现场反馈',
    description:
      '用于训练即兴表达、幽默节奏和高压状态下的持续输出能力。',
    tags: ['节奏', '停顿', '互动反馈'],
    accentColor: ['#7C3AED', '#A855F7'],
    supportedLanguages: ['zh-CN'],
    difficulty: 'advanced',
    estimatedDurationSec: 150,
    coverVariant: 'midnight-lens',
  },
];

const historyRecords: SpeechRecord[] = [
  {
    id: 'record-2026-04-09-host',
    sceneId: 'host-cn',
    sceneTitle: '主持人场景',
    title: '上周三 · 中文主持',
    language: 'zh-CN',
    createdAt: '2026-04-09T19:30:00+08:00',
    durationSec: 196,
    overallScore: 76,
    scoreDelta: 4,
    summary:
      '开场自然，但在串联环节上略有停顿，和嘉宾互动时还有进一步放松的空间。',
    metricChanges: [
      { key: 'stagePresence', label: '控场', delta: 8 },
      { key: 'interaction', label: '互动', delta: 6 },
      { key: 'pacing', label: '节奏', delta: -2 },
    ],
    previewTranscript:
      '大家晚上好，欢迎来到今天的年度分享会，我们先用一个小故事把主题带出来。',
    reportId: 'report-2026-04-09-host',
  },
  {
    id: 'record-2026-04-07-guest',
    sceneId: 'guest-en',
    sceneTitle: '嘉宾分享场景',
    title: '上周五 · English sharing',
    language: 'en-US',
    createdAt: '2026-04-07T20:15:00+08:00',
    durationSec: 224,
    overallScore: 81,
    scoreDelta: 7,
    summary:
      '观点层次清楚，英文表达稳定，但结尾的号召力还可以更强。',
    metricChanges: [
      { key: 'logic', label: '逻辑', delta: 7 },
      { key: 'delivery', label: '表达', delta: 4 },
      { key: 'fluency', label: '收束', delta: -1 },
    ],
    previewTranscript:
      'Today I want to share one key lesson from building under pressure: clarity wins attention.',
    reportId: 'report-2026-04-07-guest',
  },
  {
    id: 'record-2026-04-11-impromptu',
    sceneId: 'impromptu-cn',
    sceneTitle: '脱口秀场景',
    title: '本周一 · 脱口秀试讲',
    language: 'zh-CN',
    createdAt: '2026-04-11T18:40:00+08:00',
    durationSec: 143,
    overallScore: 73,
    scoreDelta: 2,
    summary:
      '笑点前的铺垫做得不错，不过包袱落点略快，观众反应区间偏短。',
    metricChanges: [
      { key: 'pacing', label: '节奏', delta: 5 },
      { key: 'delivery', label: '表现力', delta: 3 },
      { key: 'pauseControl', label: '停顿', delta: -4 },
    ],
    previewTranscript:
      '我发现成年人最擅长的一件事，就是明明没空，还要把日程排得像自己很自由。',
    reportId: 'report-2026-04-11-impromptu',
  },
];

const liveCoachSeed: LiveCoachMessage = {
  id: 'coach-default',
  tone: 'encouraging',
  title: '深呼吸，AI 正在倾听',
  body:
    '先把语速放稳，给第一句留出半秒铺垫。你的开场状态已经在线，接下来让节奏更从容。',
  generatedAt: now,
  source: 'system',
};

const transcriptSeed: TranscriptLine[] = [
  {
    id: 'line-1',
    text: '大家好，今天我想分享一个关于项目推进和沟通效率的小观察。',
    timestampMs: 0,
    confidence: 0.98,
    speaker: 'user',
  },
  {
    id: 'line-2',
    text: '如果开头能更快抛出结论，后面的例子会更容易把观众带进去。',
    timestampMs: 4200,
    confidence: 0.95,
    speaker: 'ai-note',
  },
];

const defaultSuggestions: ReportSuggestion[] = [
  {
    id: 'suggest-1',
    title: '放慢提问前半拍',
    detail:
      '在抛出问题前多留 0.5 秒停顿，可以让嘉宾和观众更好地跟上节奏。',
    priority: 'high',
    metricKey: 'contentStructure',
  },
  {
    id: 'suggest-2',
    title: '增强关键词重音',
    detail:
      '介绍嘉宾或活动亮点时，把关键名词重读，会让信息更有记忆点。',
    priority: 'medium',
    metricKey: 'fluency',
  },
  {
    id: 'suggest-3',
    title: '增加互动追问',
    detail:
      '你的控场已经很自然，下一步可以加入一句简短追问，让现场交流更有层次。',
    priority: 'medium',
    metricKey: 'expressiveness',
  },
];

const metricOrder: RadarMetricKey[] = [
  'pronunciation',
  'fluency',
  'contentStructure',
  'expressiveness',
  'emotionalResonance',
];

const reportSeed: ReportData = {
  id: 'report-default-high-score',
  relatedRecordId: 'record-2026-04-09-host',
  generatedAt: now,
  language: 'zh-CN',
  sceneId: 'host-cn',
  sceneTitle: '主持人场景',
  headline: '你已经有很强的主持松弛感',
  overview:
    '这一轮里，你的开场状态稳定，能够快速把观众带进节奏，整体呈现比历史记录更从容。',
  overallScore: 85,
  stars: 4.5,
  scoreTrend: {
    delta: 6,
    comparedToLabel: '较上次同场景练习',
  },
  radar: {
    pronunciation: 90,
    fluency: 85,
    contentStructure: 88,
    expressiveness: 75,
    emotionalResonance: 92,
  },
  radarMeta: {
    pronunciation: { label: '发音', shortLabel: '发音', description: '吐字与咬字清晰度' },
    fluency: { label: '流利度', shortLabel: '流利', description: '语速、停顿与自然衔接' },
    contentStructure: { label: '内容结构', shortLabel: '结构', description: '信息组织与层次推进' },
    expressiveness: { label: '表达力', shortLabel: '表达', description: '语气变化与镜头张力' },
    emotionalResonance: { label: '情感共鸣', shortLabel: '共鸣', description: '感染力与观众连接' },
  },
  highlights: [
    '破冰速度快，前 20 秒就建立了轻松氛围。',
    '切换议题时衔接自然，没有明显卡顿。',
    '眼神和微笑配合更稳定，镜头亲和力提升明显。',
  ],
  suggestions: defaultSuggestions,
  coachSummary:
    '继续维持当前的稳定开场，把关键词重音和互动追问再做强，你会更像成熟主持人。',
  comparison: historyRecords.map((record) => ({
    recordId: record.id,
    label: record.title,
    overallScore: record.overallScore,
  })),
  rawMetrics: metricOrder.map((key) => ({
    key,
    score: {
      pronunciation: 90,
      fluency: 85,
      contentStructure: 88,
      expressiveness: 75,
      emotionalResonance: 92,
    }[key],
  })),
};

export interface PracticeStoreState {
  status: RecordingStatus;
  activeSceneId: string;
  activeLanguage: PracticeLanguage;
  scenes: PracticeScene[];
  history: SpeechRecord[];
  liveCoach: LiveCoachMessage;
  transcript: TranscriptLine[];
  currentReport: ReportData | null;
  recordingStartedAt: string | null;
  recordingElapsedMs: number;
  isMicEnabled: boolean;
  isCameraEnabled: boolean;
  setActiveScene: (sceneId: string) => void;
  setActiveLanguage: (language: PracticeLanguage) => void;
  setRecordingStatus: (status: RecordingStatus) => void;
  pushTranscriptLine: (line: TranscriptLine) => void;
  updateLiveCoach: (message: LiveCoachMessage) => void;
  startRecording: () => void;
  stopRecording: () => void;
  beginAnalyzing: () => void;
  finishSession: (report?: ReportData) => void;
  resetSession: () => void;
  hydrateMockSession: () => void;
}

export const usePracticeStore = create<PracticeStoreState>((set) => ({
  status: 'idle',
  activeSceneId: sceneCatalog[0].id,
  activeLanguage: 'zh-CN',
  scenes: sceneCatalog,
  history: historyRecords,
  liveCoach: liveCoachSeed,
  transcript: transcriptSeed,
  currentReport: reportSeed,
  recordingStartedAt: null,
  recordingElapsedMs: 0,
  isMicEnabled: true,
  isCameraEnabled: true,
  setActiveScene: (sceneId) => set({ activeSceneId: sceneId }),
  setActiveLanguage: (language) => set({ activeLanguage: language }),
  setRecordingStatus: (status) => set({ status }),
  pushTranscriptLine: (line) =>
    set((state) => ({
      transcript: [...state.transcript, line],
    })),
  updateLiveCoach: (message) => set({ liveCoach: message }),
  startRecording: () =>
    set({
      status: 'recording',
      recordingStartedAt: new Date().toISOString(),
      recordingElapsedMs: 0,
      currentReport: null,
    }),
  stopRecording: () =>
    set((state) => ({
      status: 'idle',
      recordingStartedAt: null,
      recordingElapsedMs: state.recordingElapsedMs,
    })),
  beginAnalyzing: () =>
    set({
      status: 'analyzing',
      liveCoach: {
        id: 'coach-analyzing',
        tone: 'analytical',
        title: 'AI 正在生成报告',
        body: '已完成语音、节奏和镜头状态分析，正在汇总本轮训练总结与下一步建议。',
        generatedAt: new Date().toISOString(),
        source: 'system',
      },
    }),
  finishSession: (report = reportSeed) =>
    set({
      status: 'finished',
      currentReport: report,
      liveCoach: {
        id: 'coach-finished',
        tone: 'celebratory',
        title: '本轮训练完成',
        body: '报告已准备好，下一步可以查看雷达图、行动建议和历史趋势对比。',
        generatedAt: new Date().toISOString(),
        source: 'system',
      },
    }),
  resetSession: () =>
    set({
      status: 'idle',
      recordingStartedAt: null,
      recordingElapsedMs: 0,
      transcript: [],
      currentReport: null,
      liveCoach: liveCoachSeed,
    }),
  hydrateMockSession: () =>
    set({
      status: 'finished',
      activeSceneId: sceneCatalog[0].id,
      activeLanguage: 'zh-CN',
      history: historyRecords,
      liveCoach: liveCoachSeed,
      transcript: transcriptSeed,
      currentReport: reportSeed,
      recordingStartedAt: null,
      recordingElapsedMs: 164000,
      isMicEnabled: true,
      isCameraEnabled: true,
    }),
}));

export const practiceStoreMock = {
  sceneCatalog,
  historyRecords,
  liveCoachSeed,
  transcriptSeed,
  reportSeed,
};
