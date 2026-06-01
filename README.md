# Vertigation ML — Web Monitor

Public-facing monitoring dashboard for the Vertigation ML thesis project.
Built with React + Vite, powered by the Blynk HTTP API.

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Edit `.env` with your values:
```
VITE_BLYNK_TOKEN=your_blynk_token_here
VITE_BLYNK_BASE=https://blynk.cloud/external/api
VITE_LOGIN_USER=admin
VITE_LOGIN_PASS=vertigation2024
```

### 3. Run locally
```bash
npm run dev
# Opens at http://localhost:5173
```

---

## Deploy to Vercel (make it public)

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Follow the prompts (press Enter for all defaults)
```

After first deploy, add your environment variables:
1. Go to https://vercel.com → your project → Settings → Environment Variables
2. Add all 4 variables from your `.env` file
3. Redeploy: `vercel --prod`

Your site will be live at: `https://vertigation-web.vercel.app`

---

## Project Structure

```
src/
├── App.jsx                    # Root — handles login vs dashboard routing
├── main.jsx                   # React entry point
├── index.css                  # Global styles & CSS variables
├── hooks/
│   ├── useAuth.jsx            # Login state (sessionStorage)
│   └── useSensorData.js       # Blynk API polling every 2s
├── pages/
│   ├── LoginPage.jsx          # Login screen
│   └── DashboardPage.jsx      # Main dashboard layout
└── components/
    ├── Navbar.jsx             # Top bar with status & logout
    ├── EnvMetrics.jsx         # Temp, humidity, lux, tank cards
    ├── TierMoisture.jsx       # 3-tier soil moisture bars + valve states
    ├── SystemStatus.jsx       # Pump & valve status grid
    └── TrendChart.jsx         # Recharts live moisture line chart
```

---

## Blynk Virtual Pins Used

| Pin  | Data               |
|------|--------------------|
| V0   | Tier 1 moisture %  |
| V1   | Temperature (°C)   |
| V2   | Humidity (%)       |
| V3   | Tier 2 moisture %  |
| V4   | Tier 3 moisture %  |
| V5   | Light (lux)        |
| V6   | Tank (1=OK, 0=empty) |
| V7   | Pump state         |

## Soil Sensor Setup

This dashboard is set up for 3 soil moisture readings total, one representative sensor per tier.

- Tier 1 sensor -> V0
- Tier 2 sensor -> V3
- Tier 3 sensor -> V4

If you later decide to use 2 sensors per tier, you can still keep the dashboard at 3 tier values by averaging each pair in the Arduino code before sending to Blynk.

---

## Login Credentials (default)

| Field    | Value           |
|----------|-----------------|
| Username | admin           |
| Password | vertigation2024 |

Change these in `.env` before deploying publicly.

---

## Notes

- The Blynk token is exposed in the frontend bundle. Fine for a thesis, but rotate it after defense.
- For persistent historical data (ML logging), consider upgrading to Option B (Node.js + SQLite backend).
