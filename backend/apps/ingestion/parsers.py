"""
CSV parsers for SAP, Utility, and Travel (Concur) export files.

Each parser returns a list of standardised row dicts with these keys:
  activity_description, quantity, raw_unit, fuel_type, travel_class,
  period_start, period_end, source_ref, category, plant_code
"""
from __future__ import annotations
import logging
from datetime import date, datetime
from typing import Optional

import pandas as pd

logger = logging.getLogger(__name__)


def _read_csv(filepath: str) -> pd.DataFrame:
    """Read CSV trying utf-8 first, then latin-1."""
    for enc in ("utf-8", "utf-8-sig", "latin-1", "cp1252"):
        try:
            df = pd.read_csv(filepath, encoding=enc)
            df.columns = [str(c).strip() for c in df.columns]
            return df
        except UnicodeDecodeError:
            continue
    raise ValueError(f"Could not decode file: {filepath}")


def _parse_date(value) -> Optional[date]:
    if pd.isna(value) or not value:
        return None
    if isinstance(value, (date, datetime)):
        return value if isinstance(value, date) else value.date()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d.%m.%Y", "%m/%d/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(str(value).strip(), fmt).date()
        except ValueError:
            continue
    return None


def _safe_float(value) -> Optional[float]:
    if pd.isna(value) or value is None:
        return None
    try:
        v = str(value).strip().replace(",", ".")
        if v.lower() in ("nan", "null", "none", ""):
            return None
        return float(v)
    except (ValueError, TypeError):
        return None


def _safe_str(value) -> str:
    if pd.isna(value) or value is None:
        return ""
    v = str(value).strip()
    if v.lower() in ("nan", "null", "none"):
        return ""
    return v


# ────────────────────────────────────────────────────────────────────────────
# SAP Parser
# ────────────────────────────────────────────────────────────────────────────

# Maps possible German/English column names → standardised key
_SAP_COL_MAP = {
    # Plant code
    "werk": "plant_code", "plant": "plant_code", "plant code": "plant_code",
    # Date
    "buchungsdatum": "period_start", "postingdate": "period_start",
    "posting date": "period_start", "datum": "period_start", "date": "period_start",
    # Material / activity description
    "material": "activity_description", "materialdescription": "activity_description",
    "material description": "activity_description", "materialbezeichnung": "activity_description",
    # Quantity
    "menge": "quantity", "quantity": "quantity", "betrag": "quantity", "amount": "quantity",
    # Unit
    "einheit": "raw_unit", "unit": "raw_unit", "mengeneinheit": "raw_unit",
    "base unit": "raw_unit", "basiseinheit": "raw_unit",
    # Fuel type
    "kraftstofftyp": "fuel_type", "fueltype": "fuel_type", "fuel type": "fuel_type",
    "fuel": "fuel_type",
    # Company code / source ref
    "buchungskreis": "source_ref", "companycode": "source_ref",
    "company code": "source_ref", "gesellschaft": "source_ref",
    # Cost element / category
    "kostenart": "category", "costelement": "category",
    "cost element": "category", "kostenstelle": "category",
}


class SAPParser:
    """Parse SAP fuel & procurement CSV exports (German + English headers)."""

    def parse(self, filepath: str) -> list[dict]:
        df = _read_csv(filepath)
        # Normalise column names for mapping
        col_lower = {c.lower().replace(" ", "").replace("_", ""): c for c in df.columns}
        rename_map = {}
        for norm_col, orig_col in col_lower.items():
            # Try exact match and stripped match in _SAP_COL_MAP
            for alias, target in _SAP_COL_MAP.items():
                alias_norm = alias.lower().replace(" ", "").replace("_", "")
                if norm_col == alias_norm and target not in rename_map.values():
                    rename_map[orig_col] = target
                    break
        df = df.rename(columns=rename_map)

        records = []
        for _, row in df.iterrows():
            qty = _safe_float(row.get("quantity"))
            period_start = _parse_date(row.get("period_start"))
            # SAP single-date → period is the full month
            period_end = None
            if period_start:
                import calendar
                last_day = calendar.monthrange(period_start.year, period_start.month)[1]
                period_end = period_start.replace(day=last_day)

            records.append({
                "activity_description": _safe_str(row.get("activity_description")) or "SAP Fuel/Procurement",
                "quantity": qty,
                "raw_unit": _safe_str(row.get("raw_unit")),
                "fuel_type": _safe_str(row.get("fuel_type")),
                "travel_class": "",
                "period_start": period_start,
                "period_end": period_end,
                "source_ref": _safe_str(row.get("source_ref")),
                "category": _safe_str(row.get("category")),
                "plant_code": _safe_str(row.get("plant_code")),
            })
        return records


# ────────────────────────────────────────────────────────────────────────────
# Utility Parser
# ────────────────────────────────────────────────────────────────────────────

_UTILITY_COL_MAP = {
    "accountnumber": "source_ref", "account number": "source_ref",
    "sitename": "activity_description", "site name": "activity_description",
    "sitecode": "plant_code", "site code": "plant_code",
    "meterid": "meter_id", "meter id": "meter_id",
    "billingperiodstart": "period_start", "billing period start": "period_start",
    "billingperiodend": "period_end", "billing period end": "period_end",
    "usage_kwh": "quantity", "usage kwh": "quantity", "kwh": "quantity",
    "tariff": "category",
    "supplierref": "supplier_ref",
}


