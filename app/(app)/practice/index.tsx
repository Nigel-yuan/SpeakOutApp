import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { usePracticeStore } from '../../../src/store/store';

export default function PracticeScreen() {
  const transcript = usePracticeStore((state) => state.transcript);
  const liveCoach = usePracticeStore((state) => state.liveCoach);
  const beginAnalyzing = usePracticeStore((state) => state.beginAnalyzing);

  const handleFinish = () => {
    beginAnalyzing();
    router.replace('/report');
  };

  return (
    <View style={styles.screen}>
      <View style={styles.cameraStage}>
        {/* TODO: Insert <Camera> from expo-camera here. */}
      </View>

      <LinearGradient
        colors={['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.72)']}
        style={styles.bottomShade}
        pointerEvents="none"
      />

      <View style={styles.overlay}>
        <BlurView intensity={42} tint="dark" style={styles.transcriptCard}>
          <Text style={styles.cardEyebrow}>Live Transcript</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.transcriptList}>
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
          <Text style={styles.coachTitle}>{liveCoach.title}</Text>
          <Text style={styles.coachBody}>{liveCoach.body}</Text>
        </BlurView>

        <Pressable onPress={handleFinish} style={styles.actionWrap}>
          <LinearGradient
            colors={['#6D28D9', '#9333EA', '#C026D3']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.9 }}
            style={styles.actionButton}
          >
            <Text style={styles.actionTitle}>停止并生成报告</Text>
            <Text style={styles.actionSubtitle}>结束录制，进入 AI 分析结果页</Text>
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
    minHeight: 182,
    maxHeight: 220,
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
