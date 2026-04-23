import { Audio } from 'expo-av';
import { create } from 'zustand';

import {
  type CoachChatMessage,
  type CoachPanelState,
  type LiveCoachMessage,
  type PracticeLanguage,
  type PracticeScene,
  type QAPhase,
  type RadarMetricKey,
  type RecordingStatus,
  type ReportData,
  type ReportSuggestion,
  type SpeechRecord,
  type TranscriptLine,
} from '../types/types';

const now = '2026-04-11T21:45:00+08:00';
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const RECORDING_SEGMENT_MS = 1200;
const TRANSCRIPT_SILENCE_WINDOW_MS = 2000;
const RECORDING_FILE_TYPE = 'audio/x-m4a';
const BODY_VISUAL_MIN_TRANSCRIPT_CHARS = 18;

let transcriptFinalizeTimeout: ReturnType<typeof setTimeout> | null = null;
let voiceContentFeedbackTimeout: ReturnType<typeof setTimeout> | null = null;
let transcriptSegmentFinalized = true;

const coachPanelSeed: CoachPanelState = {
  summary: {
    title: 'AI 正在倾听',
    detail: '实时反馈会随着语音、内容和画面持续刷新。',
    sourceDimension: null,
    updatedAtMs: 0,
  },
  bodyExpression: {
    id: 'body_expression',
    status: 'analyzing',
    headline: '观察肢体状态',
    detail: '保持自然打开的镜头状态。',
    updatedAtMs: 0,
    source: 'system',
  },
  voicePacing: {
    id: 'voice_pacing',
    status: 'analyzing',
    headline: '观察语音节奏',
    detail: '先稳住语速和句尾收束。',
    updatedAtMs: 0,
    source: 'system',
  },
  contentExpression: {
    id: 'content_expression',
    status: 'analyzing',
    headline: '观察内容表达',
    detail: '继续把主线往前推进。',
    updatedAtMs: 0,
    source: 'system',
  },
};

const sceneCatalog: PracticeScene[] = [
  {
    id: 'host-cn',
    key: 'hosting',
    title: '主持（Host）',
    subtitle: '控场、互动、转场、节奏、感染力',
    goal: '建立场域、推进流程、带动听众',
    description:
      '适合发布会、活动串场与舞台主持，强调控场自然度、互动意识、流程推进与声音带动感。',
    tags: ['控场', '互动', '转场'],
    focusKeywords: ['控场节奏', '互动意识', '转场自然度', '声音带动感'],
    accentColor: ['#8B5CF6', '#D946EF'],
    supportedLanguages: ['zh-CN', 'en-US'],
    difficulty: 'intermediate',
    estimatedDurationSec: 180,
    coverVariant: 'violet-stage',
    isRecommended: true,
  },
  {
    id: 'presentation-core',
    key: 'presentation',
    title: '主题分享（Presentation）',
    subtitle: '结构、解释、支撑、重点、总结',
    goal: '讲清楚一个主题并帮助听众理解',
    description:
      '适合课程讲解、产品介绍与主题演讲，强调主题清楚、结构严密、解释充分和重点鲜明。',
    tags: ['结构组织', '解释能力', '重点突出'],
    focusKeywords: ['结构清晰度', '解释能力', '重点突出程度', '总结质量'],
    accentColor: ['#6D28D9', '#9333EA'],
    supportedLanguages: ['zh-CN', 'en-US'],
    difficulty: 'advanced',
    estimatedDurationSec: 240,
    coverVariant: 'nebula-glow',
  },
  {
    id: 'impromptu-cn',
    key: 'impromptu',
    title: '即兴表达（Impromptu）',
    subtitle: '反应、连贯、自然、稳定、结论',
    goal: '快速自然地组织输出并保持稳定',
    description:
      '适用于临场发言、即兴回答与短时表达训练，重点关注起步速度、卡顿情况与即时组织能力。',
    tags: ['起步速度', '稳定输出', '结论收束'],
    focusKeywords: ['起步速度', '卡顿情况', '即时组织能力', '自然稳定度'],
    accentColor: ['#7C3AED', '#A855F7'],
    supportedLanguages: ['zh-CN'],
    difficulty: 'advanced',
    estimatedDurationSec: 150,
    coverVariant: 'midnight-lens',
  },
  {
    id: 'briefing-defense',
    key: 'briefing-defense',
    title: '汇报答辩（Briefing & Defense）',
    subtitle: '结论、论证、准确、回应、专业性',
    goal: '高效准确地完成正式陈述与问题回应',
    description:
      '适用于工作汇报、项目答辩和正式陈述，强调结论导向、论证完整性与专业表达准确性。',
    tags: ['结论导向', '论证完整', '专业表达'],
    focusKeywords: ['结论导向', '论证完整性', '回应针对性', '专业表达准确性'],
    accentColor: ['#4C1D95', '#7C3AED'],
    supportedLanguages: ['zh-CN', 'en-US'],
    difficulty: 'advanced',
    estimatedDurationSec: 210,
    coverVariant: 'briefing-grid',
  },
  {
    id: 'interview-pitch',
    key: 'interview-pitch',
    title: '面试 / Pitch',
    subtitle: '定位、亮点、简洁、自信、记忆点',
    goal: '快速建立形象并形成说服力',
    description:
      '适用于自我介绍、面试表达与商业 Pitch，强调亮点形成、表达精炼、自信感与记忆点。',
    tags: ['第一印象', '亮点表达', '说服力'],
    focusKeywords: ['自我定位', '内容精炼度', '亮点形成', '自信感与说服力'],
    accentColor: ['#9333EA', '#E879F9'],
    supportedLanguages: ['zh-CN', 'en-US'],
    difficulty: 'intermediate',
    estimatedDurationSec: 180,
    coverVariant: 'pitch-spark',
  },
];

