import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { usePracticeStore } from '../../src/store/store';

export default function HomeScreen() {
  const scenes = usePracticeStore((state) => state.scenes);
  const activeSceneId = usePracticeStore((state) => state.activeSceneId);
  const setActiveScene = usePracticeStore((state) => state.setActiveScene);
  const resetSession = usePracticeStore((state) => state.resetSession);

  const handleStartPractice = () => {
    resetSession();
    router.push('/practice');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>AI</Text>
        </View>
        <View>
          <Text style={styles.eyebrow}>Speak Out</Text>
          <Text style={styles.title}>AI 演讲助手</Text>
        </View>
      </View>

      <Pressable onPress={handleStartPractice} style={styles.heroButtonWrap}>
        <LinearGradient
          colors={['#7C3AED', '#A855F7', '#D946EF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroButton}
        >
          <Text style={styles.heroLabel}>开始新演讲</Text>
          <Text style={styles.heroSubLabel}>进入实时演练与 AI 指导</Text>
        </LinearGradient>
      </Pressable>

      <Pressable onPress={() => router.push('/history')} style={styles.historyEntry}>
        <View>
          <Text style={styles.sectionEyebrow}>Quick Access</Text>
          <Text style={styles.historyTitle}>历史演讲记录</Text>
          <Text style={styles.historyDescription}>查看最近训练表现、分数变化与总结。</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionEyebrow}>Scenes</Text>
        <Text style={styles.sectionTitle}>选择练习场景</Text>
      </View>

      {scenes.map((scene) => {
        const active = scene.id === activeSceneId;

        return (
          <Pressable key={scene.id} onPress={() => setActiveScene(scene.id)} style={styles.sceneCardWrap}>
            <LinearGradient
              colors={active ? ['#1B1231', '#261447'] : ['#111318', '#111318']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.sceneCard, active && styles.sceneCardActive]}
            >
              <View style={styles.sceneTopRow}>
                <Text style={styles.sceneTitle}>{scene.title}</Text>
                {scene.isRecommended ? <Text style={styles.recommendedBadge}>推荐</Text> : null}
              </View>
              <Text style={styles.sceneSubtitle}>{scene.subtitle}</Text>
              <Text style={styles.sceneDescription}>{scene.description}</Text>
              <View style={styles.tagRow}>
                {scene.tags.map((tag) => (
                  <View key={tag} style={styles.tagPill}>
                    <Text style={styles.tagLabel}>{tag}</Text>
                  </View>
                ))}
              </View>
            </LinearGradient>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#09090C',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 72,
    paddingBottom: 48,
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 6,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#17181F',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#F5F3FF',
    fontSize: 16,
    fontWeight: '700',
  },
  eyebrow: {
    color: '#A78BFA',
    fontSize: 13,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  heroButtonWrap: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  heroButton: {
    minHeight: 176,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 26,
    justifyContent: 'flex-end',
  },
  heroLabel: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 8,
  },
  heroSubLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 15,
    lineHeight: 22,
  },
  historyEntry: {
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: '#111318',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeader: {
    marginTop: 6,
    gap: 6,
  },
  sectionEyebrow: {
    color: '#8B5CF6',
    fontSize: 12,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  historyTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  historyDescription: {
    color: '#A1A1AA',
    fontSize: 14,
    marginTop: 6,
    maxWidth: 240,
    lineHeight: 20,
  },
  chevron: {
    color: '#C4B5FD',
    fontSize: 28,
    fontWeight: '300',
  },
  sceneCardWrap: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  sceneCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  sceneCardActive: {
    borderColor: 'rgba(168, 85, 247, 0.36)',
  },
  sceneTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sceneTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  sceneSubtitle: {
    color: '#C4B5FD',
    fontSize: 14,
    marginTop: 10,
  },
  sceneDescription: {
    color: '#A1A1AA',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
  },
  recommendedBadge: {
    color: '#F5F3FF',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: 'rgba(139, 92, 246, 0.22)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  tagPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  tagLabel: {
    color: '#E4E4E7',
    fontSize: 12,
    fontWeight: '600',
  },
});
