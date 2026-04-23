import { FlatList, StyleSheet, Text, View } from 'react-native';

import { usePracticeStore } from '../../../src/store/store';

function deltaColor(delta: number) {
  if (delta > 0) {
    return '#4ADE80';
  }

  if (delta < 0) {
    return '#FB7185';
  }

  return '#A1A1AA';
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`;
}

export default function HistoryScreen() {
  const history = usePracticeStore((state) => state.history);
  const scenes = usePracticeStore((state) => state.scenes);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>History</Text>
        <Text style={styles.title}>历史演讲记录</Text>
        <Text style={styles.subtitle}>
          按 Speak Up 场景化评价体系回看每一轮训练，重点关注场景目标、关键提升点与长期变化趋势。
        </Text>
      </View>

      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const scene = scenes.find((entry) => entry.id === item.sceneId);

          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardTitleBlock}>
                  <Text style={styles.dateText}>{item.title}</Text>
                  <Text style={styles.sceneText}>{item.sceneTitle}</Text>
                </View>
                <View style={styles.scoreBubble}>
                  <Text style={styles.scoreText}>{item.overallScore}</Text>
                  <Text style={styles.scoreCaption}>综合分</Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaText}>{new Date(item.createdAt).toLocaleDateString('zh-CN')}</Text>
                <Text style={styles.metaDivider}>•</Text>
                <Text style={styles.metaText}>{formatDuration(item.durationSec)}</Text>
                <Text style={styles.metaDivider}>•</Text>
                <Text style={styles.metaText}>{item.language === 'zh-CN' ? '中文' : 'English'}</Text>
              </View>

              {scene ? (
                <View style={styles.goalCard}>
                  <Text style={styles.goalLabel}>场景目标</Text>
                  <Text style={styles.goalText}>{scene.goal}</Text>
                </View>
              ) : null}

              <Text style={styles.summary}>{item.summary}</Text>

              {scene ? (
                <View style={styles.focusRow}>
                  {scene.focusKeywords.slice(0, 3).map((keyword) => (
                    <View key={`${item.id}-${keyword}`} style={styles.focusPill}>
                      <Text style={styles.focusText}>{keyword}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.deltaRow}>
                {item.metricChanges.map((metric) => (
                  <View
                    key={`${item.id}-${metric.label}`}
                    style={[styles.deltaPill, { backgroundColor: `${deltaColor(metric.delta)}20` }]}
                  >
                    <Text style={[styles.deltaText, { color: deltaColor(metric.delta) }]}>
                      {metric.label} {metric.delta > 0 ? '+' : ''}
                      {metric.delta}%
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#09090C',
    paddingTop: 64,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  eyebrow: {
    color: '#8B5CF6',
    fontSize: 12,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 8,
  },
  subtitle: {
    color: '#A1A1AA',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 36,
    gap: 14,
  },
  card: {
    borderRadius: 26,
    padding: 18,
    backgroundColor: '#111318',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardTitleBlock: {
    flex: 1,
    gap: 6,
  },
  dateText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
  },
  sceneText: {
    color: '#A78BFA',
    fontSize: 13,
    fontWeight: '600',
  },
  scoreBubble: {
    minWidth: 74,
    height: 74,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.18)',
  },
  scoreText: {
    color: '#F5F3FF',
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 28,
  },
  scoreCaption: {
    color: '#C4B5FD',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  metaText: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '500',
  },
  metaDivider: {
    color: '#52525B',
    fontSize: 12,
  },
  goalCard: {
    marginTop: 16,
    borderRadius: 18,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  goalLabel: {
    color: '#8B5CF6',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  goalText: {
    color: '#E4E4E7',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  summary: {
    color: '#D4D4D8',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 16,
  },
  focusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  focusPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(139,92,246,0.12)',
  },
  focusText: {
    color: '#DDD6FE',
    fontSize: 12,
    fontWeight: '600',
  },
  deltaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
  },
  deltaPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deltaText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