class UtilityParser:
    """Parse utility electricity CSV exports."""

    def parse(self, filepath: str) -> list[dict]:
        df = _read_csv(filepath)
        col_lower = {c.lower().replace(" ", "").replace("_", ""): c for c in df.columns}
        rename_map = {}
        for norm_col, orig_col in col_lower.items():
            for alias, target in _UTILITY_COL_MAP.items():
                alias_norm = alias.lower().replace(" ", "").replace("_", "")
                if norm_col == alias_norm and target not in rename_map.values():
                    rename_map[orig_col] = target
                    break
        df = df.rename(columns=rename_map)

        records = []
        for _, row in df.iterrows():
            qty = _safe_float(row.get("quantity"))
            raw_unit = "kWh"
            # If quantity looks like MWh scale (very large) keep kWh
            records.append({
                "activity_description": _safe_str(row.get("activity_description")) or "Electricity Usage",
                "quantity": qty,
                "raw_unit": raw_unit,
                "fuel_type": "",
                "travel_class": "",
                "period_start": _parse_date(row.get("period_start")),
                "period_end": _parse_date(row.get("period_end")),
                "source_ref": _safe_str(row.get("source_ref")),
                "category": _safe_str(row.get("category")) or "Electricity",
                "plant_code": _safe_str(row.get("plant_code")),
            })
        return records


# ────────────────────────────────────────────────────────────────────────────
# Travel (Concur) Parser
# ────────────────────────────────────────────────────────────────────────────

_TRAVEL_COL_MAP = {
    "tripid": "trip_id", "trip id": "trip_id",
    "employeeid": "source_ref", "employee id": "source_ref",
    "department": "category",
    "departuredate": "period_start", "departure date": "period_start",
    "returndate": "period_end", "return date": "period_end",
    "origin": "origin", "destination": "destination",
    "travelclass": "travel_class", "travel class": "travel_class", "class": "travel_class",
    "distancekm": "flight_km", "distance km": "flight_km", "distance": "flight_km",
    "hotelnight": "hotel_nights", "hotelnights": "hotel_nights", "hotel nights": "hotel_nights",
    "taxikm": "taxi_km", "taxi km": "taxi_km",
    "expensecategory": "expense_type", "expense category": "expense_type",
    "projectcode": "project_code",
}


class TravelParser:
    """Parse Concur-style corporate travel CSV exports.

    Each row may produce up to 3 emission line items:
      1. flight_km  (if DistanceKM > 0)
      2. hotel_night (if HotelNights > 0)
      3. taxi_km    (if TaxiKM > 0)
    """

    def parse(self, filepath: str) -> list[dict]:
        df = _read_csv(filepath)
        col_lower = {c.lower().replace(" ", "").replace("_", ""): c for c in df.columns}
        rename_map = {}
        for norm_col, orig_col in col_lower.items():
            for alias, target in _TRAVEL_COL_MAP.items():
                alias_norm = alias.lower().replace(" ", "").replace("_", "")
                if norm_col == alias_norm and target not in rename_map.values():
                    rename_map[orig_col] = target
                    break
        df = df.rename(columns=rename_map)

        records = []
        for _, row in df.iterrows():
            period_start = _parse_date(row.get("period_start"))
            period_end = _parse_date(row.get("period_end"))
            source_ref = _safe_str(row.get("source_ref"))
            travel_class = _safe_str(row.get("travel_class")).upper() or "ECONOMY"
            category = _safe_str(row.get("category")) or "Travel"
            origin = _safe_str(row.get("origin"))
            destination = _safe_str(row.get("destination"))
            trip_id = _safe_str(row.get("trip_id"))

            # 1. Flight
            flight_km = _safe_float(row.get("flight_km"))
            if flight_km and flight_km > 0:
                records.append({
                    "activity_description": f"Flight: {origin} → {destination}",
                    "quantity": flight_km,
                    "raw_unit": "flight_km",
                    "fuel_type": "",
                    "travel_class": travel_class,
                    "period_start": period_start,
                    "period_end": period_end,
                    "source_ref": f"{source_ref}-{trip_id}-FLT" if trip_id else source_ref,
                    "category": category,
                    "plant_code": "",
                })

            # 2. Hotel nights
            hotel_nights = _safe_float(row.get("hotel_nights"))
            if hotel_nights and hotel_nights > 0:
                hotel_city = _safe_str(row.get("hotel_city")) or destination
                records.append({
                    "activity_description": f"Hotel: {hotel_city} ({int(hotel_nights)} nights)",
                    "quantity": hotel_nights,
                    "raw_unit": "hotel_night",
                    "fuel_type": "",
                    "travel_class": "",
                    "period_start": period_start,
                    "period_end": period_end,
                    "source_ref": f"{source_ref}-{trip_id}-HTL" if trip_id else source_ref,
                    "category": category,
                    "plant_code": "",
                })

            # 3. Taxi / ground transport
            taxi_km = _safe_float(row.get("taxi_km"))
            if taxi_km and taxi_km > 0:
                records.append({
                    "activity_description": f"Ground transport: {destination}",
                    "quantity": taxi_km,
                    "raw_unit": "taxi_km",
                    "fuel_type": "",
                    "travel_class": "",
                    "period_start": period_start,
                    "period_end": period_end,
                    "source_ref": f"{source_ref}-{trip_id}-TXI" if trip_id else source_ref,
                    "category": category,
                    "plant_code": "",
                })

        return records
