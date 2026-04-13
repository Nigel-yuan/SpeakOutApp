import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { usePracticeStore } from '../../../src/store/store';

export default function PracticeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [displayProgress, setDisplayProgress] = useState(0);
  const transcriptScrollRef = useRef<ScrollView>(null);
  const glowOpacity = useRef(new Animated.Value(0.42)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressValueRef = useRef(0);
  const status = usePracticeStore((state) => state.status);
  const analysisProgress = usePracticeStore((state) => state.analysisProgress);
  const transcript = usePracticeStore((state) => state.transcript);
  const liveCoachInsight = usePracticeStore((state) => state.liveCoachInsight);
  const setRecordingStatus = usePracticeStore((state) => state.setRecordingStatus);
  const startRecording = usePracticeStore((state) => state.startRecording);
  const stopRecordingAndGenerateReport = usePracticeStore((state) => state.stopRecordingAndGenerateReport);
  const isPreparing = status === 'preparing';
  const isAnalyzing = status === 'analyzing';
  const canShowLivePanels = status === 'recording';

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
    if (status === 'recording') {
      transcriptScrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [status, transcript]);

  const handleFinish = async () => {
    await stopRecordingAndGenerateReport();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.cameraStage}>
        {permission?.granted ? (
          <CameraView facing="front" style={StyleSheet.absoluteFillObject} />
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
        {canShowLivePanels || isAnalyzing ? (
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
              <Text style={styles.cardEyebrow}>AI Live Coach</Text>
              <Text style={styles.coachTitle}>实时点评</Text>
              <Text style={styles.coachBody}>
                {isAnalyzing ? 'AI 正在整理逐字稿并生成最终评分，请稍候片刻。' : liveCoachInsight}
              </Text>
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
                <Text style={styles.actionTitle}>AI教练打分中 {displayProgress}%</Text>
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
    height: 420,
  },
  overlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 22,
    gap: 12,
  },
  transcriptCard: {
    minHeight: 112,
    maxHeight: 150,
    borderRadius: 24,
    overflow: 'hidden',
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(19, 16, 30, 0.42)',
  },
  coachCard: {
    borderRadius: 24,
    overflow: 'hidden',
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(19, 16, 30, 0.48)',
  },
  preparingCard: {
    borderRadius: 24,
    overflow: 'hidden',
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(19, 16, 30, 0.42)',
  },
  cardEyebrow: {
    color: '#A78BFA',
    fontSize: 12,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  transcriptList: {
    gap: 14,
    paddingBottom: 4,
  },
  transcriptItem: {
    gap: 6,
  },
  transcriptSpeaker: {
    color: '#C4B5FD',
    fontSize: 12,
    fontWeight: '700',
  },
  transcriptText: {
    color: '#F5F5F5',
    fontSize: 15,
    lineHeight: 24,
  },
  coachTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  coachBody: {
    color: '#E4E4E7',
    fontSize: 15,
    lineHeight: 24,
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
  actionWrap: {
    borderRadius: 24,
    overflow: 'hidden',
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
    width: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  progressHeadCore: {
    position: 'absolute',
    top: 14,
    bottom: 14,
    right: 6,
    width: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  progressGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  progressContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  actionButton: {
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  actionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  actionSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 6,
  },
});
