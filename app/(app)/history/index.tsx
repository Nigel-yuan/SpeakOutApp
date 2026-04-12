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

export default function HistoryScreen() {
  const history = usePracticeStore((state) => state.history);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>History</Text>
        <Text style={styles.title}>历史演讲记录</Text>
        <Text style={styles.subtitle}>回看最近练习表现、分数变化与每轮总结。</Text>
      </View>

      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.cardTitleBlock}>
                <Text style={styles.dateText}>{item.title}</Text>
                <Text style={styles.sceneText}>{item.sceneTitle}</Text>
              </View>
              <View style={styles.scoreBubble}>
                <Text style={styles.scoreText}>{item.overallScore}</Text>
              </View>
            </View>

            <Text style={styles.summary}>{item.summary}</Text>

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
        )}
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
    minWidth: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  scoreText: {
    color: '#F5F3FF',
    fontSize: 22,
    fontWeight: '800',
  },
  summary: {
    color: '#D4D4D8',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 16,
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