const historyRecords: SpeechRecord[] = [
  {
    id: 'record-2026-04-09-host',
    sceneId: 'host-cn',
    sceneTitle: '主持（Host）',
    title: '上周三 · 中文主持',
    language: 'zh-CN',
    createdAt: '2026-04-09T19:30:00+08:00',
    durationSec: 196,
    overallScore: 76,
    scoreDelta: 4,
    summary:
      '开场自然，现场气口比之前更稳，但转向互动时的承接还可以再更果断一点。',
    metricChanges: [
      { key: 'audienceImpact', label: '控场', delta: 8 },
      { key: 'nonverbalPresence', label: '互动', delta: 6 },
      { key: 'fluencyRhythm', label: '节奏', delta: -2 },
    ],
    previewTranscript: '今天的活动我们会先快速热场，再进入今晚最值得期待的核心环节。',
    reportId: 'report-2026-04-09-host',
  },
  {
    id: 'record-2026-04-07-guest',
    sceneId: 'presentation-core',
    sceneTitle: '主题分享（Presentation）',
    title: '上周五 · English sharing',
    language: 'en-US',
    createdAt: '2026-04-07T20:15:00+08:00',
    durationSec: 224,
    overallScore: 81,
    scoreDelta: 7,
    summary:
      '观点层次清楚，英语表达稳定，结尾如果再补一个更强的 takeaway，会更完整。',
    metricChanges: [
      { key: 'contentStructure', label: '逻辑', delta: 7 },
      { key: 'languageExpression', label: '表达', delta: 4 },
      { key: 'audienceImpact', label: '收束', delta: -1 },
    ],
    previewTranscript:
      'Today I want to share one key lesson from building under pressure: clarity wins attention.',
    reportId: 'report-2026-04-07-guest',
  },
  {
    id: 'record-2026-04-11-impromptu',
    sceneId: 'impromptu-cn',
    sceneTitle: '即兴表达（Impromptu）',
    title: '本周一 · 脱口秀试讲',
    language: 'zh-CN',
    createdAt: '2026-04-11T18:40:00+08:00',
    durationSec: 143,
    overallScore: 73,
    scoreDelta: 2,
    summary:
      '关键观点的铺垫做得不错，不过中段仍有几次重启，导致整体连贯性还可以继续提纯。',
    metricChanges: [
      { key: 'fluencyRhythm', label: '节奏', delta: 5 },
      { key: 'audienceImpact', label: '表现力', delta: 3 },
      { key: 'contentStructure', label: '停顿', delta: -4 },
    ],
    previewTranscript: '我先说结论，这个产品最打动人的地方，不是功能多，而是你真的会愿意打开它。',
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
    metricKey: 'fluencyRhythm',
  },
  {
    id: 'suggest-2',
    title: '增强关键词重音',
    detail:
      '介绍嘉宾或活动亮点时，把关键名词重读，会让信息更有记忆点。',
    priority: 'medium',
    metricKey: 'vocalDelivery',
  },
  {
    id: 'suggest-3',
    title: '增加互动追问',
    detail:
      '你的控场已经很自然，下一步可以加入一句简短追问，让现场交流更有层次。',
    priority: 'medium',
    metricKey: 'audienceImpact',
  },
];

const metricOrder: RadarMetricKey[] = [
  'contentStructure',
  'languageExpression',
  'fluencyRhythm',
  'vocalDelivery',
  'nonverbalPresence',
  'audienceImpact',
];

const reportSeed: ReportData = {
  id: 'report-default-high-score',
  relatedRecordId: 'record-2026-04-09-host',
  generatedAt: now,
  language: 'zh-CN',
  sceneId: 'host-cn',
  sceneTitle: '主持（Host）',
  headline: '你已经具备成熟主持的控场意识与听众带动感',
  overview:
    '这一轮里，你的开场吸引力和流程推进都比较稳定，能较快把听众带进节奏，整体呈现具备明显的主持场域感。',
  overallScore: 85,
  stars: 4.5,
  scoreTrend: {
    delta: 6,
    comparedToLabel: '较上次同场景练习',
  },
  radar: {
    contentStructure: 78,
    languageExpression: 80,
    fluencyRhythm: 88,
    vocalDelivery: 90,
    nonverbalPresence: 84,
    audienceImpact: 92,
  },
  radarMeta: {
    contentStructure: { label: '内容结构', shortLabel: '结构', description: '主题是否明确、逻辑是否完整、结尾是否收束' },
    languageExpression: { label: '语言表达', shortLabel: '语言', description: '用词准确性、表达简洁性与语言得体度' },
    fluencyRhythm: { label: '流利度与节奏', shortLabel: '节奏', description: '表达连贯性、语速与停顿控制' },
    vocalDelivery: { label: '语音表现', shortLabel: '语音', description: '发音清晰度、音量稳定性与语调变化度' },
    nonverbalPresence: { label: '非语言呈现', shortLabel: '台风', description: '眼神、表情、姿态与手势的协调度' },
    audienceImpact: { label: '听众感与影响力', shortLabel: '影响力', description: '互动意识、带动感、说服力与记忆点' },
  },
  highlights: [
    '开场吸引力不错，前段较快完成场域建立。',
    '转场语气自然，流程推进感比较清晰。',
    '声音带动感和镜头交流明显优于上一轮。',
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
      contentStructure: 78,
      languageExpression: 80,
      fluencyRhythm: 88,
      vocalDelivery: 90,
      nonverbalPresence: 84,
      audienceImpact: 92,
    }[key],
  })),
};

