# Architectural & Business Decisions Documentation

This document explains the key ambiguities we resolved, the decisions we made, and why they fit real-world ESG reporting requirements.

---

## 1. SAP Fuel & Procurement Ingestion

### Ambiguities Resolved
- **Export Mode**: SAP exports can be transactional database records, flat files, or OData services. We chose to handle **Standard CSV Flat File Exports** (comparable to AL11 file directory exports or standard report extraction to CSV). In the real world, sustainability teams usually receive these exports from financial controllers.
- **German Column Headers**: SAP configurations often mix German and English schemas (e.g. `Menge` for quantity, `Einheit` for unit, `Werk` for plant). We resolved this by building a translation dictionary (`_SAP_COL_MAP` in `parsers.py`) mapping lowercase, space-stripped variants of both languages to unified internal fields.
- **Period Calculation**: SAP postings are single-date entries (`Buchungsdatum`). Carbon accounting requires duration periods. We decided to map the posting date to a month-long range: the start date is set to the first day of that month, and the end date is computed as the last day of that month.

---

## 2. Utility Electricity Ingestion

### Ambiguities Resolved
- **Billing Period Misalignment**: Utility billing periods rarely match calendar months (e.g., Jan 15 to Feb 14). This creates reporting issues. We chose to store the billing period exactly as defined on the invoice (`period_start` and `period_end`) to maintain the audit trail. For dashboard aggregations, if a record's period crosses months, we attribute it to the month of the `period_start` or fall back to the creation date, ensuring simple and consistent monthly metrics.
- **Measurement Scale**: Large industrial plants report in Megawatt-hours (MWh) while offices report in Kilowatt-hours (kWh). Our registry implements parsing for both `kwh` and `mwh` aliases, scaling the MWh emissions by a factor of 1,000 (`default_factor` = 233.0 kg CO2e/MWh vs 0.233 kg CO2e/kWh) to ensure uniform kg CO2e calculations.

---

## 3. Corporate Travel Ingestion

### Ambiguities Resolved
- **Navan / Concur Line Splits**: A single travel booking row often aggregates a flight, hotel booking, and ground transport (taxi). To capture this accurately, our Travel Parser splits each row into up to 3 individual line items:
  1. Flight item (unit: `flight_km`)
  2. Hotel item (unit: `hotel_night`)
  3. Ground Transport item (unit: `taxi_km`)
  This maps the single raw booking to distinct carbon activity records, each with its own correct emission factor.
- **Flight Category & Class Heuristics**: Distances are mapped to a cabin-class multiplier. If the class is "First", we apply the high-emission factor (0.612 kg CO2e/km); "Business" uses 0.429; and "Economy" uses the baseline 0.255. Additionally, First Class bookings trigger a low-severity flag ("First-Class Travel Detected"), alert notifications on the UI, and require analyst sign-off to ensure corporate policy alignment.

---

## 4. Anomaly Detection & Flagging Rules

### Ambiguities Resolved
- **Negative / Zero Values**: We set a `HIGH` severity flag for quantities `<= 0` (Rule 1). While negative entries can occur as bookkeeping corrections, they must be highlighted and manually reviewed by an analyst before auditing.
- **Statistical Outliers**: An extreme value is flagged if it exceeds the rolling mean of the organisation's previous history by more than 3 standard deviations (Rule 3). To avoid false positives on fresh data, this rule only triggers after the tenant has accumulated at least 10 historical records of that source type.
- **Future Dates**: We check both `period_start` and `period_end` against the current server date. Any future-dated activity triggers a warning flag (Rule 2) because carbon emissions cannot be verified before the activity takes place.
