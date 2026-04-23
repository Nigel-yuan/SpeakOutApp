import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  type CoachDimensionId,
  type CoachDimensionState,
  type CoachDisplayStatus,
  type QAPhase,
} from '../../../src/types/types';
import { usePracticeStore } from '../../../src/store/store';

function getDimensionTitle(id: CoachDimensionId) {
  switch (id) {
    case 'body_expression':
      return '肢体&表情';
    case 'voice_pacing':
      return '语音语调&节奏';
    default:
      return '内容&表达';
  }
}

function getStatusLabel(status: CoachDisplayStatus) {
  switch (status) {
    case 'doing_well':
      return '很好';
    case 'stable':
      return '稳定';
    case 'adjust_now':
      return '调整';
    default:
      return '分析中';
  }
}

function getStatusTone(status: CoachDisplayStatus) {
  switch (status) {
    case 'doing_well':
      return '#34D399';
    case 'stable':
      return '#60A5FA';
    case 'adjust_now':
      return '#F59E0B';
    default:
      return '#71717A';
  }
}

function getEnergyLevel(status: CoachDisplayStatus) {
  switch (status) {
    case 'doing_well':
      return 100;
    case 'stable':
      return 68;
    case 'adjust_now':
      return 32;
    default:
      return 40;
  }
}

function getQAPhaseLabel(phase: QAPhase) {
  switch (phase) {
    case 'preparing_context':
      return '整理上下文';
    case 'ai_asking':
      return 'AI 提问中';
    case 'user_answering':
      return '你正在回答';
    case 'evaluating_answer':
      return 'AI 点评中';
    case 'ready_next_turn':
      return '准备下一题';
    case 'completed':
      return '问答完成';
    default:
      return '待命';
  }
}

function getQAPhaseSubtitle(phase: QAPhase) {
  switch (phase) {
    case 'preparing_context':
      return 'AI 正在根据刚才的演讲内容准备追问。';
    case 'ai_asking':
      return '请先听完教练的问题，播报结束后再开始回答。';
    case 'user_answering':
      return '现在轮到你回答，停顿约 2 秒后会自动进入下一轮。';
    case 'evaluating_answer':
      return 'AI 正在评估你的回答并准备下一题。';
    case 'completed':
      return '这一轮语音问答已经完成。';
    default:
      return '围绕当前演讲继续做语音追问。';
  }
}

function getQAActionLabel(phase: QAPhase, enabled: boolean) {
  if (!enabled) {
    return {
      title: '开始语音问答',
      subtitle: 'AI 会像面试官一样开口提问，并在你回答后继续追问。',
      disabled: false,
    };
  }

  switch (phase) {
    case 'preparing_context':
      return {
        title: '正在准备问题',
        subtitle: '教练正在整理上下文，请稍候。',
        disabled: true,
      };
    case 'ai_asking':
      return {
        title: 'AI 正在提问',
        subtitle: '请先听完问题，播报结束后会自动切到回答阶段。',
        disabled: true,
      };
    case 'user_answering':
      return {
        title: '结束本轮回答',
        subtitle: '如果你已经答完，可以手动进入 AI 点评与下一题。',
        disabled: false,
      };
    case 'evaluating_answer':
      return {
        title: 'AI 点评中',
        subtitle: '正在根据你刚才的回答生成反馈与下一题。',
        disabled: true,
      };
    case 'completed':
      return {
        title: '重新开始问答',
        subtitle: '开始一轮新的语音问答训练。',
        disabled: false,
      };
    default:
      return {
        title: '继续问答',
        subtitle: '继续进行下一轮语音追问。',
        disabled: false,
      };
  }
}