async function createRecordingSegment() {
  const recording = new Audio.Recording();
  await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
  await recording.startAsync();
  return recording;
}

async function stopAndUnloadRecording(recording: Audio.Recording) {
  try {
    await recording.stopAndUnloadAsync();
  } catch (error) {
    console.warn('stopAndUnloadRecording failed', error);
  }

  return recording.getURI();
}

async function requestBackend<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function transcribeRecordingSegment(uri: string, language: PracticeLanguage) {
  const formData = new FormData();
  formData.append(
    'audio_file',
    {
      uri,
      name: `speech-segment-${Date.now()}.m4a`,
      type: RECORDING_FILE_TYPE,
    } as never,
  );
  formData.append('language', language);
  formData.append('mime_type', RECORDING_FILE_TYPE);

  const payload = await requestBackend<{ text?: string }>('/api/asr', {
    method: 'POST',
    body: formData,
  });

  return payload.text?.trim() ?? '';
}

function clearTranscriptTimers() {
  if (transcriptFinalizeTimeout) {
    clearTimeout(transcriptFinalizeTimeout);
    transcriptFinalizeTimeout = null;
  }

  if (voiceContentFeedbackTimeout) {
    clearTimeout(voiceContentFeedbackTimeout);
    voiceContentFeedbackTimeout = null;
  }
}

function normalizeComparableText(text: string) {
  return text.replace(/[，。！？、；：,.!?;:\s]/g, '').trim();
}

function getLooseSuffix(previousText: string, incomingText: string) {
  const prev = normalizeComparableText(previousText);
  const next = normalizeComparableText(incomingText);

  if (!prev || !next) {
    return incomingText.trim();
  }

  if (next === prev || next.includes(prev)) {
    return incomingText.trim();
  }

  const limit = Math.min(prev.length, next.length);

  for (let overlap = limit; overlap >= 3; overlap -= 1) {
    if (prev.slice(-overlap) === next.slice(0, overlap)) {
      return incomingText.trim();
    }
  }

  return incomingText.trim();
}

function looksLikeWeakPartial(text: string) {
  const compact = text.replace(/\s+/g, '').trim();

  if (!compact) {
    return true;
  }

  if (compact.length <= 6) {
    return true;
  }

  return /^(然后|就是|所以|那个|这个|呃|嗯|啊|然后呢|还有|我觉得|就是说|还行吧|其实)/.test(compact);
}

function hasStrongEnding(text: string) {
  return /[。！？!?]$/.test(text.trim());
}

function sanitizeTranscriptChunk(text: string) {
  const raw = text.replace(/\s+/g, ' ').trim().replace(/^[，。！？、,.!?;:\-]+/, '');

  if (!raw) {
    return '';
  }

  const trailingFillerTrimmed = raw.replace(
    /(?:[，,\s]*(?:嗯+|呃+|额+|啊+|那个|这个|就是|然后|然后呢|你知道吗))+[，,。.!?？]*$/g,
    '',
  ).trim();

  const candidate = trailingFillerTrimmed || raw;
  const lexicalOnly = candidate
    .replace(/[，。！？、；：,.!?;:\s]/g, '')
    .replace(/(?:嗯+|呃+|额+|啊+|那个|这个|就是|然后|然后呢|好吧|还行吧|你知道吗)/g, '')
    .trim();

  if (!lexicalOnly) {
    return '';
  }

  return candidate
    .replace(/([，,]\s*){2,}/g, '，')
    .replace(/([。！？!?]){2,}/g, '$1')
    .trim();
}

function shouldMergeIntoPreviousCommittedLine(previousText: string, incomingText: string) {
  const previous = previousText.trim();
  const incoming = incomingText.trim();

  if (!previous || !incoming) {
    return false;
  }

  if (!hasStrongEnding(previous)) {
    return true;
  }

  if (/^[，、,.:：;；!?！？]/.test(incoming)) {
    return true;
  }

  if (looksLikeWeakPartial(incoming)) {
    return true;
  }

  const suffix = getLooseSuffix(incoming, previous);
  if (suffix !== incoming && suffix.trim().length > 0) {
    return true;
  }

  return false;
}

