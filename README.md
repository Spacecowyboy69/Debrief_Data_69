# ADIZ Dashboard & Analyzers - MVP

## 🚀 Quick Start

### Easy Method (Recommended)

**Mac/Linux:**
```bash
./start.sh
```

**Windows:**
```
Double-click start.bat
```

Then open your browser to `http://localhost:8000`

### Manual Method

```bash
cd adiz-dashboard
python3 -m http.server 8000
```

Then open `http://localhost:8000`

**⚠️ Important:** Don't just double-click index.html! You need to run a local server. See `HOW_TO_RUN.md` for details.

---

## Overview
This is a Minimum Viable Product (MVP) for analyzing Taiwan ADIZ (Air Defense Identification Zone) incursions in relation to political, military, and diplomatic events.

The MVP includes:
- **Visualizer**: Your existing v40 dashboard (unchanged)
- **Module 1**: Single Event Analyzer (fully functional)
- **Core Infrastructure**: Data connector, schema validation, and utility functions

## Project Structure

```
/adiz-dashboard/
├── index.html              # Landing page with navigation
├── visualizer.html         # Your existing v40 visualizer
├── analyzers.html          # Module 1: Single Event Analyzer
├── js/
│   ├── core/
│   │   ├── dataConnector.js    # Load & parse DATA from files
│   │   ├── schema.js           # Dataset contract & normalization
│   │   └── utils.js            # Date, windowing, stats utilities
│   └── analyzers/
│       └── singleEvent.js      # Module 1 implementation
├── data/                   # (optional) Store datasets
└── assets/                 # (optional) Additional resources
```

## How to Use

### Quick Start

1. **Open index.html** in a web browser
2. **Load Data**: Choose one of two options:
   - Click "Use Embedded Visualizer Data" (easiest - uses your v40 data)
   - Upload a custom HTML file containing a DATA object
3. **Open Analyzers** and start analyzing events!

### Module 1: Single Event Analyzer

**What it does:**
- Analyzes ADIZ response around a specific event
- Calculates impact metrics (mean delta, max spike, time-to-peak)
- Shows persistence (days above baseline threshold)
- Lists other events in the window (confounders)

**How to use:**
1. Select an event category (arms, diplomatic, bills, ships, political)
2. Pick a specific event from the dropdown
3. Adjust window size (±3, ±7, ±14, or ±30 days)
4. Set baseline comparison period (30, 60, or 90 days)
5. Click "Analyze Event"

**What you'll see:**
- Event impact summary card with key metrics
- Interactive chart showing ADIZ response timeline
- Baseline threshold line (mean + 1σ)
- List of concurrent events (potential confounders)

## Data Contract

Your DATA object should contain:

```javascript
const DATA = {
  adiz_baseline: [
    { Date: "YYYY-MM-DD", ADIZ_count: "number" }
  ],
  arms_sales: [
    { date: "YYYY-MM-DD", weapon_sale: "...", ... }
  ],
  diplomatic: [
    { Date: "YYYY-MM-DD", Descriptor: "...", ... }
  ],
  bills: [
    { Date: "YYYY-MM-DD", Bill_ID: "...", Milestone: "...", ... }
  ],
  ships: [
    { Date: "YYYY-MM-DD", Country: "...", Ship_Type: "...", ... }
  ],
  political_symbolic: [
    { date: "YYYY-MM-DD", event_name: "...", ... }
  ]
};
```

All event datasets are optional, but `adiz_baseline` is required.

## Key Features

### Data Connector (`dataConnector.js`)
- Loads DATA from HTML files or JavaScript objects
- Validates schema automatically
- Builds normalized event index
- Creates ADIZ baseline map for fast lookups

### Event Normalization (`schema.js`)
- Standardizes all events to: `{ date, category, label, description, fields }`
- Preserves original data for filtering
- Handles different date field names across datasets

### Utilities (`utils.js`)
- Date parsing and formatting
- Window extraction (±N days around event)
- Statistical functions (mean, stdDev, max, min)
- Moving average smoothing
- Baseline comparison calculations

### Single Event Analyzer (`singleEvent.js`)
- Window analysis around event
- Baseline comparison metrics
- Impact calculations (delta, %, time-to-peak, persistence)
- Confounder detection

## Metrics Explained

- **Baseline Mean**: Average ADIZ count in the N days before the event
- **Window Mean**: Average ADIZ count in the ±N days around the event
- **Delta**: Difference between window and baseline means
- **Max Spike**: Highest ADIZ count in the post-event window
- **Time to Peak**: Days after event until max spike occurs
- **Persistence**: Number of days above baseline + 1σ threshold
- **Confounders**: Other events occurring in the same time window

## Coming Soon (Modules 2-8)

The full system will include:
- **Module 2**: Event Category Analyzer (average response curves)
- **Module 3**: A/B Compare (compare different event types)
- **Module 4**: Heatmap View (intensity patterns)
- **Module 5**: Rhetoric Model (GDELT integration)
- **Module 6**: AI Analyzer (cultural context & predictions)
- **Module 7**: Predictor (trigger ranking & what-if)
- **Module 8**: Preplanned vs Reactive Classifier

## Technical Notes

### No Server Required
Everything runs client-side in the browser. Perfect for:
- Sending as a zip folder
- Opening locally
- Hosting on static sites
- Offline analysis

### Browser Compatibility
Tested in modern browsers (Chrome, Firefox, Safari, Edge).
Requires ES6 module support.

### Data Storage
- Uses `sessionStorage` to pass data between pages
- No persistent storage (data cleared on browser close)
- Safe for sensitive data

## Extending the System

### Adding a New Analyzer Module

1. Create `/js/analyzers/yourModule.js`
2. Import core utilities:
   ```javascript
   import Utils from '../core/utils.js';
   import DataConnector from '../core/dataConnector.js';
   ```
3. Implement your analysis logic
4. Add UI to `analyzers.html`

### Adding a New Event Type

1. Update `schema.js` to include your event structure
2. Add normalization logic in `normalizeEvent()`
3. Update label/description getters
4. Your events will automatically appear in analyzers!

## Credits

Built following the architecture outlined in "Analyzer_Project_outline.docx"

MVP focuses on Module 1 to establish core infrastructure and demonstrate the analysis pattern for future modules.