function MiniCoachBar({ dimension }: { dimension: CoachDimensionState }) {
  const energy = getEnergyLevel(dimension.status);

  return (
    <View style={styles.miniBarCard}>
      <View style={styles.miniBarHeader}>
        <Text style={styles.miniBarTitle}>{getDimensionTitle(dimension.id)}</Text>
        <Text style={[styles.miniBarStatus, { color: getStatusTone(dimension.status) }]}>
          {getStatusLabel(dimension.status)}
        </Text>
      </View>

      <View style={styles.miniBarTrack}>
        <View style={[styles.miniBarFillWrap, { flex: energy }]}>
          <LinearGradient
            colors={[getStatusTone(dimension.status), dimension.status === 'adjust_now' ? '#FB923C' : '#A855F7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.miniBarFill}
          />
        </View>
        <View style={{ flex: Math.max(0, 100 - energy) }} />
      </View>

      <Text numberOfLines={2} style={styles.miniBarCue}>
        {dimension.headline}
      </Text>
    </View>
  );
}

export default function PracticeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [displayProgress, setDisplayProgress] = useState(0);
  const [typedCoachText, setTypedCoachText] = useState('');
  const cameraRef = useRef<CameraView | null>(null);
  const transcriptScrollRef = useRef<ScrollView>(null);
  const qaScrollRef = useRef<ScrollView>(null);
  const spokenTurnRef = useRef<string | null>(null);
  const bodyLaneInFlightRef = useRef(false);
  const pendingBodyFrameRef = useRef<string | null>(null);
  const glowOpacity = useRef(new Animated.Value(0.42)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressValueRef = useRef(0);
  const status = usePracticeStore((state) => state.status);
  const activeLanguage = usePracticeStore((state) => state.activeLanguage);
  const analysisProgress = usePracticeStore((state) => state.analysisProgress);
  const transcript = usePracticeStore((state) => state.transcript);
  const liveCoachInsight = usePracticeStore((state) => state.liveCoachInsight);
  const coachPanel = usePracticeStore((state) => state.coachPanel);
  const qaEnabled = usePracticeStore((state) => state.qaEnabled);
  const qaPhase = usePracticeStore((state) => state.qaPhase);
  const qaMessages = usePracticeStore((state) => state.qaMessages);
  const qaCurrentGoal = usePracticeStore((state) => state.qaCurrentGoal);
  const qaSpeaking = usePracticeStore((state) => state.qaSpeaking);
  const qaTurnId = usePracticeStore((state) => state.qaTurnId);
  const setRecordingStatus = usePracticeStore((state) => state.setRecordingStatus);
  const startRecording = usePracticeStore((state) => state.startRecording);
  const stopRecordingAndGenerateReport = usePracticeStore((state) => state.stopRecordingAndGenerateReport);
  const fetchAICoachFeedback = usePracticeStore((state) => state.fetchAICoachFeedback);
  const startCoachQA = usePracticeStore((state) => state.startCoachQA);
  const continueCoachQA = usePracticeStore((state) => state.continueCoachQA);
  const markQAAudioPlaybackStarted = usePracticeStore((state) => state.markQAAudioPlaybackStarted);
  const markQAAudioPlaybackEnded = usePracticeStore((state) => state.markQAAudioPlaybackEnded);
  const closeCoachQA = usePracticeStore((state) => state.closeCoachQA);
  const isPreparing = status === 'preparing';
  const isAnalyzing = status === 'analyzing';
  const isRecording = status === 'recording';
  const canShowLivePanels = isRecording || isAnalyzing;

  const latestCoachMessage = useMemo(() => {
    const messages = [...qaMessages].reverse();
    return messages.find((message) => message.role === 'coach') ?? null;
  }, [qaMessages]);

  const qaAction = useMemo(() => getQAActionLabel(qaPhase, qaEnabled), [qaEnabled, qaPhase]);

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  useEffect(() => {
    if (status === 'idle') {
      setRecordingStatus('preparing');
    }
  }, [setRecordingStatus, status]);

  useEffect(() => {
    if (status === 'finished') {
      router.replace('/report');
    }
  }, [status]);

  useEffect(() => {
    if (!isAnalyzing) {
      glowOpacity.stopAnimation();
      glowOpacity.setValue(0.42);
      progressAnim.stopAnimation();
      progressAnim.setValue(0);
      progressValueRef.current = 0;
      setDisplayProgress(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 0.82,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.38,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();

    return () => {
      loop.stop();
      glowOpacity.stopAnimation();
    };
  }, [glowOpacity, isAnalyzing, progressAnim]);

  useEffect(() => {
    const delta = Math.abs(analysisProgress - progressValueRef.current);
    const duration = Math.max(180, Math.min(520, delta * 16));

    Animated.timing(progressAnim, {
      toValue: analysisProgress,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    progressValueRef.current = analysisProgress;
  }, [analysisProgress, progressAnim]);

  useEffect(() => {
    const listenerId = progressAnim.addListener(({ value }) => {
      setDisplayProgress(Math.round(value));
    });

    return () => {
      progressAnim.removeListener(listenerId);
    };
  }, [progressAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  useEffect(() => {
    if (isRecording) {
      transcriptScrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [isRecording, transcript]);

  useEffect(() => {
    qaScrollRef.current?.scrollToEnd({ animated: true });
  }, [qaMessages, typedCoachText]);

  useEffect(() => {
    if (!latestCoachMessage) {
      setTypedCoachText('');
      return;
    }

    setTypedCoachText('');
    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      setTypedCoachText(latestCoachMessage.text.slice(0, index));
      if (index >= latestCoachMessage.text.length) {
        clearInterval(timer);
      }
    }, latestCoachMessage.emphasis === 'primary' ? 24 : 18);

    return () => clearInterval(timer);
  }, [latestCoachMessage]);

  useEffect(() => {
    if (!qaEnabled) {
      spokenTurnRef.current = null;
      void Speech.stop();
    }
  }, [qaEnabled]);

  useEffect(() => {
    if (!qaEnabled || qaPhase !== 'ai_asking' || !latestCoachMessage) {
      return;
    }

    const turnId = qaTurnId ?? latestCoachMessage.id;
    if (spokenTurnRef.current === turnId) {
      return;
    }

    spokenTurnRef.current = turnId;

    void Speech.stop();
    Speech.speak(latestCoachMessage.text, {
      language: activeLanguage,
      pitch: 1.0,
      rate: activeLanguage === 'zh-CN' ? 0.96 : 0.92,
      onStart: () => markQAAudioPlaybackStarted(turnId),
      onDone: () => markQAAudioPlaybackEnded(turnId),
      onStopped: () => markQAAudioPlaybackEnded(turnId),
      onError: () => markQAAudioPlaybackEnded(turnId),
    });
  }, [
    activeLanguage,
    latestCoachMessage,
    markQAAudioPlaybackEnded,
    markQAAudioPlaybackStarted,
    qaEnabled,
    qaPhase,
    qaTurnId,
  ]);

  useEffect(() => {
    const userTranscript = transcript.filter((line) => line.speaker === 'user');
    const userTranscriptCount = userTranscript.length;
    const userTranscriptChars = userTranscript
      .map((line) => line.text)
      .join('')
      .replace(/\s+/g, '').length;

    if (!isRecording || qaEnabled || isAnalyzing || userTranscriptCount === 0 || userTranscriptChars < 18) {
      pendingBodyFrameRef.current = null;
      bodyLaneInFlightRef.current = false;
      return;
    }

    let cancelled = false;

    const queueBodyRefresh = async (frameBase64: string) => {
      if (cancelled || !frameBase64) {
        return;
      }

      if (bodyLaneInFlightRef.current) {
        pendingBodyFrameRef.current = frameBase64;
        return;
      }

      bodyLaneInFlightRef.current = true;

      try {
        await fetchAICoachFeedback('', {
          scope: 'body_visual',
          frameBase64,
        });
      } finally {
        bodyLaneInFlightRef.current = false;
        const nextFrame = pendingBodyFrameRef.current;
        pendingBodyFrameRef.current = null;
        if (nextFrame && !cancelled) {
          void queueBodyRefresh(nextFrame);
        }
      }
    };

    const intervalId = setInterval(async () => {
      const camera = cameraRef.current as unknown as {
        takePictureAsync?: (options?: { base64?: boolean; quality?: number; skipProcessing?: boolean }) => Promise<{
          base64?: string | null;
        }>;
      } | null;

      if (!camera?.takePictureAsync) {
        return;
      }

      try {
        const picture = await camera.takePictureAsync({
          base64: true,
          quality: 0.18,
          skipProcessing: true,
        });

        if (picture?.base64) {
          void queueBodyRefresh(picture.base64);
        }
      } catch (error) {
        console.warn('body visual refresh failed', error);
      }
    }, 2500);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [fetchAICoachFeedback, isAnalyzing, isRecording, qaEnabled, transcript]);

  const handleFinish = async () => {
    await stopRecordingAndGenerateReport();
  };

  const handleCoachQA = async () => {
    if (!qaEnabled || qaPhase === 'completed') {
      await startCoachQA();
      return;
    }

    if (qaPhase !== 'user_answering') {
      return;
    }

    await continueCoachQA();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.cameraStage}>
        {permission?.granted ? (
          <CameraView ref={cameraRef} facing="front" style={StyleSheet.absoluteFillObject} />
        ) : (
          <View style={styles.permissionFallback}>
            <Text style={styles.permissionTitle}>需要相机权限</Text>
            <Text style={styles.permissionBody}>
              请允许访问前置摄像头，这样我们才能在整理仪容和正式录制阶段提供实时演讲视图。
            </Text>
          </View>
        )}
      </View>

      <LinearGradient
        colors={['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.72)']}
        style={styles.bottomShade}
        pointerEvents="none"
      />

      <View style={styles.overlay}>
        {canShowLivePanels ? (
          <>
            <BlurView intensity={42} tint="dark" style={styles.transcriptCard}>
              <Text style={styles.cardEyebrow}>Live Transcript</Text>
              <ScrollView
                ref={transcriptScrollRef}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.transcriptList}
                onContentSizeChange={() => transcriptScrollRef.current?.scrollToEnd({ animated: true })}
              >
                {transcript.map((line) => (
                  <View key={line.id} style={styles.transcriptItem}>
                    <Text style={styles.transcriptSpeaker}>
                      {line.speaker === 'user' ? '你' : 'AI'} · {(line.timestampMs / 1000).toFixed(1)}s
                    </Text>
                    <Text style={styles.transcriptText}>{line.text}</Text>
                  </View>
                ))}
              </ScrollView>
            </BlurView>

            <BlurView intensity={52} tint="dark" style={styles.coachCard}>
              <View style={styles.coachHeader}>
                <View>
                  <Text style={styles.cardEyebrow}>AI Live Coach</Text>
                  <Text style={styles.coachTitle}>实时点评</Text>
                </View>
                {!isAnalyzing ? (
                  <Pressable onPress={handleCoachQA} style={styles.qaTrigger}>
                    <Text style={styles.qaTriggerText}>{qaEnabled ? '语音问答中' : '教练问答'}</Text>
                  </Pressable>
                ) : null}
              </View>

              <Text style={styles.coachBody}>
                {isAnalyzing ? 'AI 正在整理逐字稿并生成最终评分，请稍候片刻。' : liveCoachInsight}
              </Text>

              {!isAnalyzing ? (
                <View style={styles.dimensionRow}>
                  <MiniCoachBar dimension={coachPanel.bodyExpression} />
                  <MiniCoachBar dimension={coachPanel.voicePacing} />
                  <MiniCoachBar dimension={coachPanel.contentExpression} />
                </View>
              ) : null}
            </BlurView>
          </>
        ) : (
          <BlurView intensity={36} tint="dark" style={styles.preparingCard}>
            <Text style={styles.cardEyebrow}>Preparation</Text>
            <Text style={styles.preparingTitle}>整理仪容，找到最舒服的镜头状态</Text>
            <Text style={styles.preparingBody}>
              调整坐姿、光线和前置摄像头角度，确认你已经准备好进入正式演讲。
            </Text>
          </BlurView>
        )}

        {qaEnabled && !isAnalyzing ? (
          <BlurView intensity={45} tint="dark" style={styles.qaPanel}>
            <View style={styles.qaHeroRow}>
              <View style={styles.qaAvatar}>
                <Text style={styles.qaAvatarText}>AI</Text>
              </View>
              <View style={styles.qaHeroText}>
                <Text style={styles.qaHeroTitle}>虚拟教练</Text>
                <Text style={styles.qaHeroSubtitle}>{getQAPhaseSubtitle(qaPhase)}</Text>
              </View>
              <View style={styles.qaPhaseBadge}>
                <Text style={styles.qaPhaseBadgeText}>{qaSpeaking ? '播报中' : getQAPhaseLabel(qaPhase)}</Text>
              </View>
              <Pressable onPress={closeCoachQA} style={styles.qaCloseButton}>
                <Text style={styles.qaCloseButtonText}>收起</Text>
              </Pressable>
            </View>

            {qaCurrentGoal ? (
              <View style={styles.qaGoalPill}>
                <Text style={styles.qaGoalPillText}>本轮目标：{qaCurrentGoal}</Text>
              </View>
            ) : null}

            <ScrollView
              ref={qaScrollRef}
              style={styles.qaConversation}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.qaConversationContent}
            >
              {qaMessages.map((message, index) => {
                const isLatestCoach = latestCoachMessage?.id === message.id;
                const visibleText = message.role === 'coach' && isLatestCoach ? typedCoachText || ' ' : message.text;

                return (
                  <View
                    key={message.id}
                    style={[
                      styles.qaBubble,
                      message.role === 'user' ? styles.qaBubbleUser : styles.qaBubbleCoach,
                      index === qaMessages.length - 1 ? styles.qaBubbleLatest : null,
                    ]}
                  >
                    <Text style={[styles.qaBubbleText, message.role === 'user' ? styles.qaBubbleTextUser : null]}>
                      {visibleText}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>

            <Pressable
              disabled={qaAction.disabled}
              onPress={handleCoachQA}
              style={[styles.qaActionWrap, qaAction.disabled ? styles.qaActionWrapDisabled : null]}
            >
              <LinearGradient colors={['#312E81', '#6D28D9']} style={styles.qaActionButton}>
                <Text style={styles.qaActionTitle}>{qaAction.title}</Text>
                <Text style={styles.qaActionSubtitle}>{qaAction.subtitle}</Text>
              </LinearGradient>
            </Pressable>
          </BlurView>
        ) : null}

        {isAnalyzing ? (
          <View style={styles.progressWrap}>
            <View style={styles.progressShell}>
              <Animated.View style={[styles.progressFill, { width: progressWidth }]}>
                <LinearGradient
                  colors={['#6D28D9', '#9333EA', '#C026D3']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.progressGradient}
                />
                <Animated.View style={[styles.progressHeadGlow, { opacity: glowOpacity }]} pointerEvents="none" />
                <View style={styles.progressHeadCore} pointerEvents="none" />
              </Animated.View>
              <Animated.View style={[styles.progressGlow, { opacity: glowOpacity }]} pointerEvents="none" />
              <View style={styles.progressContent}>
                <Text style={styles.actionTitle}>AI 教练打分中 {displayProgress}%</Text>
              </View>
            </View>
          </View>
        ) : (
          <Pressable onPress={isPreparing ? startRecording : handleFinish} style={styles.actionWrap}>
            <LinearGradient
              colors={['#6D28D9', '#9333EA', '#C026D3']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0.9 }}
              style={styles.actionButton}
            >
              <Text style={styles.actionTitle}>{isPreparing ? '准备完毕' : '停止并生成报告'}</Text>
              <Text style={styles.actionSubtitle}>
                {isPreparing ? '整理仪容仪表，调整摄像头视角' : '结束录制，进入 AI 分析结果页'}
              </Text>
            </LinearGradient>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#020203',
  },
  cameraStage: {
    flex: 1,
    backgroundColor: '#050507',
  },
  permissionFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#050507',
  },
  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  permissionBody: {
    color: '#D4D4D8',
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
    marginTop: 12,
  },
  bottomShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 460,
  },
  overlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 54,
    bottom: 18,
    justifyContent: 'flex-end',
    gap: 12,
  },
  transcriptCard: {
    minHeight: 112,
    maxHeight: 150,
    borderRadius: 24,
    overflow: 'hidden',
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(11, 12, 20, 0.55)',
  },
  cardEyebrow: {
    color: '#A78BFA',
    fontSize: 11,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  transcriptList: {
    gap: 12,
    paddingTop: 12,
  },
  transcriptItem: {
    gap: 4,
  },
  transcriptSpeaker: {
    color: '#D8B4FE',
    fontSize: 11,
    fontWeight: '700',
  },
  transcriptText: {
    color: '#F4F4F5',
    fontSize: 14,
    lineHeight: 21,
  },
  coachCard: {
    borderRadius: 24,
    overflow: 'hidden',
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(11, 12, 20, 0.6)',
  },
  coachHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  coachTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  coachBody: {
    color: '#E4E4E7',
    fontSize: 15,
    lineHeight: 24,
    marginTop: 6,
  },
  qaTrigger: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(168,85,247,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.18)',
  },
  qaTriggerText: {
    color: '#F5F3FF',
    fontSize: 12,
    fontWeight: '700',
  },
  dimensionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  miniBarCard: {
    flex: 1,
    minHeight: 92,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  miniBarHeader: {
    gap: 2,
  },
  miniBarTitle: {
    color: '#F5F3FF',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  miniBarStatus: {
    fontSize: 11,
    fontWeight: '700',
  },
  miniBarTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 10,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  miniBarFillWrap: {
    height: '100%',
  },
  miniBarFill: {
    flex: 1,
    borderRadius: 999,
  },
  miniBarCue: {
    color: '#D4D4D8',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 10,
  },
  preparingCard: {
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingVertical: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(10, 10, 16, 0.62)',
  },
  preparingTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  preparingBody: {
    color: '#E4E4E7',
    fontSize: 15,
    lineHeight: 24,
  },
  qaPanel: {
    borderRadius: 24,
    overflow: 'hidden',
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(11, 12, 20, 0.68)',
  },
  qaHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qaAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168,85,247,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(216,180,254,0.4)',
  },
  qaAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  qaHeroText: {
    flex: 1,
    gap: 4,
  },
  qaHeroTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  qaHeroSubtitle: {
    color: '#C4B5FD',
    fontSize: 12,
    lineHeight: 18,
  },
  qaPhaseBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(91,33,182,0.24)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.16)',
  },
  qaPhaseBadgeText: {
    color: '#F5F3FF',
    fontSize: 11,
    fontWeight: '700',
  },
  qaCloseButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  qaCloseButtonText: {
    color: '#E4E4E7',
    fontSize: 12,
    fontWeight: '700',
  },
  qaGoalPill: {
    marginTop: 12,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  qaGoalPillText: {
    color: '#EDE9FE',
    fontSize: 12,
    lineHeight: 18,
  },
  qaConversation: {
    maxHeight: 190,
    marginTop: 14,
  },
  qaConversationContent: {
    gap: 10,
    paddingBottom: 4,
  },
  qaBubble: {
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
  },
  qaBubbleCoach: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.07)',
    alignSelf: 'stretch',
  },
  qaBubbleUser: {
    backgroundColor: 'rgba(109,40,217,0.24)',
    borderColor: 'rgba(196,181,253,0.16)',
    alignSelf: 'flex-end',
    maxWidth: '88%',
  },
  qaBubbleLatest: {
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  qaBubbleText: {
    color: '#F5F5F5',
    fontSize: 14,
    lineHeight: 22,
  },
  qaBubbleTextUser: {
    color: '#FFFFFF',
  },
  qaActionWrap: {
    marginTop: 14,
    borderRadius: 20,
    overflow: 'hidden',
  },
  qaActionWrapDisabled: {
    opacity: 0.72,
  },
  qaActionButton: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  qaActionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  qaActionSubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  actionWrap: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  actionButton: {
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 18,
  },
  actionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  actionSubtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 6,
  },
  progressWrap: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  progressShell: {
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(91, 33, 182, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(196, 181, 253, 0.22)',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  progressFill: {
    ...StyleSheet.absoluteFillObject,
    right: 'auto',
    borderRadius: 24,
    overflow: 'hidden',
  },
  progressGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
  },
  progressHeadGlow: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    right: -10,
    width: 26,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.48)',
  },
  progressHeadCore: {
    position: 'absolute',
    top: 14,
    bottom: 14,
    right: 4,
    width: 10,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  progressGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(196, 181, 253, 0.18)',
  },
  progressContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
});
