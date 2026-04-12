import { Audio } from 'expo-av';
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
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const RECORDING_SEGMENT_MS = 3000;
const RECORDING_FILE_TYPE = 'audio/x-m4a';

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

export interface PracticeStoreState {
  status: RecordingStatus;
  activeSceneId: string;
  activeLanguage: PracticeLanguage;
  scenes: PracticeScene[];
  history: SpeechRecord[];
  liveCoach: LiveCoachMessage;
  liveCoachInsight: string;
  transcript: TranscriptLine[];
  currentReport: ReportData | null;
  recordingStartedAt: string | null;
  recordingElapsedMs: number;
  isMicEnabled: boolean;
  isCameraEnabled: boolean;
  activeRecording: Audio.Recording | null;
  transcriptionIntervalId: ReturnType<typeof setInterval> | null;
  setActiveScene: (sceneId: string) => void;
  setActiveLanguage: (language: PracticeLanguage) => void;
  setRecordingStatus: (status: RecordingStatus) => void;
  pushTranscriptLine: (line: TranscriptLine) => void;
  appendTranscriptText: (text: string, speaker?: TranscriptLine['speaker']) => void;
  updateLiveCoach: (message: LiveCoachMessage) => void;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  fetchAICoachFeedback: (currentText: string) => Promise<void>;
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
  transcript: transcriptSeed,
  currentReport: reportSeed,
  recordingStartedAt: null,
  recordingElapsedMs: 0,
  isMicEnabled: true,
  isCameraEnabled: true,
  activeRecording: null,
  transcriptionIntervalId: null,
  setActiveScene: (sceneId) => set({ activeSceneId: sceneId }),
  setActiveLanguage: (language) => set({ activeLanguage: language }),
  setRecordingStatus: (status) => set({ status }),
  pushTranscriptLine: (line) =>
    set((state) => ({
      transcript: [...state.transcript, line],
    })),
  appendTranscriptText: (text, speaker = 'user') =>
    set((state) => ({
      transcript: [
        ...state.transcript,
        {
          id: `line-${Date.now()}`,
          text,
          timestampMs: state.recordingStartedAt
            ? Date.now() - new Date(state.recordingStartedAt).getTime()
            : 0,
          confidence: 0.98,
          speaker,
        },
      ],
    })),
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
            const fullText = [...usePracticeStore.getState().transcript.map((line) => line.text), transcriptText].join('\n');
            await usePracticeStore.getState().fetchAICoachFeedback(fullText);
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
      liveCoach: {
        id: 'coach-recording',
        tone: 'encouraging',
        title: '演讲进行中',
        body: '麦克风已开启，正在按 3 秒分段识别语音，并把内容发送给 AI 教练。',
        generatedAt: startedAt,
        source: 'system',
      },
      liveCoachInsight: '录制已开始，等待第一段语音识别结果。',
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
      const fullText = [...usePracticeStore.getState().transcript.map((line) => line.text), finalTranscript].join('\n');
      await usePracticeStore.getState().fetchAICoachFeedback(fullText);
    }

    set((currentState) => ({
      status: 'idle',
      recordingStartedAt: null,
      recordingElapsedMs: currentState.recordingElapsedMs,
      activeRecording: null,
      transcriptionIntervalId: null,
    }));
  },
  fetchAICoachFeedback: async (currentText) => {
    if (!currentText.trim()) {
      return;
    }

    try {
      const state = usePracticeStore.getState();
      const payload = await requestBackend<{ insight?: string }>('/api/coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: currentText,
          language: state.activeLanguage,
          sceneTitle: state.scenes.find((scene) => scene.id === state.activeSceneId)?.title ?? '演讲训练',
        }),
      });

      const insight = payload.insight?.trim();

      if (!insight) {
        return;
      }

      set({
        liveCoachInsight: insight,
        liveCoach: {
          id: `coach-${Date.now()}`,
          tone: 'analytical',
          title: 'AI Live Coach',
          body: insight,
          generatedAt: new Date().toISOString(),
          source: 'ai',
        },
      });
    } catch (error) {
      console.warn('fetchAICoachFeedback failed', error);
      set({
        liveCoachInsight: 'AI 教练暂时没有返回建议，请检查本地代理服务或 DeepSeek 配置。',
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
      if (state.transcriptionIntervalId) {
        clearInterval(state.transcriptionIntervalId);
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
        liveCoach: liveCoachSeed,
        liveCoachInsight: liveCoachSeed.body,
        activeRecording: null,
        transcriptionIntervalId: null,
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
      recordingStartedAt: null,
      recordingElapsedMs: 164000,
      isMicEnabled: true,
      isCameraEnabled: true,
      activeRecording: null,
      transcriptionIntervalId: null,
    }),
}));

export const practiceStoreMock = {
  sceneCatalog,
  historyRecords,
  liveCoachSeed,
  transcriptSeed,
  reportSeed,
};
