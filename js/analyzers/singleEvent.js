// singleEvent.js - Module 1: Single Event Analyzer
// Analyzes ADIZ response around one specific event

import Utils from '../core/utils.js';
import DataConnector from '../core/dataConnector.js';

const SingleEventAnalyzer = {
  // Current analysis state
  currentEvent: null,
  currentWindow: 7,
  currentBaseline: 30,
  currentAnalysis: null,
  
  // Initialize with an event
  analyze(event, options = {}) {
    if (!DataConnector.isLoaded()) {
      throw new Error('Data not loaded');
    }
    
    this.currentEvent = event;
    this.currentWindow = options.windowSize || 7;
    this.currentBaseline = options.baselineDays || 30;
    
    const eventDate = event.date;
    const baselineMap = DataConnector.baselineMap;
    
    // Get window data
    const windowData = Utils.getWindowData(eventDate, this.currentWindow, baselineMap);
    
    // Get baseline statistics
    const baselineStats = Utils.getBaselineStats(eventDate, this.currentBaseline, baselineMap);
    
    // Calculate window statistics
    const windowValues = windowData
      .filter(d => d.days_from_event >= 0)
      .map(d => d.adiz_count);
    
    const windowStats = {
      mean: Utils.mean(windowValues),
      max: Utils.max(windowValues),
      min: Utils.min(windowValues),
      stdDev: Utils.stdDev(windowValues)
    };
    
    // Calculate impact metrics
    const meanDelta = windowStats.mean - baselineStats.mean;
    const meanDeltaPercent = baselineStats.mean > 0 
      ? ((meanDelta / baselineStats.mean) * 100).toFixed(1)
      : 'N/A';
    
    // Time to peak
    const timeToPeak = Utils.getTimeToPeak(windowData);
    
    // Persistence (days above baseline + 1 sigma)
    const threshold = baselineStats.mean + baselineStats.stdDev;
    const persistence = Utils.getPersistence(windowData, threshold);
    
    // Get other events in window (confounders)
    const confounders = DataConnector.getEventsInWindow(eventDate, this.currentWindow)
      .filter(e => e.date !== event.date || e.label !== event.label);
    
    // Store analysis
    this.currentAnalysis = {
      event,
      eventDate,
      window: {
        size: this.currentWindow,
        data: windowData
      },
      baseline: {
        days: this.currentBaseline,
        stats: baselineStats
      },
      windowStats,
      impact: {
        meanDelta,
        meanDeltaPercent,
        timeToPeak,
        persistence,
        threshold
      },
      confounders
    };
    
    return this.currentAnalysis;
  },
  
  // Get chart data for plotting
  getChartData() {
    if (!this.currentAnalysis) return null;
    
    const windowData = this.currentAnalysis.window.data;
    const { eventDate } = this.currentAnalysis;
    const { threshold } = this.currentAnalysis.impact;
    
    return {
      x: windowData.map(d => d.date),
      y: windowData.map(d => d.adiz_count),
      event_date: eventDate,
      event_index: windowData.findIndex(d => d.date === eventDate),
      threshold
    };
  },
  
  // Generate summary card data
  getSummaryCard() {
    if (!this.currentAnalysis) return null;
    
    const a = this.currentAnalysis;
    
    return {
      event: {
        label: a.event.label,
        date: a.eventDate,
        category: a.event.category,
        description: a.event.description
      },
      metrics: {
        baselineMean: a.baseline.stats.mean.toFixed(1),
        windowMean: a.windowStats.mean.toFixed(1),
        delta: a.impact.meanDelta > 0 ? '+' + a.impact.meanDelta.toFixed(1) : a.impact.meanDelta.toFixed(1),
        deltaPercent: a.impact.meanDeltaPercent,
        maxSpike: a.windowStats.max,
        timeToPeak: a.impact.timeToPeak ? `${a.impact.timeToPeak.days} days (${a.impact.timeToPeak.value})` : 'N/A',
        persistence: `${a.impact.persistence} days`,
        threshold: a.impact.threshold.toFixed(1)
      },
      confounders: a.confounders.length
    };
  },
  
  // Get confounders list for display
  getConfounders() {
    if (!this.currentAnalysis) return [];
    return this.currentAnalysis.confounders;
  }
};

export default SingleEventAnalyzer;
