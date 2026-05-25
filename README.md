# BreatheESG Platform

BreatheESG is a simple ESG data ingestion and carbon tracking platform built using Django REST Framework and React. The platform helps organisations upload, review, normalize, and audit ESG emission data from multiple enterprise sources.
---
# Live Links

## Frontend
https://breathe-esg-snowy-rho.vercel.app/

## Backend API
https://breatheesg-khy4.onrender.com

## GitHub Repository
https://github.com/DeepanshuAdhikari549/BreatheESG

---

# Assessment Details

This project was developed for the **Breathe ESG Tech Intern Assignment**. The objective was to build a realistic ESG data management platform capable of:

- Ingesting data from enterprise sources
- Normalizing inconsistent ESG records
- Categorizing emissions into Scope 1, 2, and 3
- Supporting analyst review workflows
- Maintaining audit-ready logs

Data sources included:
- SAP fuel & procurement data
- Utility electricity data
- Corporate travel data

---

# Features

- ESG Dashboard
- CSV Upload System
- Scope 1/2/3 Tracking
- Analyst Review Workflow
- Audit Logs
- Multi-Tenant Support
- Role-Based Authentication
- Anomaly Detection

---

# Tech Stack

## Frontend
- React
- Vite
- Tailwind CSS
- Axios

## Backend
- Django
- Django REST Framework
- JWT Authentication

## Database
- SQLite / PostgreSQL

## Deployment
- Vercel
- Render

---

# Demo Credentials

| Username | Password |
|----------|----------|
| admin | password123 |
| analyst | password123 |
| viewer | password123 |

Organisation Slug:

```text
breathe-esg
```

---

# Installation

## Backend Setup

```bash
cd backend

pip install -r requirements.txt

python manage.py migrate

python seed.py

python manage.py runserver
```

Backend:
http://localhost:8000

---

## Frontend Setup

```bash
cd frontend

npm install

npm run dev
```

Frontend:
http://localhost:5173

---

# API Endpoints

| Method | Endpoint |
|--------|-----------|
| POST | /api/auth/login/ |
| GET | /api/dashboard/ |
| POST | /api/uploads/ |
| GET | /api/records/ |
| GET | /api/audit-logs/ |

---

# Project Structure

```bash
BreatheESG/
│
├── frontend/
├── backend/
├── DECISIONS.md
├── MODEL.md
├── SOURCES.md
└── TRADEOFFS.md
```

---

# Deliverables

- MODEL.md
- DECISIONS.md
- TRADEOFFS.md
- SOURCES.md

---

# License

This project was built for technical assessment and educational purposes.
