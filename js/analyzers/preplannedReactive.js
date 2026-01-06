// preplannedReactive.js - Module 8: Reactive vs Pre-Planned Classifier
// Determines if PLA response was reactive (triggered) or pre-planned (using event as excuse)

import Utils from '../core/utils.js';
import DataConnector from '../core/dataConnector.js';

const PreplannedReactive = {
  currentAnalysis: null,
  
  // Symbolic dates that PRC uses for messaging
  SYMBOLIC_DATES: [
    { month: 10, day: 10, name: "Double Ten Day (ROC National Day)" },
    { month: 1, day: 1, name: "New Year's Day" },
    { month: 5, day: 20, name: "Taiwan Presidential Inauguration" },
    { month: 7, day: 1, name: "CCP Founding Day" },
    { month: 10, day: 1, name: "PRC National Day" },
    { month: 12, day: 10, name: "Human Rights Day" }
  ],
  
  /**
   * Classify an event as reactive or pre-planned
   */
  classify(event, options = {}) {
    if (!DataConnector.isLoaded()) {
      throw new Error('Data not loaded');
    }
    
    const windowSize = options.windowSize || 21; // Need longer window for pre-event analysis
    const baselineMap = DataConnector.baselineMap;
    
    console.log('Classifying event:', event);
    
    // Get event data
    const windowData = Utils.getWindowData(event.date, windowSize, baselineMap);
    const baselineStats = Utils.getBaselineStats(event.date, 30, baselineMap);
    
    // Run all classification signals
    const signals = {
      temporal: this.analyzeTemporalProximity(windowData),
      buildup: this.analyzePreEventBuildup(windowData, baselineStats),
      magnitude: this.analyzeMagnitude(event, windowData, baselineStats),
      symbolic: this.analyzeSymbolicTiming(event.date),
      pattern: this.analyzePattern(windowData)
    };
    
    // Calculate overall classification
    const classification = this.calculateClassification(signals);
    
    this.currentAnalysis = {
      event,
      windowSize,
      windowData,
      baselineStats,
      signals,
      classification
    };
    
    return this.currentAnalysis;
  },
  
  /**
   * Signal 1: Temporal Proximity (from flowchart)
   * How quickly did response occur?
   */
  analyzeTemporalProximity(windowData) {
    const timeToPeak = Utils.getTimeToPeak(windowData);
    
    if (!timeToPeak) {
      return {
        responseTime: null,
        category: 'unknown',
        reactiveScore: 0,
        explanation: 'No clear peak detected in window'
      };
    }
    
    const days = timeToPeak.days;
    let category, reactiveScore, explanation;
    
    if (days >= 0 && days <= 2) {
      category = 'immediate';
      reactiveScore = 0.9; // Strong reactive signal
      explanation = `Peak occurred ${days} day(s) after event - indicates immediate reaction`;
    } else if (days >= 3 && days <= 9) {
      category = 'delayed';
      reactiveScore = 0.5; // Ambiguous
      explanation = `Peak occurred ${days} days after event - could be either reactive or pre-planned`;
    } else {
      category = 'very_delayed';
      reactiveScore = 0.5; // Ambiguous - could be unrelated
      explanation = `Peak occurred ${days} days after event - likely unrelated to this event`;
    }
    
    return {
      responseTime: days,
      category,
      reactiveScore,
      explanation
    };
  },
  
  /**
   * Signal 2: Pre-Event Buildup
   * Was ADIZ rising before the event?
   */
  analyzePreEventBuildup(windowData, baselineStats) {
    // Look at days -14 to -1
    const preEventData = windowData
      .filter(d => d.days_from_event < 0 && d.days_from_event >= -14)
      .sort((a, b) => a.days_from_event - b.days_from_event);
    
    if (preEventData.length < 5) {
      return {
        trend: 'insufficient_data',
        reactiveScore: 0.5,
        explanation: 'Insufficient pre-event data to determine buildup'
      };
    }
    
    // Calculate linear regression slope
    const values = preEventData.map(d => d.adiz_count);
    const mean = Utils.mean(values);
    const slope = this.calculateTrendSlope(preEventData);
    
    // Compare to baseline
    const avgPreEvent = mean;
    const baseline = baselineStats.mean;
    const isRising = slope > 2; // ADIZ increasing by 2+ per day
    const isElevated = avgPreEvent > baseline * 1.2; // 20% above baseline
    
    let reactiveScore, explanation, trend;
    
    if (isRising && isElevated) {
      trend = 'rising';
      reactiveScore = 0.2; // Strong pre-planning signal
      explanation = `ADIZ was rising before event (slope: +${slope.toFixed(1)}/day), suggests pre-planning`;
    } else if (isElevated) {
      trend = 'elevated';
      reactiveScore = 0.4; // Moderate pre-planning signal
      explanation = `ADIZ elevated before event but not rising - possible pre-positioning`;
    } else {
      trend = 'normal';
      reactiveScore = 0.8; // Strong reactive signal
      explanation = `ADIZ normal before event - no evidence of pre-planning`;
    }
    
    return {
      trend,
      slope,
      avgPreEvent,
      baseline,
      reactiveScore,
      explanation
    };
  },
  
  /**
   * Signal 3: Magnitude Analysis
   * Is response unusually large for this event type?
   */
  analyzeMagnitude(event, windowData, baselineStats) {
    // Get similar events from same category
    const similarEvents = DataConnector.getEvents({ category: event.category });
    
    if (similarEvents.length < 3) {
      return {
        comparison: 'insufficient_data',
        reactiveScore: 0.5,
        explanation: 'Not enough similar events to compare magnitude'
      };
    }
    
    // Calculate this event's peak
    const thisPeak = Utils.max(windowData.map(d => d.adiz_count));
    
    // Calculate average peak for similar events
    const baselineMap = DataConnector.baselineMap;
    const similarPeaks = similarEvents.slice(0, 20).map(e => {
      const data = Utils.getWindowData(e.date, 14, baselineMap);
      return Utils.max(data.map(d => d.adiz_count));
    }).filter(p => p > 0);
    
    const avgSimilarPeak = Utils.mean(similarPeaks);
    const ratio = thisPeak / avgSimilarPeak;
    
    let reactiveScore, explanation, comparison;
    
    if (ratio > 2.5) {
      comparison = 'much_larger';
      reactiveScore = 0.6; // Changed from 0.3 - huge spike often means strong reaction
      explanation = `Response ${ratio.toFixed(1)}x larger than typical ${event.category} events - suggests unusually strong reaction`;
    } else if (ratio > 1.5) {
      comparison = 'larger';
      reactiveScore = 0.6; // Changed from 0.5
      explanation = `Response ${ratio.toFixed(1)}x larger than typical - suggests strong reaction`;
    } else {
      comparison = 'typical';
      reactiveScore = 0.7; // Reactive signal
      explanation = `Response size (${thisPeak}) typical for ${event.category} events (avg: ${avgSimilarPeak.toFixed(1)})`;
    }
    
    return {
      thisPeak,
      avgSimilarPeak,
      ratio,
      comparison,
      reactiveScore,
      explanation
    };
  },
  
  /**
   * Signal 4: Symbolic Timing
   * Is event aligned with symbolic date?
   */
  analyzeSymbolicTiming(eventDate) {
    const date = new Date(eventDate);
    const month = date.getMonth() + 1; // JS months are 0-indexed
    const day = date.getDate();
    
    // Check if within ±2 days of symbolic date (tightened from 3)
    const matchingSymbolic = this.SYMBOLIC_DATES.find(sd => {
      const daysDiff = Math.abs((month * 100 + day) - (sd.month * 100 + sd.day));
      return daysDiff <= 2 || daysDiff >= 98; // Within 2 days
    });
    
    if (matchingSymbolic) {
      return {
        isSymbolic: true,
        symbolicDate: matchingSymbolic.name,
        reactiveScore: 0.4, // Changed from 0.3 - less punitive
        explanation: `Event occurred near ${matchingSymbolic.name} - may have symbolic timing`
      };
    }
    
    return {
      isSymbolic: false,
      symbolicDate: null,
      reactiveScore: 0.5, // Neutral - don't reward for NOT being symbolic
      explanation: 'Event not aligned with known symbolic dates'
    };
  },
  
  /**
   * Signal 5: Pattern Matching
   * Does response curve match known patterns?
   */
  analyzePattern(windowData) {
    // Analyze shape of response curve
    const values = windowData.map(d => d.adiz_count);
    const peak = Utils.max(values);
    const peakIndex = values.indexOf(peak);
    
    // Reactive pattern: sharp spike then decay
    // Pre-planned pattern: gradual build, sustained plateau, gradual decay
    
    const preEventMean = Utils.mean(values.slice(0, Math.floor(values.length / 2)));
    const postEventMean = Utils.mean(values.slice(Math.floor(values.length / 2)));
    
    const sharpness = peak / preEventMean;
    const sustained = this.isSustained(windowData);
    
    let pattern, reactiveScore, explanation;
    
    if (sharpness > 2.5 && !sustained) { // Lowered threshold from 3
      pattern = 'sharp_spike';
      reactiveScore = 0.85; // Increased from 0.8
      explanation = 'Sharp spike followed by quick decay - classic reactive pattern';
    } else if (sustained) {
      pattern = 'sustained';
      reactiveScore = 0.25; // More decisive - decreased from 0.3
      explanation = 'Sustained elevated ADIZ - suggests planned exercise/operation';
    } else {
      pattern = 'gradual';
      reactiveScore = 0.5; // Ambiguous
      explanation = 'Gradual buildup pattern - ambiguous signal';
    }
    
    return {
      pattern,
      sharpness,
      sustained,
      reactiveScore,
      explanation
    };
  },
  
  /**
   * Calculate overall classification from signals
   */
  calculateClassification(signals) {
    // Weight the signals - temporal is MOST important
    const weights = {
      temporal: 0.40,    // Timing is CRITICAL - increased from 30%
      buildup: 0.30,     // Pre-event trend is key - increased from 25%
      magnitude: 0.15,   // Size matters but less - decreased from 20%
      symbolic: 0.10,    // Symbolic dates - decreased from 15%
      pattern: 0.05      // Pattern shape - decreased from 10%
    };
    
    // Calculate weighted reactive score
    let totalScore = 0;
    let totalWeight = 0;
    
    Object.keys(signals).forEach(key => {
      if (signals[key].reactiveScore !== null && signals[key].reactiveScore !== undefined) {
        totalScore += signals[key].reactiveScore * weights[key];
        totalWeight += weights[key];
      }
    });
    
    const reactiveScore = totalScore / totalWeight;
    
    // Classify with tighter thresholds
    let verdict, confidence;
    
    if (reactiveScore >= 0.65) { // Lowered from 0.7
      verdict = 'reactive';
      confidence = reactiveScore >= 0.8 ? 'high' : 'medium';
    } else if (reactiveScore <= 0.35) { // Raised from 0.3
      verdict = 'pre-planned';
      confidence = reactiveScore <= 0.2 ? 'high' : 'medium';
    } else {
      verdict = 'mixed';
      confidence = 'low';
    }
    
    return {
      verdict,
      confidence,
      reactiveScore,
      prePlannedScore: 1 - reactiveScore,
      summary: this.generateSummary(verdict, confidence, reactiveScore, signals)
    };
  },
  
  /**
   * Generate human-readable summary
   */
  generateSummary(verdict, confidence, reactiveScore, signals) {
    const percentage = (reactiveScore * 100).toFixed(0);
    
    let summary = `Classification: ${verdict.toUpperCase()} (${confidence} confidence)\n\n`;
    summary += `Reactive probability: ${percentage}%\n`;
    summary += `Pre-planned probability: ${(100 - percentage)}%\n\n`;
    
    summary += 'Key Evidence:\n';
    
    // List supporting signals
    if (signals.temporal.reactiveScore > 0.6) {
      summary += `✓ ${signals.temporal.explanation}\n`;
    } else if (signals.temporal.reactiveScore < 0.4) {
      summary += `✗ ${signals.temporal.explanation}\n`;
    }
    
    if (signals.buildup.reactiveScore > 0.6) {
      summary += `✓ ${signals.buildup.explanation}\n`;
    } else if (signals.buildup.reactiveScore < 0.4) {
      summary += `✗ ${signals.buildup.explanation}\n`;
    }
    
    if (signals.magnitude.reactiveScore !== 0.5) {
      if (signals.magnitude.reactiveScore > 0.6) {
        summary += `✓ ${signals.magnitude.explanation}\n`;
      } else {
        summary += `✗ ${signals.magnitude.explanation}\n`;
      }
    }
    
    if (signals.symbolic.isSymbolic) {
      summary += `✗ ${signals.symbolic.explanation}\n`;
    }
    
    if (signals.pattern.reactiveScore > 0.6) {
      summary += `✓ ${signals.pattern.explanation}\n`;
    } else if (signals.pattern.reactiveScore < 0.4) {
      summary += `✗ ${signals.pattern.explanation}\n`;
    }
    
    return summary;
  },
  
  /**
   * Helper: Calculate trend slope
   */
  calculateTrendSlope(data) {
    const n = data.length;
    const x = data.map((_, i) => i);
    const y = data.map(d => d.adiz_count);
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
  },
  
  /**
   * Helper: Check if ADIZ is sustained
   */
  isSustained(windowData) {
    const postEvent = windowData.filter(d => d.days_from_event > 0 && d.days_from_event <= 7);
    if (postEvent.length < 5) return false;
    
    const values = postEvent.map(d => d.adiz_count);
    const mean = Utils.mean(values);
    const peak = Utils.max(values);
    
    // Sustained if most days are within 80% of peak
    const highDays = values.filter(v => v >= peak * 0.8).length;
    return highDays >= values.length * 0.6;
  },
  
  /**
   * Get data for signal breakdown chart
   */
  getSignalBreakdown() {
    if (!this.currentAnalysis) return null;
    
    const { signals } = this.currentAnalysis;
    
    return {
      labels: ['Timing', 'Pre-Event\nBuildup', 'Magnitude', 'Symbolic\nDate', 'Pattern'],
      reactiveScores: [
        signals.temporal.reactiveScore || 0.5,
        signals.buildup.reactiveScore || 0.5,
        signals.magnitude.reactiveScore || 0.5,
        signals.symbolic.reactiveScore || 0.5,
        signals.pattern.reactiveScore || 0.5
      ]
    };
  },
  
  /**
   * Get pre-event trend data for chart
   */
  getPreEventTrendData() {
    if (!this.currentAnalysis) return null;
    
    const { windowData } = this.currentAnalysis;
    
    // Pre-event data (days -21 to 0)
    const preEvent = windowData.filter(d => d.days_from_event <= 0);
    
    return {
      days: preEvent.map(d => d.days_from_event),
      adiz: preEvent.map(d => d.adiz_count)
    };
  }
};

export default PreplannedReactive;
