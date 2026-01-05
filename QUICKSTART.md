# Quick Start Guide - ADIZ Analyzer MVP

## Get Started in 3 Steps

### Step 1: Open the Project
1. Download and extract the `adiz-dashboard` folder
2. Open `index.html` in your web browser

### Step 2: Load Data
On the landing page, click:
**"Use Embedded Visualizer Data"**

This will use the data from your existing visualizer (v40).

### Step 3: Analyze Events
1. Click on **"Module 1: Single Event"** card
2. Select an event category (e.g., "arms")
3. Pick a specific event from the dropdown
4. Click **"🔍 Analyze Event"**

## What You'll See

### Event Impact Summary
- Baseline comparison (how ADIZ changed vs normal)
- Maximum spike value and when it occurred
- How long the elevated activity persisted
- Delta and percentage change

### Interactive Chart
- ADIZ count timeline around the event
- Event marker (green vertical line)
- Baseline threshold line (red dashed)
- Hover for exact values

### Confounders List
- Other events that happened in the same window
- Helps identify if multiple events influenced the response

## Example Analysis

Try analyzing the **Pelosi visit (2022-08-02)**:

1. Load data → Use Embedded Data
2. Open Analyzers
3. Select Category: **diplomatic**
4. Find event: **2022-08-02 - House Speaker Nancy Pelosi meets President Tsai...**
5. Window: **±7 days** (default)
6. Baseline: **30 days** (default)
7. Click **Analyze Event**

You should see a massive spike in ADIZ activity immediately following the visit!

## Tips

- **Larger windows** (±14, ±30 days) show longer-term patterns
- **Longer baselines** (60, 90 days) give more stable comparisons
- Check **confounders** - multiple events in the same window make causation harder to determine
- **Time to peak** tells you if response was immediate or delayed

## Understanding the Metrics

### Mean Delta
**Positive** (red) = ADIZ activity increased vs baseline
**Negative** (green) = ADIZ activity decreased vs baseline

### Persistence
Days where ADIZ stayed above "baseline + 1σ" (one standard deviation)
**Higher** = longer-lasting impact

### Time to Peak
How many days after the event until max ADIZ count occurred
**0 days** = immediate response
**3-7 days** = delayed response

## Troubleshooting

**"No data loaded"?**
→ Go back to index.html and load data first

**No events showing?**
→ Make sure you selected a category with events

**Chart not displaying?**
→ Check browser console for errors (F12)

## Next Steps

Once Module 1 is working well, we can build:
- Module 2: Compare all events of one type (e.g., all arms sales)
- Module 3: A/B testing (ships vs arms sales)
- Module 4: Heatmaps showing patterns over time
- And more...

## Need Help?

Check the full README.md for detailed documentation on:
- Data structure requirements
- How to add custom datasets
- Technical architecture
- Extending the system

---

Enjoy analyzing! 🛩️📊
