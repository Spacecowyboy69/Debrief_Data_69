// categoryAnalyzer.js - Module 2: Event Category Analyzer (REBUILT)
// Analyzes ADIZ response patterns across filtered event categories

import Utils from '../core/utils.js';
import DataConnector from '../core/dataConnector.js';

const CategoryAnalyzer = {
  currentAnalysis: null,
  
  /**
   * Analyze events matching category + subfilters
   * Shows aggregate ADIZ pattern across all matching events
   */
  analyze(categoryFilters, options = {}) {
    if (!DataConnector.isLoaded()) {
      throw new Error('Data not loaded');
    }
    
    const windowSize = options.windowSize || 14;
    
    console.log('Analyzing with filters:', categoryFilters);
    
    // Get all matching events
    const events = DataConnector.getEvents(categoryFilters);
    
    console.log('Found events:', events.length);
    
    if (events.length === 0) {
      throw new Error('No events match these filters. Try different filter combination.');
    }
    
    const baselineMap = DataConnector.baselineMap;
    
    // Analyze each event
    const eventAnalyses = events.map(event => {
      const windowData = Utils.getWindowData(event.date, windowSize, baselineMap);
      const baselineStats = Utils.getBaselineStats(event.date, 30, baselineMap);
      
      // Post-event values
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
    
    // Calculate aggregate statistics
    const allPeaks = eventAnalyses.map(a => a.peak);
    const all7DaySpikes = eventAnalyses.map(a => a.avg7DaySpike);
    const allDeltas = eventAnalyses.map(a => a.delta);
    const allTimeToPeak = eventAnalyses.filter(a => a.timeToPeak !== null).map(a => a.timeToPeak);
    
    // Calculate when peak occurs on average
    const avgTimeToPeak = allTimeToPeak.length > 0 ? Utils.mean(allTimeToPeak) : null;
    
    // Calculate average baseline and post-event ADIZ
    const avgBaseline = Utils.mean(eventAnalyses.map(a => a.baseline.mean));
    const avgPostEventADIZ = Utils.mean(all7DaySpikes);
    const avgIncrease = avgPostEventADIZ - avgBaseline;
    
    // Find which day has the biggest average spike (across all events)
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
    const avgCurve = this.calculateAverageResponseCurve(eventAnalyses, windowSize);
    
    // Sort by impact
    const sortedByPeak = [...eventAnalyses].sort((a, b) => b.peak - a.peak);
    
    this.currentAnalysis = {
      filters: categoryFilters,
      eventCount: events.length,
      windowSize,
      avgCurve,
      eventAnalyses,
      summary: {
        avgPeak: Utils.mean(allPeaks),
        avgPeakStdDev: Utils.stdDev(allPeaks),
        avg7DaySpike: Utils.mean(all7DaySpikes),
        avgDelta: Utils.mean(allDeltas),
        medianPeak: this.median(allPeaks),
        maxPeak: Utils.max(allPeaks),
        minPeak: Utils.min(allPeaks),
        avgTimeToPeak: avgTimeToPeak,
        maxSpikeDay: maxSpikeDay,
        maxSpikeValue: maxSpikeValue,
        avgBaseline: avgBaseline,
        avgIncrease: avgIncrease
      },
      topEvents: sortedByPeak.slice(0, 5),
      bottomEvents: sortedByPeak.slice(-5).reverse()
    };
    
    return this.currentAnalysis;
  },
  
  /**
   * Calculate average response curve
   */
  calculateAverageResponseCurve(eventAnalyses, windowSize) {
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
          lowerBound: Math.max(0, mean - stdDev),
          count: valuesAtOffset.length
        });
      }
    }
    
    return curve;
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
   * Get chart data for average response curve
   */
  getAverageCurveData() {
    if (!this.currentAnalysis) return null;
    
    const { avgCurve } = this.currentAnalysis;
    
    return {
      offsets: avgCurve.map(d => d.offset),
      mean: avgCurve.map(d => d.mean),
      upperBound: avgCurve.map(d => d.upperBound),
      lowerBound: avgCurve.map(d => d.lowerBound),
      maxValue: Math.max(...avgCurve.map(d => d.upperBound))
    };
  },
  
  /**
   * Get individual event overlay data
   */
  getEventOverlayData() {
    if (!this.currentAnalysis) return null;
    
    const { eventAnalyses, windowSize } = this.currentAnalysis;
    
    // Create traces for each event (light gray, thin lines)
    return eventAnalyses.map(analysis => {
      const x = [];
      const y = [];
      
      for (let offset = -windowSize; offset <= windowSize; offset++) {
        const point = analysis.windowData.find(d => d.days_from_event === offset);
        if (point) {
          x.push(offset);
          y.push(point.adiz_count);
        }
      }
      
      return { x, y, label: analysis.event.label };
    });
  },
  
  /**
   * Get summary card data
   */
  getSummary() {
    if (!this.currentAnalysis) return null;
    
    const s = this.currentAnalysis.summary;
    
    return {
      eventCount: this.currentAnalysis.eventCount,
      avgPeak: s.avgPeak.toFixed(1),
      avgPeakStdDev: s.avgPeakStdDev.toFixed(1),
      avg7DaySpike: s.avg7DaySpike.toFixed(1),
      avgDelta: s.avgDelta > 0 ? '+' + s.avgDelta.toFixed(1) : s.avgDelta.toFixed(1),
      medianPeak: s.medianPeak.toFixed(1),
      maxPeak: s.maxPeak,
      minPeak: s.minPeak,
      avgTimeToPeak: s.avgTimeToPeak !== null ? s.avgTimeToPeak.toFixed(1) : 'N/A',
      maxSpikeDay: s.maxSpikeDay,
      maxSpikeValue: s.maxSpikeValue.toFixed(1),
      avgBaseline: s.avgBaseline.toFixed(1),
      avgIncrease: s.avgIncrease > 0 ? '+' + s.avgIncrease.toFixed(1) : s.avgIncrease.toFixed(1)
    };
  },
  
  /**
   * Get top/bottom events
   */
  getTopEvents() {
    if (!this.currentAnalysis) return [];
    return this.currentAnalysis.topEvents.map(a => ({
      date: a.event.date,
      label: a.event.label,
      peak: a.peak,
      avg7Day: a.avg7DaySpike.toFixed(1),
      delta: a.delta > 0 ? '+' + a.delta.toFixed(1) : a.delta.toFixed(1)
    }));
  },
  
  getBottomEvents() {
    if (!this.currentAnalysis) return [];
    return this.currentAnalysis.bottomEvents.map(a => ({
      date: a.event.date,
      label: a.event.label,
      peak: a.peak,
      avg7Day: a.avg7DaySpike.toFixed(1),
      delta: a.delta > 0 ? '+' + a.delta.toFixed(1) : a.delta.toFixed(1)
    }));
  }
};

export default CategoryAnalyzer;
