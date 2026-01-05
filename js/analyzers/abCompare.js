// abCompare.js - Module 3: A/B Comparison Analyzer
// Compare two filtered event groups to see which triggers stronger ADIZ reactions

import Utils from '../core/utils.js';
import DataConnector from '../core/dataConnector.js';

const ABCompare = {
  currentComparison: null,
  
  /**
   * Compare two groups of events
   * @param {object} groupAFilters - Filters for Group A
   * @param {object} groupBFilters - Filters for Group B
   * @param {object} options - Analysis options {windowSize}
   */
  compare(groupAFilters, groupBFilters, options = {}) {
    if (!DataConnector.isLoaded()) {
      throw new Error('Data not loaded');
    }
    
    const windowSize = options.windowSize || 14;
    
    console.log('Comparing Group A:', groupAFilters);
    console.log('Against Group B:', groupBFilters);
    
    // Get events for each group
    const eventsA = DataConnector.getEvents(groupAFilters);
    const eventsB = DataConnector.getEvents(groupBFilters);
    
    console.log('Group A events:', eventsA.length);
    console.log('Group B events:', eventsB.length);
    
    if (eventsA.length === 0 || eventsB.length === 0) {
      throw new Error('One or both groups have no events. Adjust your filters.');
    }
    
    // Analyze each group
    const groupA = this.analyzeGroup(eventsA, windowSize, 'A');
    const groupB = this.analyzeGroup(eventsB, windowSize, 'B');
    
    // Calculate comparison metrics
    const comparison = this.calculateComparison(groupA, groupB);
    
    this.currentComparison = {
      groupA,
      groupB,
      comparison,
      windowSize
    };
    
    return this.currentComparison;
  },
  
  /**
   * Analyze a group of events
   */
  analyzeGroup(events, windowSize, groupName) {
    const baselineMap = DataConnector.baselineMap;
    
    const eventAnalyses = events.map(event => {
      const windowData = Utils.getWindowData(event.date, windowSize, baselineMap);
      const baselineStats = Utils.getBaselineStats(event.date, 30, baselineMap);
      
      const postEventValues = windowData
        .filter(d => d.days_from_event > 0 && d.days_from_event <= 7)
        .map(d => d.adiz_count);
      
      const avg7DaySpike = postEventValues.length > 0 ? Utils.mean(postEventValues) : 0;
      const peak = Utils.max(windowData.map(d => d.adiz_count));
      const timeToPeak = Utils.getTimeToPeak(windowData);
      
      return {
        event,
        windowData,
        baseline: baselineStats,
        peak,
        timeToPeak: timeToPeak ? timeToPeak.days : null,
        avg7DaySpike,
        delta: avg7DaySpike - baselineStats.mean
      };
    });
    
    // Calculate aggregate stats
    const allPeaks = eventAnalyses.map(a => a.peak);
    const all7DaySpikes = eventAnalyses.map(a => a.avg7DaySpike);
    const allDeltas = eventAnalyses.map(a => a.delta);
    const allTimeToPeak = eventAnalyses.filter(a => a.timeToPeak !== null).map(a => a.timeToPeak);
    
    const avgBaseline = Utils.mean(eventAnalyses.map(a => a.baseline.mean));
    const avgIncrease = Utils.mean(all7DaySpikes) - avgBaseline;
    
    // Find peak day
    let maxSpikeDay = 0;
    let maxSpikeValue = 0;
    for (let offset = 1; offset <= windowSize; offset++) {
      const valuesAtOffset = eventAnalyses
        .map(a => {
          const point = a.windowData.find(d => d.days_from_event === offset);
          return point ? point.adiz_count : null;
        })
        .filter(v => v !== null);
      
      if (valuesAtOffset.length > 0) {
        const avgAtOffset = Utils.mean(valuesAtOffset);
        if (avgAtOffset > maxSpikeValue) {
          maxSpikeValue = avgAtOffset;
          maxSpikeDay = offset;
        }
      }
    }
    
    // Average response curve
    const avgCurve = this.calculateAverageCurve(eventAnalyses, windowSize);
    
    return {
      groupName,
      eventCount: events.length,
      eventAnalyses,
      avgCurve,
      stats: {
        avgPeak: Utils.mean(allPeaks),
        avgPeakStdDev: Utils.stdDev(allPeaks),
        avg7DaySpike: Utils.mean(all7DaySpikes),
        avgDelta: Utils.mean(allDeltas),
        avgBaseline: avgBaseline,
        avgIncrease: avgIncrease,
        avgTimeToPeak: allTimeToPeak.length > 0 ? Utils.mean(allTimeToPeak) : null,
        maxSpikeDay: maxSpikeDay,
        medianPeak: this.median(allPeaks)
      }
    };
  },
  
  /**
   * Calculate average response curve for a group
   */
  calculateAverageCurve(eventAnalyses, windowSize) {
    const curve = [];
    
    for (let offset = -windowSize; offset <= windowSize; offset++) {
      const valuesAtOffset = eventAnalyses
        .map(a => {
          const point = a.windowData.find(d => d.days_from_event === offset);
          return point ? point.adiz_count : null;
        })
        .filter(v => v !== null);
      
      if (valuesAtOffset.length > 0) {
        const mean = Utils.mean(valuesAtOffset);
        const stdDev = Utils.stdDev(valuesAtOffset);
        
        curve.push({
          offset,
          mean,
          stdDev,
          upperBound: mean + stdDev,
          lowerBound: Math.max(0, mean - stdDev)
        });
      }
    }
    
    return curve;
  },
  
  /**
   * Calculate comparison metrics between groups
   */
  calculateComparison(groupA, groupB) {
    const statsA = groupA.stats;
    const statsB = groupB.stats;
    
    // Calculate ratios and differences
    const peakRatio = statsA.avgPeak / statsB.avgPeak;
    const increaseRatio = Math.abs(statsA.avgIncrease) / Math.abs(statsB.avgIncrease);
    const spikeRatio = statsA.avg7DaySpike / statsB.avg7DaySpike;
    
    const peakDiff = statsA.avgPeak - statsB.avgPeak;
    const increaseDiff = statsA.avgIncrease - statsB.avgIncrease;
    const spikeDiff = statsA.avg7DaySpike - statsB.avg7DaySpike;
    
    // Determine which is more inflammatory
    const moreInflammatory = statsA.avgIncrease > statsB.avgIncrease ? 'A' : 'B';
    const inflammatoryMargin = Math.abs(peakRatio - 1) * 100; // % difference
    
    // Generate recommendation
    const recommendation = this.generateRecommendation(groupA, groupB, moreInflammatory, inflammatoryMargin);
    
    return {
      peakRatio,
      increaseRatio,
      spikeRatio,
      peakDiff,
      increaseDiff,
      spikeDiff,
      moreInflammatory,
      inflammatoryMargin,
      recommendation
    };
  },
  
  /**
   * Generate human-readable recommendation
   */
  generateRecommendation(groupA, groupB, moreInflammatory, margin) {
    const winner = moreInflammatory === 'A' ? groupA : groupB;
    const loser = moreInflammatory === 'A' ? groupB : groupA;
    const winnerName = moreInflammatory === 'A' ? 'Group A' : 'Group B';
    const loserName = moreInflammatory === 'A' ? 'Group B' : 'Group A';
    
    const ratio = winner.stats.avgIncrease / loser.stats.avgIncrease;
    
    let severity;
    if (ratio > 3) severity = 'significantly more';
    else if (ratio > 2) severity = 'much more';
    else if (ratio > 1.5) severity = 'moderately more';
    else severity = 'somewhat more';
    
    const recommendation = {
      summary: `${winnerName} triggers ${severity} inflammatory (${ratio.toFixed(1)}x stronger average increase).`,
      details: [
        `${winnerName} causes +${winner.stats.avgIncrease.toFixed(1)} aircraft increase on average`,
        `${loserName} causes +${loser.stats.avgIncrease.toFixed(1)} aircraft increase on average`,
        `Peak responses: ${winnerName} = ${winner.stats.avgPeak.toFixed(1)}, ${loserName} = ${loser.stats.avgPeak.toFixed(1)}`,
        `Timing: ${winnerName} peaks on Day ${winner.stats.maxSpikeDay}, ${loserName} peaks on Day ${loser.stats.maxSpikeDay}`
      ],
      lessInflammatory: loserName
    };
    
    return recommendation;
  },
  
  /**
   * Calculate median
   */
  median(values) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  },
  
  /**
   * Get chart data for overlaid curves
   */
  getOverlaidCurvesData() {
    if (!this.currentComparison) return null;
    
    const { groupA, groupB } = this.currentComparison;
    
    return {
      groupA: {
        offsets: groupA.avgCurve.map(d => d.offset),
        mean: groupA.avgCurve.map(d => d.mean),
        upperBound: groupA.avgCurve.map(d => d.upperBound),
        lowerBound: groupA.avgCurve.map(d => d.lowerBound)
      },
      groupB: {
        offsets: groupB.avgCurve.map(d => d.offset),
        mean: groupB.avgCurve.map(d => d.mean),
        upperBound: groupB.avgCurve.map(d => d.upperBound),
        lowerBound: groupB.avgCurve.map(d => d.lowerBound)
      }
    };
  },
  
  /**
   * Get comparison bar chart data
   */
  getComparisonBarData() {
    if (!this.currentComparison) return null;
    
    const { groupA, groupB } = this.currentComparison;
    
    return {
      metrics: ['Avg Peak', 'Avg Increase', '7-Day Spike', 'Time to Peak'],
      groupA: [
        groupA.stats.avgPeak,
        groupA.stats.avgIncrease,
        groupA.stats.avg7DaySpike,
        groupA.stats.avgTimeToPeak || 0
      ],
      groupB: [
        groupB.stats.avgPeak,
        groupB.stats.avgIncrease,
        groupB.stats.avg7DaySpike,
        groupB.stats.avgTimeToPeak || 0
      ]
    };
  }
};

export default ABCompare;
