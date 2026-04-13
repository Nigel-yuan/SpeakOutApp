import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Polygon, Text as SvgText } from 'react-native-svg';

import { practiceStoreMock, usePracticeStore } from '../../../src/store/store';
import { type RadarMetricKey } from '../../../src/types/types';

const RADAR_SIZE = 280;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_LEVELS = 4;
const RADAR_RADIUS = 98;

function polarToCartesian(index: number, total: number, radius: number) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total;

  return {
    x: RADAR_CENTER + Math.cos(angle) * radius,
    y: RADAR_CENTER + Math.sin(angle) * radius,
  };
}

export default function ReportScreen() {
  const status = usePracticeStore((state) => state.status);
  const report = usePracticeStore((state) => state.currentReport) ?? practiceStoreMock.reportSeed;

  if (status === 'analyzing') {
    return (
      <View style={styles.loadingScreen}>
        <LinearGradient colors={['#120A16', '#09090C']} style={styles.loadingCard}>
          <View style={styles.loadingOrb} />
          <Text style={styles.loadingEyebrow}>Analyzing</Text>
          <Text style={styles.loadingTitle}>AI 正在深度分析您的演讲表现...</Text>
          <Text style={styles.loadingBody}>
            正在综合逐字稿内容、表达节奏与演讲结构，马上为你生成真实评分与行动建议。
          </Text>

          <View style={styles.loadingSkeleton} />
          <View style={[styles.loadingSkeleton, styles.loadingSkeletonShort]} />
          <View style={[styles.loadingSkeleton, styles.loadingSkeletonWide]} />
        </LinearGradient>
      </View>
    );
  }

  const metricKeys = Object.keys(report.radar) as RadarMetricKey[];

  const gridPolygons = Array.from({ length: RADAR_LEVELS }, (_, level) => {
    const radius = (RADAR_RADIUS / RADAR_LEVELS) * (level + 1);

    return metricKeys
      .map((key, index) => {
        const point = polarToCartesian(index, metricKeys.length, radius);
        return `${point.x},${point.y}`;
      })
      .join(' ');
  });

  const dataPolygon = metricKeys
    .map((key, index) => {
      const point = polarToCartesian(index, metricKeys.length, (report.radar[key] / 100) * RADAR_RADIUS);
      return `${point.x},${point.y}`;
    })
    .join(' ');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={['#100914', '#09090C']} style={styles.heroCard}>
        <View style={styles.heroTextBlock}>
          <Text style={styles.eyebrow}>Report</Text>
          <Text style={styles.headline}>{report.headline}</Text>
          <Text style={styles.overview}>{report.overview}</Text>
        </View>

        <View style={styles.scorePanel}>
          <Text style={styles.scoreLabel}>综合评分</Text>
          <Text style={styles.scoreValue}>{report.overallScore}</Text>
          <Text style={styles.scoreDelta}>
            {report.scoreTrend.delta > 0 ? '+' : ''}
            {report.scoreTrend.delta} {report.scoreTrend.comparedToLabel}
          </Text>
        </View>
      </LinearGradient>

      <BlurView intensity={36} tint="dark" style={styles.radarCard}>
        <Text style={styles.sectionEyebrow}>Core Ability Map</Text>
        <Text style={styles.sectionTitle}>核心能力分布</Text>

        <View style={styles.radarWrap}>
          <Svg width={RADAR_SIZE} height={RADAR_SIZE}>
            <G>
              {gridPolygons.map((points, index) => (
                <Polygon
                  key={`grid-${index}`}
                  points={points}
                  fill="transparent"
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth={1}
                />
              ))}

              {metricKeys.map((_, index) => {
                const outer = polarToCartesian(index, metricKeys.length, RADAR_RADIUS);
                return (
                  <Line
                    key={`axis-${index}`}
                    x1={RADAR_CENTER}
                    y1={RADAR_CENTER}
                    x2={outer.x}
                    y2={outer.y}
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth={1}
                  />
                );
              })}

              <Circle cx={RADAR_CENTER} cy={RADAR_CENTER} r={3} fill="#A855F7" />
              <Polygon
                points={dataPolygon}
                fill="rgba(168,85,247,0.28)"
                stroke="#A855F7"
                strokeWidth={2}
              />

              {metricKeys.map((key, index) => {
                const point = polarToCartesian(index, metricKeys.length, (report.radar[key] / 100) * RADAR_RADIUS);
                return <Circle key={`point-${key}`} cx={point.x} cy={point.y} r={4} fill="#E9D5FF" />;
              })}

              {metricKeys.map((key, index) => {
                const labelPoint = polarToCartesian(index, metricKeys.length, RADAR_RADIUS + 28);
                return (
                  <SvgText
                    key={`label-${key}`}
                    x={labelPoint.x}
                    y={labelPoint.y}
                    fill="#F5F3FF"
                    fontSize="12"
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {report.radarMeta[key].label}
                  </SvgText>
                );
              })}
            </G>
          </Svg>
        </View>

        <View style={styles.metricGrid}>
          {metricKeys.map((key) => (
            <View key={key} style={styles.metricItem}>
              <Text style={styles.metricName}>{report.radarMeta[key].label}</Text>
              <Text style={styles.metricScore}>{report.radar[key]}</Text>
            </View>
          ))}
        </View>
      </BlurView>

      <View style={styles.suggestionSection}>
        <Text style={styles.sectionEyebrow}>Action Plan</Text>
        <Text style={styles.sectionTitle}>下一轮可以重点打磨的地方</Text>

        {report.suggestions.map((suggestion, index) => (
          <BlurView key={suggestion.id} intensity={28} tint="dark" style={styles.suggestionCard}>
            <View style={styles.suggestionIndex}>
              <Text style={styles.suggestionIndexText}>{String(index + 1).padStart(2, '0')}</Text>
            </View>
            <View style={styles.suggestionBody}>
              <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
              <Text style={styles.suggestionDetail}>{suggestion.detail}</Text>
            </View>
          </BlurView>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#09090C',
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: '#09090C',
    paddingHorizontal: 20,
    paddingTop: 84,
  },
  loadingCard: {
    borderRadius: 32,
    paddingHorizontal: 24,
    paddingVertical: 28,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.18)',
  },
  loadingOrb: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(168, 85, 247, 0.22)',
    marginBottom: 22,
  },
  loadingEyebrow: {
    color: '#A78BFA',
    fontSize: 12,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  loadingTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '800',
    marginTop: 8,
  },
  loadingBody: {
    color: '#D4D4D8',
    fontSize: 15,
    lineHeight: 24,
    marginTop: 12,
    marginBottom: 28,
  },
  loadingSkeleton: {
    height: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
  },
  loadingSkeletonShort: {
    width: '72%',
  },
  loadingSkeletonWide: {
    width: '88%',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 64,
    paddingBottom: 40,
    gap: 20,
  },
  heroCard: {
    borderRadius: 30,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.18)',
    gap: 22,
  },
  heroTextBlock: {
    gap: 10,
  },
  eyebrow: {
    color: '#A78BFA',
    fontSize: 12,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  headline: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '800',
  },
  overview: {
    color: '#D4D4D8',
    fontSize: 15,
    lineHeight: 24,
  },
  scorePanel: {
    width: 156,
    borderRadius: 24,
    padding: 18,
    backgroundColor: 'rgba(5, 5, 8, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  scoreLabel: {
    color: '#A1A1AA',
    fontSize: 13,
  },
  scoreValue: {
    color: '#FFFFFF',
    fontSize: 56,
    fontWeight: '900',
    marginTop: 8,
  },
  scoreDelta: {
    color: '#C4B5FD',
    fontSize: 13,
    lineHeight: 20,
  },
  radarCard: {
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(17, 19, 24, 0.58)',
  },
  sectionEyebrow: {
    color: '#8B5CF6',
    fontSize: 12,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 6,
  },
  radarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  metricItem: {
    width: '47%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  metricName: {
    color: '#A1A1AA',
    fontSize: 13,
  },
  metricScore: {
    color: '#F5F3FF',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 6,
  },
  suggestionSection: {
    gap: 14,
  },
  suggestionCard: {
    flexDirection: 'row',
    gap: 14,
    borderRadius: 24,
    padding: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(17, 19, 24, 0.52)',
  },
  suggestionIndex: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.18)',
  },
  suggestionIndexText: {
    color: '#E9D5FF',
    fontSize: 14,
    fontWeight: '800',
  },
  suggestionBody: {
    flex: 1,
    gap: 6,
  },
  suggestionTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  suggestionDetail: {
    color: '#D4D4D8',
    fontSize: 14,
    lineHeight: 22,
  },
});
