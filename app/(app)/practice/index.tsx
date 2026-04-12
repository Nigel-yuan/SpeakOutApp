import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { usePracticeStore } from '../../../src/store/store';

export default function PracticeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const transcriptScrollRef = useRef<ScrollView>(null);
  const status = usePracticeStore((state) => state.status);
  const transcript = usePracticeStore((state) => state.transcript);
  const liveCoachInsight = usePracticeStore((state) => state.liveCoachInsight);
  const setRecordingStatus = usePracticeStore((state) => state.setRecordingStatus);
  const startRecording = usePracticeStore((state) => state.startRecording);
  const beginAnalyzing = usePracticeStore((state) => state.beginAnalyzing);
  const isPreparing = status === 'preparing';
  const canShowLivePanels = status === 'recording';

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  useEffect(() => {
    if (status === 'idle' || status === 'finished') {
      setRecordingStatus('preparing');
    }
  }, [setRecordingStatus, status]);

  useEffect(() => {
    if (status === 'recording') {
      transcriptScrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [status, transcript]);

  const handleFinish = async () => {
    await beginAnalyzing();
    router.replace('/report');
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
              <Text style={styles.cardEyebrow}>AI Live Coach</Text>
              <Text style={styles.coachTitle}>实时点评</Text>
              <Text style={styles.coachBody}>{liveCoachInsight}</Text>
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
