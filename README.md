# ASOS Explorer (React)

**Live demo:** [asos-explorer.netlify.app](https://asos-explorer.netlify.app/)

Explore U.S. ASOS (Automated Surface Observing Systems) stations on a map and visualize recent historical observations with fast, resilient charts.

---

## Features

- **Interactive map:** Click any station to load its recent history.
- **Smart charts:** Temperature, dewpoint, wind (including derived `wind_speed` from `wind_x`, `wind_y`), pressure, precipitation, and more.
- **Time controls:** Quick ranges (24h / 3d / 7d / all) plus a calendar day picker (`YYYY-MM-DD`).
- **Resilient to messy data:** 
  - Normalizes timestamps  
  - Ignores non-numeric values  
  - Handles gaps / nulls  
  - Sorts out-of-order rows
- **Production-ready:** 
  - Deployed on Netlify with proxy rewrites, SPA fallback, and error boundaries  
  - Honors API rate limit (`20/min`)

---

## Tech Stack

- **UI:** React 18 + Vite  
- **Map:** Leaflet + react-leaflet  
- **Charts:** Chart.js (via react-chartjs-2)  
- **Hosting:** Netlify  
- **API:** [sfc.windbornesystems.com](https://sfc.windbornesystems.com)  

---

## API Endpoints Used
- GET /stations
- GET /historical_weather?station=<station_id>



> ⚠️ **Notes:**  
> - Station responses may vary by field names.  
> - Historical payloads can contain `null`s or mixed types.  

The app’s **normalizer**:
- Detects time keys (`timestamp`, `time`, `datetime`, …) and builds ISO labels  
- Coerces numeric-ish fields  
- Computes `wind_speed = sqrt(wind_x^2 + wind_y^2)` when components exist  
- Sorts records by time; filters by range/day  

---

## Local Development

```bash
# install dependencies
npm install

# run dev server
npm run dev
# open http://localhost:5173

# production build
npm run build
```
