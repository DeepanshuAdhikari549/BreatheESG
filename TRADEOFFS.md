# Tradeoffs & Future Enhancements Documentation

This document describes the design decisions and tradeoffs made during the development of this prototype, focusing on three features we deliberately did not build and the rationale behind those choices.

---

## 1. Asynchronous Ingestion & Task Queue (Celery/Redis)

### What We Did Instead
We implemented ingestion and parsing synchronously within the Django view request lifecycle. When an analyst uploads a CSV file, `services.process_batch()` runs immediately in the same threat execution.

### Rationale & Tradeoff
- **Development Complexity**: Setting up a broker like Redis or RabbitMQ and configuring Celery requires additional environment variables, workers, and infrastructure.
- **Prototype Scale**: The sample CSV files are small (less than 1,000 rows). Pandas parses and normalises them in under 200ms. Introducing async processing would add unnecessary complexity without providing immediate user benefits.
- **Real-World Recommendation**: For production scaling (handling files with >50,000 rows), we would move this logic to a Celery task, immediately returning a `PROCESSING` status to the client and using a WebSocket or polling endpoint to notify the frontend when processing completes.

---

## 2. Automated OCR & Bill PDF Scraping for Utilities

### What We Did Instead
We designed a clean, structured Utility CSV export parser. Facilities teams can scrape their utility portals (e.g. Urjanet) or export their supplier data to structured CSV/XLSX spreadsheets.

### Rationale & Tradeoff
- **OCR Fragility**: Extracting utility usage from PDF invoices via OCR (using tools like Tesseract or AWS Textract) is highly fragile. Different utility providers layout their PDF bills differently, requiring custom scraping templates for each provider.
- **Data Quality**: CSV exports are already structured and much more reliable for audit purposes compared to OCR, which can misread digits and introduce errors.
- **Real-World Recommendation**: In production, we would integrate with third-party utility data aggregators (like UtilityAPI or Urjanet) to fetch structured billing data directly via APIs, bypassing PDF scraping entirely.

---

## 3. Real-Time Dynamic Currency Conversions for Travel Data

### What We Did Instead
We focused entirely on physical travel activity metrics (e.g., flight kilometers, hotel nights, taxi kilometers) rather than cost-based spend estimation.

### Rationale & Tradeoff
- **Spend-Based Estimations are Inaccurate**: In carbon accounting, calculating emissions based on spend (e.g., "$500 spent on flights") uses high-level, generic emission factors that are far less accurate than distance-based calculations.
- **Integration Overhead**: Real-time currency conversions and spend-based modeling require integration with financial exchange APIs and maintaining exchange rate history.
- **Real-World Recommendation**: Auditing bodies (like the SBTi) strongly prefer distance-based (activity) metrics over spend-based approximations. By prioritizing physical distances, we align with the best practices of ESG audit compliance.
