// utils.js - Shared date, windowing, and statistical utilities

const Utils = {
  // Date utilities
  parseDate(dateStr) {
    return new Date(dateStr);
  },
  
  formatDate(date) {
    if (typeof date === 'string') date = new Date(date);
    return date.toISOString().split('T')[0];
  },
  
  daysDiff(date1, date2) {
    const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
    const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
    return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
  },
  
  addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  },
  
  // Create ADIZ baseline map for quick lookups
  createBaselineMap(adiz_baseline) {
    const map = new Map();
    adiz_baseline.forEach(entry => {
      map.set(entry.Date, parseFloat(entry.ADIZ_count) || 0);
    });
    return map;
  },
  
  // Get ADIZ count for a specific date
  getADIZCount(date, baselineMap) {
    const dateStr = typeof date === 'string' ? date : this.formatDate(date);
    return baselineMap.get(dateStr) || 0;
  },
  
  // Get window of dates around an event
  getDateWindow(eventDate, windowSize) {
    const dates = [];
    const start = this.addDays(eventDate, -windowSize);
    const end = this.addDays(eventDate, windowSize);
    
    for (let d = new Date(start); d <= end; d = this.addDays(d, 1)) {
      dates.push(this.formatDate(d));
    }
    
    return dates;
  },
  
  // Extract ADIZ values for a date window
  getWindowData(eventDate, windowSize, baselineMap) {
    const dates = this.getDateWindow(eventDate, windowSize);
    return dates.map(date => ({
      date,
      adiz_count: this.getADIZCount(date, baselineMap),
      days_from_event: this.daysDiff(eventDate, date)
    }));
  },
  
  // Statistical functions
  mean(values) {
    if (!values || values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  },
  
  stdDev(values) {
    if (!values || values.length === 0) return 0;
    const avg = this.mean(values);
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    return Math.sqrt(this.mean(squareDiffs));
  },
  
  max(values) {
    if (!values || values.length === 0) return 0;
    return Math.max(...values);
  },
  
  min(values) {
    if (!values || values.length === 0) return 0;
    return Math.min(...values);
  },
  
  // Calculate baseline statistics for comparison period
  getBaselineStats(eventDate, baselineDays, baselineMap) {
    const baselineEnd = this.addDays(eventDate, -1);
    const baselineStart = this.addDays(baselineEnd, -baselineDays);
    
    const values = [];
    for (let d = new Date(baselineStart); d <= baselineEnd; d = this.addDays(d, 1)) {
      values.push(this.getADIZCount(d, baselineMap));
    }
    
    return {
      mean: this.mean(values),
      stdDev: this.stdDev(values),
      max: this.max(values),
      min: this.min(values),
      count: values.length
    };
  },
  
  // Moving average smoothing
  movingAverage(data, window = 7) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - Math.floor(window / 2));
      const end = Math.min(data.length, i + Math.floor(window / 2) + 1);
      const slice = data.slice(start, end);
      result.push(this.mean(slice));
    }
    return result;
  },
  
  // Filter year range
  filterByYear(dates, year) {
    if (year === 'ALL') return dates;
    return dates.filter(d => d.startsWith(year));
  },
  
  // Get time to peak after event
  getTimeToPeak(windowData) {
    const postEvent = windowData.filter(d => d.days_from_event >= 0);
    if (postEvent.length === 0) return null;
    
    const maxEntry = postEvent.reduce((max, curr) => 
      curr.adiz_count > max.adiz_count ? curr : max
    );
    
    return {
      days: maxEntry.days_from_event,
      value: maxEntry.adiz_count,
      date: maxEntry.date
    };
  },
  
  // Calculate persistence (days above threshold)
  getPersistence(windowData, threshold) {
    return windowData.filter(d => 
      d.days_from_event >= 0 && d.adiz_count > threshold
    ).length;
  }
};

export default Utils;