function mergeTranscriptIntoLatest(previousText: string, incomingText: string) {
  const previous = previousText.trim();
  const incoming = incomingText.trim();

  if (!previous) {
    return incoming;
  }

  if (!incoming) {
    return previous;
  }

  const normalizedPrevious = normalizeComparableText(previous);
  const normalizedIncoming = normalizeComparableText(incoming);

  if (!normalizedIncoming) {
    return previous;
  }

  if (normalizedPrevious === normalizedIncoming) {
    return previous.length >= incoming.length ? previous : incoming;
  }

  if (normalizedIncoming.startsWith(normalizedPrevious)) {
    return incoming;
  }

  if (normalizedPrevious.startsWith(normalizedIncoming)) {
    return previous;
  }

  if (looksLikeWeakPartial(incoming) || !hasStrongEnding(previous)) {
    return `${previous.replace(/[，。！？!?]$/, '')}，${getLooseSuffix(previous, incoming)}`.replace(/，{2,}/g, '，');
  }

  return `${previous}\n${incoming}`;
}

function scheduleVoiceContentTurnFeedback() {
  if (voiceContentFeedbackTimeout) {
    clearTimeout(voiceContentFeedbackTimeout);
  }

  voiceContentFeedbackTimeout = setTimeout(() => {
    const state = usePracticeStore.getState();

    if (state.status !== 'recording') {
      return;
    }

    const fullText = state.transcript
      .filter((line) => line.speaker === 'user')
      .map((line) => line.text.trim())
      .filter(Boolean)
      .join('\n');

    if (fullText) {
      void state.fetchAICoachFeedback(fullText, { scope: 'voice_content' });
    }
  }, TRANSCRIPT_SILENCE_WINDOW_MS);
}

export interface PracticeStoreState {
  status: RecordingStatus;
  activeSceneId: string;
  activeLanguage: PracticeLanguage;
  scenes: PracticeScene[];
  history: SpeechRecord[];
  liveCoach: LiveCoachMessage;
  liveCoachInsight: string;
  coachPanel: CoachPanelState;
  transcript: TranscriptLine[];
  currentReport: ReportData | null;
  pendingReport: ReportData | null;
  recordingStartedAt: string | null;
  recordingElapsedMs: number;
  analysisProgress: number;
  isMicEnabled: boolean;
  isCameraEnabled: boolean;
  qaEnabled: boolean;
  qaPhase: QAPhase;
  qaMessages: CoachChatMessage[];
  qaCurrentGoal: string | null;
  qaSpeaking: boolean;
  qaTurnId: string | null;
  activeRecording: Audio.Recording | null;
  transcriptionIntervalId: ReturnType<typeof setInterval> | null;
  analysisIntervalId: ReturnType<typeof setInterval> | null;
  setActiveScene: (sceneId: string) => void;
  setActiveLanguage: (language: PracticeLanguage) => void;
  setRecordingStatus: (status: RecordingStatus) => void;
  pushTranscriptLine: (line: TranscriptLine) => void;
  appendTranscriptText: (text: string, speaker?: TranscriptLine['speaker']) => void;
  updateLiveCoach: (message: LiveCoachMessage) => void;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  stopRecordingAndGenerateReport: () => Promise<void>;
  fetchAICoachFeedback: (
    currentText: string,
    options?: { frameBase64?: string | null; scope?: 'voice_content' | 'body_visual' },
  ) => Promise<void>;
  startCoachQA: () => Promise<void>;
  continueCoachQA: () => Promise<void>;
  markQAAudioPlaybackStarted: (turnId?: string | null) => void;
  markQAAudioPlaybackEnded: (turnId?: string | null) => void;
  closeCoachQA: () => void;
  fetchFinalReport: (fullTranscript: string) => Promise<void>;
  beginAnalyzing: () => Promise<void>;
  finishSession: (report?: ReportData) => void;
  resetSession: () => void;
  hydrateMockSession: () => void;
}

