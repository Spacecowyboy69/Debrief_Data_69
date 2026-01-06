// dataConnector.js - Load and parse DATA from HTML files or direct object

import DataSchema from './schema.js';
import Utils from './utils.js';

const DataConnector = {
  // Currently loaded DATA
  currentData: null,
  baselineMap: null,
  eventIndex: null,
  
  // Load DATA from an HTML file (contains const DATA = {...})
  async loadFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const htmlContent = e.target.result;
          
          // Extract DATA object from HTML
          const dataMatch = htmlContent.match(/const DATA\s*=\s*(\{[\s\S]*?\});/);
          if (!dataMatch) {
            reject(new Error('Could not find DATA object in file'));
            return;
          }
          
          // Parse the DATA object
          const dataStr = dataMatch[1];
          const DATA = new Function('return ' + dataStr)();
          
          // Validate and load
          this.loadFromObject(DATA);
          resolve(DATA);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  },
  
  // Load DATA from a direct JavaScript object
  loadFromObject(DATA) {
    // Validate schema
    const validation = DataSchema.validate(DATA);
    if (!validation.ok) {
      throw new Error('Invalid DATA structure: ' + validation.errors.join(', '));
    }
    
    // Store DATA
    this.currentData = DATA;
    
    // Build baseline map for fast lookups
    this.baselineMap = Utils.createBaselineMap(DATA.adiz_baseline);
    
    // Build normalized event index
    this.eventIndex = this.buildEventIndex(DATA);
    
    return {
      ok: true,
      data: DATA,
      eventCount: this.eventIndex.length
    };
  },
  
  // Build normalized event index from all event datasets
  buildEventIndex(DATA) {
    const events = [];
    
    // Process each event dataset
    Object.keys(DataSchema.events).forEach(dataset_name => {
      const dataset = DATA[dataset_name];
      if (!dataset || !Array.isArray(dataset)) return;
      
      dataset.forEach(raw_event => {
        const normalized = DataSchema.normalizeEvent(dataset_name, raw_event);
        if (normalized && normalized.date) {
          events.push({
            ...normalized,
            dataset: dataset_name
          });
        }
      });
    });
    
    // Sort by date
    events.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return events;
  },
  
  // Get all events (optionally filtered)
  getEvents(filters = {}) {
    if (!this.eventIndex) return [];
    
    let filtered = [...this.eventIndex];
    
    // Filter by category
    if (filters.category && filters.category !== 'all') {
      filtered = filtered.filter(e => e.category === filters.category);
    }
    
    // Filter by date range
    if (filters.startDate) {
      filtered = filtered.filter(e => e.date >= filters.startDate);
    }
    if (filters.endDate) {
      filtered = filtered.filter(e => e.date <= filters.endDate);
    }
    
    // Filter by year
    if (filters.year && filters.year !== 'ALL') {
      filtered = filtered.filter(e => e.date.startsWith(filters.year));
    }
    
    // Filter by dataset
    if (filters.dataset) {
      filtered = filtered.filter(e => e.dataset === filters.dataset);
    }
    
    // Custom filter function
    if (filters.customFilter && typeof filters.customFilter === 'function') {
      filtered = filtered.filter(filters.customFilter);
    }
    
    return filtered;
  },
  
  // Get events within a window of a specific date
  getEventsInWindow(centerDate, windowSize) {
    const dates = Utils.getDateWindow(centerDate, windowSize);
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    
    return this.getEvents({ startDate, endDate });
  },
  
  // Get available categories
  getCategories() {
    if (!this.eventIndex) return [];
    return [...new Set(this.eventIndex.map(e => e.category))];
  },
  
  // Get available years in baseline data
  getAvailableYears() {
    if (!this.currentData) return [];
    const years = new Set();
    this.currentData.adiz_baseline.forEach(entry => {
      years.add(entry.Date.substring(0, 4));
    });
    return ['ALL', ...Array.from(years).sort()];
  },
  
  // Get baseline data for a date range
  getBaselineData(startDate, endDate) {
    if (!this.baselineMap) return [];
    
    const data = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = new Date(start); d <= end; d = Utils.addDays(d, 1)) {
      const dateStr = Utils.formatDate(d);
      data.push({
        date: dateStr,
        adiz_count: Utils.getADIZCount(d, this.baselineMap)
      });
    }
    
    return data;
  },
  
  // Get Taiwan Actions filtered by DIME category
  getTaiwanActions(filters = {}) {
    if (!this.currentData || !this.currentData.taiwan_actions) return [];
    
    let actions = [...this.currentData.taiwan_actions];
    
    // Filter by DIME category
    if (filters.dime_category) {
      if (Array.isArray(filters.dime_category)) {
        actions = actions.filter(a => filters.dime_category.includes(a.dime_category));
      } else {
        actions = actions.filter(a => a.dime_category === filters.dime_category);
      }
    }
    
    // Filter by date range
    if (filters.startDate) {
      actions = actions.filter(a => a.date >= filters.startDate);
    }
    if (filters.endDate) {
      actions = actions.filter(a => a.date <= filters.endDate);
    }
    
    // Filter by year
    if (filters.year && filters.year !== 'ALL') {
      actions = actions.filter(a => a.date.startsWith(filters.year));
    }
    
    return actions;
  },
  
  // Check if data is loaded
  isLoaded() {
    return this.currentData !== null;
  }
};

export default DataConnector;
