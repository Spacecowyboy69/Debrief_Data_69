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
      magnitude: this.analyzeMagnitude(event, windowData, baselineStats, this.analyzeTemporalProximity(windowData).days),
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
  analyzeMagnitude(event, windowData, baselineStats, temporalDays = null) {
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
    
    // COMPOUND SCORING: Large spike + close temporal proximity = VERY reactive
    if (ratio > 2.5 && temporalDays !== null && temporalDays <= 3) {
      comparison = 'much_larger_immediate';
      reactiveScore = 0.95; // VERY strong reactive signal
      explanation = `STRONG REACTION: ${ratio.toFixed(1)}x spike within ${temporalDays} days - massive spike in close temporal proximity indicates direct response`;
    } else if (ratio > 2.0 && temporalDays !== null && temporalDays <= 5) {
      comparison = 'large_near_immediate';
      reactiveScore = 0.85; // Strong reactive signal
      explanation = `Strong spike (${ratio.toFixed(1)}x) within ${temporalDays} days - large quantity in close proximity suggests reactive response`;
    } else if (ratio > 2.5) {
      comparison = 'much_larger';
      reactiveScore = 0.7; // Large but timing unclear
      explanation = `Response ${ratio.toFixed(1)}x larger than typical ${event.category} events - unusually strong but timing less clear`;
    } else if (ratio > 1.5) {
      comparison = 'larger';
      reactiveScore = 0.6;
      explanation = `Response ${ratio.toFixed(1)}x larger than typical - moderately strong reaction`;
    } else {
      comparison = 'typical';
      reactiveScore: 0.5;
      explanation = `Response size (${thisPeak}) typical for ${event.category} events (avg: ${avgSimilarPeak.toFixed(1)})`;
    }
    
    return {
      thisPeak,
      avgSimilarPeak,
      ratio,
      temporalDays,
      comparison,
      reactiveScore,
      explanation
    };
  },
  
  /**
   * Signal 4: Symbolic Timing
   * Check proximity to political events from data (not just hardcoded dates)
   */
  analyzeSymbolicTiming(eventDate) {
    const date = new Date(eventDate);
    
    // Get political events from data
    const politicalEvents = DataConnector.getEvents({ category: 'political' }) || [];
    
    if (politicalEvents.length === 0) {
      // Fallback to hardcoded symbolic dates if no political data
      return this.checkHardcodedSymbolicDates(eventDate);
    }
    
    // Check proximity to political events (within 15 days)
    let nearbyEvents = [];
    politicalEvents.forEach(pe => {
      const eventDateObj = new Date(eventDate);
      const politicalDateObj = new Date(pe.date);
      const daysDiff = Math.abs((eventDateObj - politicalDateObj) / (1000*60*60*24));
      
      if (daysDiff <= 15) {
        nearbyEvents.push({
          ...pe,
          daysDiff: Math.round(daysDiff)
        });
      }
    });
    
    if (nearbyEvents.length === 0) {
      return {
        isSymbolic: false,
        reactiveScore: 0.5,
        explanation: 'No significant political events within 15 days'
      };
    }
    
    // Sort by closest
    nearbyEvents.sort((a, b) => a.daysDiff - b.daysDiff);
    const closest = nearbyEvents[0];
    
    // Categorize event type to determine if pre-planned or reactive
    const eventType = (closest.event_type || '').toLowerCase();
    const eventName = (closest.event_name || closest.short_label || '').toLowerCase();
    const combinedText = eventType + ' ' + eventName;
    
    let reactiveScore, explanation, classification;
    
    // MILITARY EXERCISES are usually REACTIVE (result of event, not cause)
    if (combinedText.includes('exercise') || combinedText.includes('drill') || 
        combinedText.includes('maneuver')) {
      reactiveScore = 0.7; // Suggests reactive
      classification = 'reactive_to_exercise';
      explanation = `Within ${closest.daysDiff} days of military exercise "${closest.event_name}" - exercises often follow provocations, suggesting reactive`;
    }
    // ELECTIONS suggest PRE-PLANNED (PRC times actions around Taiwan elections)
    else if (combinedText.includes('election') || combinedText.includes('vote')) {
      reactiveScore = 0.2; // Strongly suggests pre-planned
      classification = 'preplanned_election';
      explanation = `Within ${closest.daysDiff} days of Taiwan election - PRC often pre-plans demonstrations around elections`;
    }
    // PEOPLE'S CONGRESS / CCP MEETINGS suggest PRE-PLANNED
    else if (combinedText.includes('congress') || combinedText.includes('ccp') || 
             combinedText.includes('party')) {
      reactiveScore = 0.25; // Suggests pre-planned
      classification = 'preplanned_congress';
      explanation = `Within ${closest.daysDiff} days of ${closest.event_name} - timing suggests pre-planned messaging`;
    }
    // INAUGURATION / SYMBOLIC DATES suggest PRE-PLANNED
    else if (combinedText.includes('inauguration') || combinedText.includes('10-10') ||
             combinedText.includes('double ten') || combinedText.includes('national day')) {
      reactiveScore = 0.2; // Strongly suggests pre-planned
      classification = 'preplanned_symbolic';
      explanation = `Within ${closest.daysDiff} days of ${closest.event_name} - symbolic date suggests pre-planned`;
    }
    // LUNAR NEW YEAR suggests PRE-PLANNED
    else if (combinedText.includes('lunar') || combinedText.includes('new year') ||
             combinedText.includes('spring festival')) {
      reactiveScore = 0.3; // Suggests pre-planned
      classification = 'preplanned_holiday';
      explanation = `Within ${closest.daysDiff} days of Lunar New Year period - holiday timing suggests pre-planned`;
    }
    // OTHER POLITICAL EVENTS - ambiguous
    else {
      reactiveScore = 0.4;
      classification = 'ambiguous_political';
      explanation = `Within ${closest.daysDiff} days of "${closest.event_name}" - timing relationship unclear`;
    }
    
    return {
      isSymbolic: true,
      nearbyEvents,
      closestEvent: closest,
      classification,
      reactiveScore,
      explanation
    };
  },
  
  /**
   * Fallback: Check hardcoded symbolic dates if no political data available
   */
  checkHardcodedSymbolicDates(eventDate) {
    const date = new Date(eventDate);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    const matchingSymbolic = this.SYMBOLIC_DATES.find(sd => {
      const daysDiff = Math.abs((month * 100 + day) - (sd.month * 100 + sd.day));
      return daysDiff <= 2 || daysDiff >= 98;
    });
    
    if (matchingSymbolic) {
      return {
        isSymbolic: true,
        symbolicDate: matchingSymbolic.name,
        reactiveScore: 0.3,
        explanation: `Within 2 days of ${matchingSymbolic.name} - likely pre-planned`
      };
    }
    
    return {
      isSymbolic: false,
      reactiveScore: 0.5,
      explanation: 'No symbolic timing detected'
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
    
    // Reactive pattern: sharp spike then rapid decay
    // Pre-planned pattern: gradual build, sustained plateau, gradual decay
    
    const preEventMean = Utils.mean(values.slice(0, Math.floor(values.length / 2)));
    const postEventMean = Utils.mean(values.slice(Math.floor(values.length / 2)));
    
    const sharpness = peak / preEventMean;
    
    // Calculate decay rate (how fast it drops after peak)
    // This is KEY indicator of reactive vs planned
    const postPeakValues = values.slice(peakIndex + 1, Math.min(peakIndex + 8, values.length)); // Next 7 days
    const decayRate = postPeakValues.length > 0 
      ? (peak - Utils.mean(postPeakValues)) / peak 
      : 0;
    
    const sustained = this.isSustained(windowData);
    
    let pattern, reactiveScore, explanation;
    
    // SHARP SPIKE + RAPID DECAY = VERY REACTIVE (THE STRONGEST SIGNAL!)
    if (sharpness > 2.5 && decayRate > 0.6 && !sustained) {
      pattern = 'sharp_spike_rapid_decay';
      reactiveScore = 0.95; // VERY strong reactive signal
      explanation = `Sharp spike (${sharpness.toFixed(1)}x) with rapid ${(decayRate*100).toFixed(0)}% decay within 7 days - CLASSIC reactive response pattern`;
    } 
    // SHARP SPIKE + MODERATE DECAY = REACTIVE
    else if (sharpness > 2.5 && decayRate > 0.4 && !sustained) {
      pattern = 'sharp_spike_moderate_decay';
      reactiveScore = 0.85;
      explanation = `Sharp spike (${sharpness.toFixed(1)}x) with ${(decayRate*100).toFixed(0)}% decay - reactive pattern`;
    }
    // SHARP SPIKE + SLOW DECAY = AMBIGUOUS
    else if (sharpness > 2.5 && !sustained) {
      pattern = 'sharp_spike';
      reactiveScore = 0.70;
      explanation = `Sharp spike (${sharpness.toFixed(1)}x) but slower decay (${(decayRate*100).toFixed(0)}%) - ambiguous pattern`;
    } 
    // SUSTAINED ELEVATION = PRE-PLANNED
    else if (sustained) {
      pattern = 'sustained';
      reactiveScore = 0.25;
      explanation = 'Sustained elevated ADIZ activity - suggests planned exercise/operation';
    } 
    // GRADUAL = AMBIGUOUS
    else {
      pattern = 'gradual';
      reactiveScore = 0.5;
      explanation = 'Gradual buildup pattern - ambiguous signal';
    }
    
    return {
      pattern,
      sharpness,
      decayRate,
      sustained,
      reactiveScore,
      explanation
    };
  },
  
  /**
   * Calculate overall classification from signals
   */
  calculateClassification(signals) {
    // Start with base weights
    let weights = {
      temporal: 0.35,    // Timing is critical
      buildup: 0.25,     // Pre-event trend matters
      magnitude: 0.20,   // Size matters
      symbolic: 0.10,    // Context helps
      pattern: 0.10      // Shape provides clues
    };
    
    // DYNAMIC ADJUSTMENT: If sharp spike + rapid decay detected, 
    // increase pattern and magnitude weights (these are KEY reactive indicators)
    if (signals.pattern.pattern === 'sharp_spike_rapid_decay') {
      weights = {
        temporal: 0.30,
        buildup: 0.20,
        magnitude: 0.25,  // Increased - large spike matters more
        symbolic: 0.05,   // Decreased - less relevant with clear pattern
        pattern: 0.20     // DOUBLED - sharp decay is critical indicator
      };
    }
    // If compound magnitude-temporal detected (large spike + close proximity)
    else if (signals.magnitude.comparison === 'much_larger_immediate' || 
             signals.magnitude.comparison === 'large_near_immediate') {
      weights = {
        temporal: 0.30,
        buildup: 0.20,
        magnitude: 0.30,  // INCREASED - compound signal is very strong
        symbolic: 0.10,
        pattern: 0.10
      };
    }
    
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
      weights,  // Include weights so users can see dynamic adjustment
      summary: this.generateSummary(verdict, confidence, reactiveScore, signals, weights)
    };
  },
  
  /**
   * Generate human-readable summary
   */
  generateSummary(verdict, confidence, reactiveScore, signals, weights = {}) {
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