export const usePracticeStore = create<PracticeStoreState>((set) => ({
  status: 'preparing',
  activeSceneId: sceneCatalog[0].id,
  activeLanguage: 'zh-CN',
  scenes: sceneCatalog,
  history: historyRecords,
  liveCoach: liveCoachSeed,
  liveCoachInsight: liveCoachSeed.body,
  coachPanel: coachPanelSeed,
  transcript: transcriptSeed,
  currentReport: reportSeed,
  pendingReport: null,
  recordingStartedAt: null,
  recordingElapsedMs: 0,
  analysisProgress: 0,
  isMicEnabled: true,
  isCameraEnabled: true,
  qaEnabled: false,
  qaPhase: 'idle',
  qaMessages: [],
  qaCurrentGoal: null,
  qaSpeaking: false,
  qaTurnId: null,
  activeRecording: null,
  transcriptionIntervalId: null,
  analysisIntervalId: null,
  setActiveScene: (sceneId) => set({ activeSceneId: sceneId }),
  setActiveLanguage: (language) => set({ activeLanguage: language }),
  setRecordingStatus: (status) => set({ status }),
  pushTranscriptLine: (line) =>
    set((state) => ({
      transcript: [...state.transcript, line],
    })),
  appendTranscriptText: (text, speaker = 'user') =>
    set((state) => {
      const trimmed = sanitizeTranscriptChunk(text);

      if (!trimmed) {
        return state;
      }

      const timestampMs = state.recordingStartedAt
        ? Date.now() - new Date(state.recordingStartedAt).getTime()
        : 0;

      if (speaker !== 'user') {
        return {
          transcript: [
            ...state.transcript,
            {
              id: `line-${Date.now()}`,
              text: trimmed,
              timestampMs,
              confidence: 0.98,
              speaker,
            },
          ],
        };
      }

      const transcript = [...state.transcript];
      const lastLine = transcript[transcript.length - 1];

      if (
        lastLine?.speaker === 'user' &&
        (!transcriptSegmentFinalized || shouldMergeIntoPreviousCommittedLine(lastLine.text, trimmed))
      ) {
        transcript[transcript.length - 1] = {
          ...lastLine,
          text: mergeTranscriptIntoLatest(lastLine.text, trimmed),
          timestampMs,
        };
      } else {
        transcript.push({
          id: `line-${Date.now()}`,
          text: trimmed,
          timestampMs,
          confidence: 0.98,
          speaker,
        });
      }

      transcriptSegmentFinalized = false;

      if (transcriptFinalizeTimeout) {
        clearTimeout(transcriptFinalizeTimeout);
      }

      transcriptFinalizeTimeout = setTimeout(() => {
        transcriptSegmentFinalized = true;
      }, TRANSCRIPT_SILENCE_WINDOW_MS);

      scheduleVoiceContentTurnFeedback();

      return {
        transcript,
      };
    }),
  updateLiveCoach: (message) => set({ liveCoach: message, liveCoachInsight: message.body }),
  startRecording: async () => {
    const { granted } = await Audio.requestPermissionsAsync();

    if (!granted) {
      set({
        liveCoach: {
          id: 'coach-mic-denied',
          tone: 'analytical',
          title: '需要麦克风权限',
          body: '请在系统设置中允许麦克风访问，才能开始实时录音、字幕识别和 AI 教练反馈。',
          generatedAt: new Date().toISOString(),
          source: 'system',
        },
        liveCoachInsight: '当前未获得麦克风权限，请先在系统设置中授权。',
      });
      return;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });

    const firstSegment = await createRecordingSegment();
    const startedAt = new Date().toISOString();
    let isRotatingSegment = false;

    const intervalId = setInterval(async () => {
      if (isRotatingSegment) {
        return;
      }

      const state = usePracticeStore.getState();
      const currentRecording = state.activeRecording;

      if (!currentRecording || state.status !== 'recording') {
        return;
      }

      isRotatingSegment = true;

      try {
        const finishedUri = await stopAndUnloadRecording(currentRecording);
        const nextSegment = await createRecordingSegment();
        usePracticeStore.setState({ activeRecording: nextSegment });

        if (finishedUri) {
          const transcriptText = await transcribeRecordingSegment(finishedUri, state.activeLanguage);

          if (transcriptText) {
            usePracticeStore.getState().appendTranscriptText(transcriptText, 'user');
          }
        }
      } catch (error) {
        console.warn('segment transcription failed', error);
        usePracticeStore.setState({
          liveCoachInsight: '实时识别暂时中断，请检查本地代理服务、局域网连接或接口配置。',
        });
      } finally {
        isRotatingSegment = false;
      }
    }, RECORDING_SEGMENT_MS);

    set({
      status: 'recording',
      recordingStartedAt: startedAt,
      recordingElapsedMs: 0,
      currentReport: null,
      activeRecording: firstSegment,
      transcriptionIntervalId: intervalId,
      transcript: [],
      coachPanel: coachPanelSeed,
      liveCoach: {
        id: 'coach-recording',
        tone: 'encouraging',
        title: '演讲进行中',
        body: '麦克风已开启，Omni 教练会持续整合语音、内容与画面，刷新实时反馈。',
        generatedAt: startedAt,
        source: 'system',
      },
      liveCoachInsight: '录制已开始，等待第一轮字幕与 Omni 实时教练结果返回。',
      qaEnabled: false,
      qaPhase: 'idle',
      qaMessages: [],
      qaCurrentGoal: null,
      qaSpeaking: false,
      qaTurnId: null,
    });
  },
  stopRecording: async () => {
    const state = usePracticeStore.getState();

    if (state.transcriptionIntervalId) {
      clearInterval(state.transcriptionIntervalId);
    }

    let finalTranscript = '';

    if (state.activeRecording) {
      const finalUri = await stopAndUnloadRecording(state.activeRecording);

      if (finalUri) {
        try {
          finalTranscript = await transcribeRecordingSegment(finalUri, state.activeLanguage);
        } catch (error) {
          console.warn('final transcription failed', error);
        }
      }
    }

    if (finalTranscript) {
      usePracticeStore.getState().appendTranscriptText(finalTranscript, 'user');
      clearTranscriptTimers();
      transcriptSegmentFinalized = true;
      const fullText = usePracticeStore
        .getState()
        .transcript.filter((line) => line.speaker === 'user')
        .map((line) => line.text.trim())
        .filter(Boolean)
        .join('\n');
      await usePracticeStore.getState().fetchAICoachFeedback(fullText, { scope: 'voice_content' });
    }

    set((currentState) => ({
      status: 'idle',
      recordingStartedAt: null,
      recordingElapsedMs: currentState.recordingElapsedMs,
      activeRecording: null,
      transcriptionIntervalId: null,
    }));
  },
  stopRecordingAndGenerateReport: async () => {
    const state = usePracticeStore.getState();

    if (state.transcriptionIntervalId) {
      clearInterval(state.transcriptionIntervalId);
    }

    if (state.analysisIntervalId) {
      clearInterval(state.analysisIntervalId);
    }

    if (state.activeRecording) {
      await stopAndUnloadRecording(state.activeRecording);
    }

    const fullTranscript = state.transcript
      .filter((line) => line.speaker === 'user')
      .map((line) => line.text.trim())
      .filter(Boolean)
      .join('\n');

    const progressIntervalId = setInterval(() => {
      const latestState = usePracticeStore.getState();

      if (latestState.status !== 'analyzing') {
        clearInterval(progressIntervalId);
        return;
      }

      const nextProgress = latestState.pendingReport
        ? Math.min(100, latestState.analysisProgress + 12)
        : Math.min(94, latestState.analysisProgress + 7);
      const adaptiveStep = latestState.pendingReport
        ? latestState.analysisProgress < 70
          ? 10
          : latestState.analysisProgress < 90
            ? 5
            : 2
        : latestState.analysisProgress < 45
          ? 8
          : latestState.analysisProgress < 75
            ? 4
            : 1;
      const easedProgress = latestState.pendingReport
        ? Math.min(100, latestState.analysisProgress + adaptiveStep)
        : Math.min(94, latestState.analysisProgress + adaptiveStep);

      if (latestState.pendingReport && easedProgress >= 100) {
        clearInterval(progressIntervalId);
        usePracticeStore.setState({
          analysisProgress: 100,
        });
        setTimeout(() => {
          const settledState = usePracticeStore.getState();

          if (!settledState.pendingReport) {
            return;
          }

          usePracticeStore.setState({
            status: 'finished',
            currentReport: settledState.pendingReport,
            pendingReport: null,
            analysisProgress: 100,
            analysisIntervalId: null,
            liveCoachInsight: settledState.pendingReport.headline,
          });
        }, 200);
        return;
      }

      usePracticeStore.setState({
        analysisProgress: easedProgress,
      });
    }, 180);

    set({
      status: 'analyzing',
      activeRecording: null,
      transcriptionIntervalId: null,
      analysisIntervalId: progressIntervalId,
      recordingStartedAt: null,
      pendingReport: null,
      analysisProgress: 0,
      liveCoach: {
        id: 'coach-analyzing',
        tone: 'analytical',
        title: 'AI 正在深度分析',
        body: '已停止录音并释放麦克风，接下来将根据本轮完整逐字稿生成最终报告。',
        generatedAt: new Date().toISOString(),
        source: 'system',
      },
      liveCoachInsight: 'AI 正在深度分析您的演讲表现...',
    });

    await usePracticeStore.getState().fetchFinalReport(fullTranscript);
  },
  fetchAICoachFeedback: async (currentText, options) => {
    const scope = options?.scope ?? 'voice_content';

    if (scope === 'voice_content' && !currentText.trim()) {
      return;
    }

    try {
      const state = usePracticeStore.getState();
      const payload = await requestBackend<{ insight?: string; coachPanel?: CoachPanelState }>('/api/coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: currentText,
          language: state.activeLanguage,
          sceneTitle: state.scenes.find((scene) => scene.id === state.activeSceneId)?.title ?? '演讲训练',
          sceneGoal: state.scenes.find((scene) => scene.id === state.activeSceneId)?.goal ?? '完成当前场景的表达任务',
          focusKeywords: state.scenes.find((scene) => scene.id === state.activeSceneId)?.focusKeywords ?? [],
          scope,
          frameBase64: options?.frameBase64 ?? null,
        }),
      });

      const insight = payload.insight?.trim();
      const transcriptChars = state.transcript
        .filter((line) => line.speaker === 'user')
        .map((line) => line.text)
        .join('')
        .replace(/\s+/g, '').length;

      if (scope === 'body_visual') {
        set((currentState) => ({
          coachPanel: payload.coachPanel
            ? {
                ...currentState.coachPanel,
                ...payload.coachPanel,
                bodyExpression: payload.coachPanel.bodyExpression ?? currentState.coachPanel.bodyExpression,
                summary:
                  transcriptChars >= BODY_VISUAL_MIN_TRANSCRIPT_CHARS && payload.coachPanel.summary
                    ? payload.coachPanel.summary
                    : currentState.coachPanel.summary,
              }
            : currentState.coachPanel,
        }));
        return;
      }

      if (!insight) {
        return;
      }

      set({
        coachPanel: payload.coachPanel ?? state.coachPanel,
        liveCoachInsight: insight,
        liveCoach: {
          id: `coach-${Date.now()}`,
          tone: 'analytical',
          title: 'Omni Live Coach',
          body: insight,
          generatedAt: new Date().toISOString(),
          source: 'ai',
        },
      });
    } catch (error) {
      console.warn('fetchAICoachFeedback failed', error);
      set({
        liveCoachInsight: 'Omni 实时教练暂时没有返回建议，请检查本地代理服务或模型配置。',
      });
    }
  },
  startCoachQA: async () => {
    set({
      qaEnabled: true,
      qaPhase: 'ai_asking',
      qaCurrentGoal: '先用一句话说出核心结论。',
      qaSpeaking: false,
      qaTurnId: `qa-turn-${Date.now()}`,
      qaMessages: [
        {
          id: `qa-coach-${Date.now()}`,
          role: 'coach',
          text: '先用一句话说出你这轮最想让听众记住的核心结论。',
          createdAt: new Date().toISOString(),
          emphasis: 'primary',
        },
      ],
    });
  },
  continueCoachQA: async () => {
    set((state) => ({
      qaPhase: 'evaluating_answer',
      qaMessages: [
        ...state.qaMessages,
        {
          id: `qa-system-${Date.now()}`,
          role: 'system',
          text: '下一轮请把结论提前，并补一个具体例子。',
          createdAt: new Date().toISOString(),
          emphasis: 'subtle',
        },
      ],
    }));
  },
  markQAAudioPlaybackStarted: () => set({ qaSpeaking: true }),
  markQAAudioPlaybackEnded: (turnId) =>
    set((state) => ({
      qaSpeaking: false,
      qaPhase: state.qaEnabled ? 'user_answering' : state.qaPhase,
      qaTurnId: turnId ?? state.qaTurnId,
    })),
  closeCoachQA: () =>
    set({
      qaEnabled: false,
      qaPhase: 'idle',
      qaMessages: [],
      qaCurrentGoal: null,
      qaSpeaking: false,
      qaTurnId: null,
    }),
  fetchFinalReport: async (fullTranscript) => {
    const state = usePracticeStore.getState();

    if (!fullTranscript.trim()) {
      set({
        status: 'finished',
        currentReport: {
          ...reportSeed,
          id: `report-empty-${Date.now()}`,
          generatedAt: new Date().toISOString(),
          language: state.activeLanguage,
          sceneId: state.activeSceneId,
          sceneTitle: state.scenes.find((scene) => scene.id === state.activeSceneId)?.title ?? reportSeed.sceneTitle,
          headline: '本轮内容较短，先完成一次完整演讲吧',
          overview: '当前录制内容不足以生成稳定评分，建议至少完成 20 秒以上的连续表达后再生成报告。',
          overallScore: 60,
          scoreTrend: {
            delta: 0,
            comparedToLabel: '本轮样本不足',
          },
          radar: {
            contentStructure: 55,
            languageExpression: 58,
            fluencyRhythm: 57,
            vocalDelivery: 60,
            nonverbalPresence: 56,
            audienceImpact: 54,
          },
          rawMetrics: [
            { key: 'contentStructure', score: 55 },
            { key: 'languageExpression', score: 58 },
            { key: 'fluencyRhythm', score: 57 },
            { key: 'vocalDelivery', score: 60 },
            { key: 'nonverbalPresence', score: 56 },
            { key: 'audienceImpact', score: 54 },
          ],
          highlights: ['录制链路已经跑通，下一步建议延长演讲时长以获得更稳定评估。'],
          suggestions: defaultSuggestions,
          coachSummary: '先完成一轮更完整的表达，再让 AI 给出更准确的评分与建议。',
          comparison: historyRecords.map((record) => ({
            recordId: record.id,
            label: record.title,
            overallScore: record.overallScore,
          })),
        },
      });
      return;
    }

    try {
      const payload = await requestBackend<{
        report?: {
          totalScore: number;
          summary: string;
          radarScores: {
            contentStructure: number;
            languageExpression: number;
            fluencyRhythm: number;
            vocalDelivery: number;
            nonverbalPresence: number;
            audienceImpact: number;
          };
          actionableAdvice: string[];
        };
      }>('/api/final-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: fullTranscript,
          language: state.activeLanguage,
          sceneTitle: state.scenes.find((scene) => scene.id === state.activeSceneId)?.title ?? '演讲训练',
        }),
      });

      const report = payload.report;

      if (!report) {
        throw new Error('Missing report payload');
      }

      const mappedReport: ReportData = {
        id: `report-${Date.now()}`,
        generatedAt: new Date().toISOString(),
        language: state.activeLanguage,
        sceneId: state.activeSceneId,
        sceneTitle: state.scenes.find((scene) => scene.id === state.activeSceneId)?.title ?? reportSeed.sceneTitle,
        headline: report.summary,
        overview: `本轮综合评分为 ${report.totalScore} 分。AI 已结合完整逐字稿、场景目标与 Speak Out 六维评价体系完成分析，并生成了针对本轮表达的总结与建议。`,
        overallScore: report.totalScore,
        stars: Math.max(1, Math.min(5, Number((report.totalScore / 20).toFixed(1)))),
        scoreTrend: {
          delta: report.totalScore - historyRecords[0].overallScore,
          comparedToLabel: '较最近一次训练',
        },
        radar: report.radarScores,
        radarMeta: reportSeed.radarMeta,
        rawMetrics: [
          { key: 'contentStructure', score: report.radarScores.contentStructure },
          { key: 'languageExpression', score: report.radarScores.languageExpression },
          { key: 'fluencyRhythm', score: report.radarScores.fluencyRhythm },
          { key: 'vocalDelivery', score: report.radarScores.vocalDelivery },
          { key: 'nonverbalPresence', score: report.radarScores.nonverbalPresence },
          { key: 'audienceImpact', score: report.radarScores.audienceImpact },
        ],
        highlights: [
          `综合点评：${report.summary}`,
          `本次为「${state.scenes.find((scene) => scene.id === state.activeSceneId)?.title ?? '当前场景'}」专项评估。`,
          `逐字稿总长度约 ${fullTranscript.length} 个字符，已纳入场景化评分分析。`,
        ],
        suggestions: report.actionableAdvice.slice(0, 3).map((detail, index) => ({
          id: `suggest-final-${index + 1}`,
          title: `建议 ${index + 1}`,
          detail,
          priority: index === 0 ? 'high' : 'medium',
          metricKey: (
            ['contentStructure', 'fluencyRhythm', 'audienceImpact'][index] ?? 'contentStructure'
          ) as RadarMetricKey,
        })),
        coachSummary: report.summary,
        comparison: historyRecords.map((record) => ({
          recordId: record.id,
          label: record.title,
          overallScore: record.overallScore,
        })),
      };

      const latestState = usePracticeStore.getState();

      if (latestState.analysisProgress >= 100) {
        set({
          status: 'finished',
          currentReport: mappedReport,
          pendingReport: null,
          analysisProgress: 100,
          analysisIntervalId: null,
          liveCoach: {
            id: `coach-final-${Date.now()}`,
            tone: 'celebratory',
            title: '最终报告已生成',
            body: report.summary,
            generatedAt: new Date().toISOString(),
            source: 'ai',
          },
          liveCoachInsight: report.summary,
        });
        return;
      }

      set({
        pendingReport: mappedReport,
        liveCoach: {
          id: `coach-final-pending-${Date.now()}`,
          tone: 'celebratory',
          title: '最终报告即将完成',
          body: report.summary,
          generatedAt: new Date().toISOString(),
          source: 'ai',
        },
      });
    } catch (error) {
      console.warn('fetchFinalReport failed', error);
      const latestState = usePracticeStore.getState();

      if (latestState.analysisIntervalId) {
        clearInterval(latestState.analysisIntervalId);
      }

      set({
        status: 'finished',
        currentReport: {
          ...reportSeed,
          id: `report-fallback-${Date.now()}`,
          generatedAt: new Date().toISOString(),
          language: state.activeLanguage,
          sceneId: state.activeSceneId,
          sceneTitle: state.scenes.find((scene) => scene.id === state.activeSceneId)?.title ?? reportSeed.sceneTitle,
          headline: '报告生成遇到波动，已回退到基础评估结果',
          overview: '最终报告接口暂时未返回有效 JSON，本页显示的是基础兜底报告。建议稍后重新尝试。',
        },
        pendingReport: null,
        analysisProgress: 100,
        analysisIntervalId: null,
        liveCoachInsight: '最终报告生成失败，已使用兜底报告展示结果。',
      });
    }
  },
  beginAnalyzing: async () => {
    await usePracticeStore.getState().stopRecording();

    set({
      status: 'analyzing',
      liveCoach: {
        id: 'coach-analyzing',
        tone: 'analytical',
        title: 'AI 正在生成报告',
        body: '已完成本轮录音收尾，正在整合字幕、节奏与表达表现，准备生成报告。',
        generatedAt: new Date().toISOString(),
        source: 'system',
      },
      liveCoachInsight: '本轮语音已收集完成，正在生成总结报告。',
    });
  },
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
      liveCoachInsight: '本轮训练已完成，报告和建议已经准备好。',
    }),
  resetSession: () =>
    set((state) => {
      clearTranscriptTimers();
      transcriptSegmentFinalized = true;

      if (state.transcriptionIntervalId) {
        clearInterval(state.transcriptionIntervalId);
      }

      if (state.analysisIntervalId) {
        clearInterval(state.analysisIntervalId);
      }

      if (state.activeRecording) {
        void stopAndUnloadRecording(state.activeRecording);
      }

      return {
        status: 'preparing',
        recordingStartedAt: null,
        recordingElapsedMs: 0,
        transcript: [],
        currentReport: null,
        pendingReport: null,
        liveCoach: liveCoachSeed,
        liveCoachInsight: liveCoachSeed.body,
        coachPanel: coachPanelSeed,
        activeRecording: null,
        transcriptionIntervalId: null,
        analysisProgress: 0,
        analysisIntervalId: null,
        qaEnabled: false,
        qaPhase: 'idle',
        qaMessages: [],
        qaCurrentGoal: null,
        qaSpeaking: false,
        qaTurnId: null,
      };
    }),
  hydrateMockSession: () =>
    set({
      status: 'finished',
      activeSceneId: sceneCatalog[0].id,
      activeLanguage: 'zh-CN',
      history: historyRecords,
      liveCoach: liveCoachSeed,
      liveCoachInsight: liveCoachSeed.body,
      transcript: transcriptSeed,
      currentReport: reportSeed,
      pendingReport: null,
      recordingStartedAt: null,
      recordingElapsedMs: 164000,
      analysisProgress: 100,
      isMicEnabled: true,
      isCameraEnabled: true,
      activeRecording: null,
      transcriptionIntervalId: null,
      analysisIntervalId: null,
    }),
}));

export const practiceStoreMock = {
  sceneCatalog,
  historyRecords,
  liveCoachSeed,
  transcriptSeed,
  reportSeed,
};
