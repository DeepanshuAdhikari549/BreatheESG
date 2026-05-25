# Source Channel Research & Sample Data Details

This document outlines the real-world research behind our three data sources (SAP, Utility, Travel), the format of the sample data generated under `backend/sample_data/`, and what would break in a production deployment.

---

## 1. SAP Fuel & Procurement Data

### Real-World Format Research
- **Structure**: SAP stores financial and material transactions in relational tables (like `BKPF` for headers and `BSEG` for line items). Procurement data is often exported as flat CSV files from transaction codes like `MB51` (Material Documents) or `FBL3N` (G/L Account Line Items).
- **Edge Cases**:
  - Multi-language configurations (often German and English mixed).
  - European decimal formatting (e.g. `1.500,50` instead of `1500.50`).
  - Dates formatted as `DD.MM.YYYY` rather than `YYYY-MM-DD`.

### Our Sample Data (`sample_data/sap_raw_export.csv`)
- **Headers**: German headers like `Buchungsdatum`, `Materialbezeichnung`, `Menge`, `Einheit`, `Kraftstofftyp`, `Werk`.
- **Decimals**: Quantities are formatted with German commas (e.g., `"1500,50"`).
- **Outliers & Exceptions**: The last row contains a posting date of `15.06.2026`, which triggers a `FUTURE_DATED` flag because it is set in the future relative to the current date of May 25, 2026.

### What Would Break in Production
- **Custom Units**: In real SAP deployments, custom unit keys like `Z01` or client-specific abbreviations are common. Our parser would flag these as `UNKNOWN_UNIT` until mapped in `normaliser.py`.
- **Large Exports**: Large corporate exports can easily exceed 500,000 rows, which would cause the request to time out when processed synchronously.

---

## 2. Utility Electricity Data

### Real-World Format Research
- **Structure**: Facilities teams typically scrape utility billing portals or receive consolidated CSV files from utility providers (like PG&E, Vattenfall, or E.ON). These files contain account numbers, meter IDs, billing periods, and electricity usage in kilowatt-hours (kWh).
- **Edge Cases**:
  - Negative values (credits or solar export feedback).
  - Billing periods that cross calendar months.

### Our Sample Data (`sample_data/utility_electricity_export.csv`)
- **Headers**: Standard English portal headers like `Account Number`, `Site Name`, `Billing Period Start`, `Billing Period End`, `Usage kWh`, `Tariff`.
- **Outliers & Exceptions**: The last row contains a usage of `-500.00` kWh, representing a credit. This triggers the `ZERO_OR_NEGATIVE` validation flag to alert analysts.

### What Would Break in Production
- **Missing Periods**: Utility bills sometimes miss dates or contain empty columns due to parsing errors, triggering the `MISSING_PERIOD` flag.
- **Estimated Readings**: Utility providers often estimate usage for billing periods, requiring a separate flag to differentiate estimated readings from actual meter readings.

---

## 3. Corporate Travel Data

### Real-World Format Research
- **Structure**: Travel management platforms (like Concur or Navan) provide comprehensive CSV reports detailing booking details, hotel nights, flights, and taxi rides.
- **Edge Cases**:
  - Distance metrics are not always populated; developers must often estimate distances using airport codes (origin/destination) and the Haversine formula.
  - Multi-segment flights.

### Our Sample Data (`sample_data/corporate_travel_export.csv`)
- **Headers**: Standard travel portal headers like `Trip ID`, `Employee ID`, `Department`, `Departure Date`, `Return Date`, `Origin`, `Destination`, `Travel Class`, `Distance KM`, `Hotel Nights`, `Taxi KM`.
- **Outliers & Exceptions**:
  - Rows with `Travel Class` = "First" trigger a low-severity flag ("First-Class Travel Detected") because first-class flights have significantly higher emissions than economy class.
  - Row 4 contains zero values for all quantities to test how the system handles empty bookings.

### What Would Break in Production
- **Airport Code Resolutions**: In production, flights without distance data would fail to compute. We would need to integrate with an airport location database (like OpenFlights) to calculate flight distances dynamically.
