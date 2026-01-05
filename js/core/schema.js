// schema.js - Dataset contract and column mapping
// This defines the expected structure of DATA and normalizes events

const DataSchema = {
  // Required baseline dataset structure
  baseline: {
    required: ['adiz_baseline'],
    structure: {
      Date: 'YYYY-MM-DD',
      ADIZ_count: 'number or string'
    }
  },
  
  // Event overlay datasets
  events: {
    arms_sales: {
      date_field: 'date',
      category: 'arms',
      required: ['date', 'weapon_sale']
    },
    diplomatic: {
      date_field: 'Date',
      category: 'diplomatic',
      required: ['Date', 'Descriptor']
    },
    bills: {
      date_field: 'Date',
      category: 'bills',
      required: ['Date', 'Bill_ID', 'Milestone']
    },
    ships: {
      date_field: 'Date',
      category: 'ships',
      required: ['Date', 'Country', 'Ship_Type']
    },
    political_symbolic: {
      date_field: 'date',
      category: 'political',
      required: ['date', 'event_name']
    }
  },
  
  // Normalize event to standard structure
  normalizeEvent(dataset_name, raw_event) {
    const config = this.events[dataset_name];
    if (!config) return null;
    
    return {
      date: raw_event[config.date_field],
      category: config.category,
      label: this.getEventLabel(dataset_name, raw_event),
      description: this.getEventDescription(dataset_name, raw_event),
      fields: raw_event // preserve original for filtering
    };
  },
  
  getEventLabel(dataset_name, event) {
    switch(dataset_name) {
      case 'arms_sales':
        return event.weapon_sale?.substring(0, 50) + '...' || 'Arms Sale';
      case 'diplomatic':
        return event.Descriptor?.substring(0, 50) + '...' || 'Diplomatic Event';
      case 'bills':
        return `${event.Bill_ID} - ${event.Milestone}`;
      case 'ships':
        return `${event.Country} - ${event.Ship_Type}`;
      case 'political_symbolic':
        return event.short_label || event.event_name;
      default:
        return 'Unknown Event';
    }
  },
  
  getEventDescription(dataset_name, event) {
    switch(dataset_name) {
      case 'arms_sales':
        return event.weapon_sale || '';
      case 'diplomatic':
        return event.Descriptor || '';
      case 'bills':
        return `${event.Bill_ID}: ${event.Milestone}`;
      case 'ships':
        return event.Label || `${event.Country} ${event.Ship_Type}`;
      case 'political_symbolic':
        return event.description || event.event_name || '';
      default:
        return '';
    }
  },
  
  // Validate that DATA has required structure
  validate(DATA) {
    const errors = [];
    
    if (!DATA || typeof DATA !== 'object') {
      errors.push('DATA is not an object');
      return { ok: false, errors };
    }
    
    // Check baseline
    if (!DATA.adiz_baseline || !Array.isArray(DATA.adiz_baseline)) {
      errors.push('Missing or invalid adiz_baseline array');
    }
    
    // Check event datasets (optional but validate if present)
    Object.keys(this.events).forEach(dataset => {
      if (DATA[dataset]) {
        if (!Array.isArray(DATA[dataset])) {
          errors.push(`${dataset} must be an array`);
        }
      }
    });
    
    return {
      ok: errors.length === 0,
      errors
    };
  }
};

export default DataSchema;
