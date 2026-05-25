"""
Unit Normalisation Registry.

All emission factors sourced from UK DEFRA Greenhouse Gas Reporting:
Conversion Factors 2023.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class NormalisationResult:
    normalised_kg_co2e: float
    canonical_unit: str
    factor_used: float
    success: bool
    error: str = ""


# ---------------------------------------------------------------------------
# Emission factor registry
# key: frozenset of recognised unit aliases  →  value: dict of fuel_type → factor
# ---------------------------------------------------------------------------
_UNIT_FACTORS: list[dict] = [
    # ── Liquid fuels (per litre) ────────────────────────────────────────────
    {
        "aliases": {"l", "ltr", "liter", "litre", "liters", "litres", "lt"},
        "default_factor": 2.68,          # diesel
        "fuel_factors": {
            "diesel": 2.68,
            "dieselkraftstoff": 2.68,
            "petrol": 2.31,
            "benzin": 2.31,
            "lpg": 1.51,
            "flüssiggas": 1.51,
            "fluessiggas": 1.51,
        },
        "description": "Litres of liquid fuel",
    },
    # ── Mass-based fuels (per kg) ────────────────────────────────────────────
    {
        "aliases": {"kg", "kilogram", "kilograms"},
        "default_factor": 2.54,          # LPG default
        "fuel_factors": {
            "lpg": 1.51,
            "flüssiggas": 1.51,
            "fluessiggas": 1.51,
            "coal": 2.42,
            "kohle": 2.42,
            "natural gas": 2.04,
            "erdgas": 2.04,
            "diesel": 3.18,
            "dieselkraftstoff": 3.18,
            "petrol": 3.07,
            "benzin": 3.07,
        },
        "description": "Kilograms of fuel",
    },
    # ── Tonne (per tonne) ───────────────────────────────────────────────────
    {
        "aliases": {"t", "tonne", "tonnes", "metric ton", "metric tons"},
        "default_factor": 2680.0,        # diesel × 1000
        "fuel_factors": {
            "coal": 2420.0,
            "kohle": 2420.0,
            "natural gas": 2040.0,
            "erdgas": 2040.0,
        },
        "description": "Tonnes of fuel",
    },
    # ── Natural gas (per m³) ────────────────────────────────────────────────
    {
        "aliases": {"m3", "m³", "cubic meter", "cubic metres", "nm3"},
        "default_factor": 2.04,
        "fuel_factors": {
            "natural gas": 2.04,
            "erdgas": 2.04,
        },
        "description": "Cubic metres of natural gas",
    },
    # ── Electricity (per kWh) ───────────────────────────────────────────────
    {
        "aliases": {"kwh", "kilowatt-hour", "kilowatt hour", "kw-h"},
        "default_factor": 0.233,         # UK grid avg DEFRA 2023
        "fuel_factors": {},
        "description": "Kilowatt-hours (electricity)",
    },
    # ── Electricity (per MWh) ───────────────────────────────────────────────
    {
        "aliases": {"mwh", "megawatt-hour", "megawatt hour"},
        "default_factor": 233.0,
        "fuel_factors": {},
        "description": "Megawatt-hours (electricity)",
    },
    # ── Flight distance (per km) ────────────────────────────────────────────
    {
        "aliases": {"flight_km", "flight km", "flightkm"},
        "default_factor": 0.255,         # economy class
        "fuel_factors": {},
        "travel_class_factors": {
            "economy": 0.255,
            "business": 0.429,
            "first": 0.612,
        },
        "description": "Kilometres flown",
    },
    # ── Hotel nights ────────────────────────────────────────────────────────
    {
        "aliases": {"hotel_night", "hotel night", "hotel nights", "hotelnight"},
        "default_factor": 31.0,
        "fuel_factors": {},
        "description": "Hotel nights",
    },
    # ── Road taxi / cab (per km) ────────────────────────────────────────────
    {
        "aliases": {"taxi_km", "cab_km", "taxi km", "cab km", "road_km"},
        "default_factor": 0.21,
        "fuel_factors": {},
        "description": "Road kilometres (taxi / cab)",
    },
]


def _build_lookup() -> dict:
    """Build a flat alias → entry dict for O(1) lookups."""
    lookup = {}
    for entry in _UNIT_FACTORS:
        for alias in entry["aliases"]:
            lookup[alias.lower()] = entry
    return lookup


_LOOKUP = _build_lookup()


class UnitNormaliser:
    """Convert raw quantity + unit into kg CO2e."""

    def normalise(
        self,
        raw_unit: str,
        quantity: float,
        fuel_type: Optional[str] = None,
        travel_class: Optional[str] = None,
    ) -> NormalisationResult:
        if quantity is None:
            return NormalisationResult(
                normalised_kg_co2e=0.0,
                canonical_unit="kg_CO2e",
                factor_used=0.0,
                success=False,
                error="Quantity is None",
            )

        unit_key = str(raw_unit).strip().lower()
        entry = _LOOKUP.get(unit_key)

        if entry is None:
            return NormalisationResult(
                normalised_kg_co2e=0.0,
                canonical_unit="kg_CO2e",
                factor_used=0.0,
                success=False,
                error=f"Unknown unit: '{raw_unit}'",
            )

        # Resolve factor
        factor = entry["default_factor"]

        # Check travel-class override first (for flight_km)
        if travel_class and "travel_class_factors" in entry:
            tc = travel_class.strip().lower()
            if tc in entry["travel_class_factors"]:
                factor = entry["travel_class_factors"][tc]

        # Check fuel_type override
        if fuel_type:
            ft = fuel_type.strip().lower()
            if ft in entry.get("fuel_factors", {}):
                factor = entry["fuel_factors"][ft]

        kg_co2e = float(quantity) * factor
        return NormalisationResult(
            normalised_kg_co2e=round(kg_co2e, 4),
            canonical_unit="kg_CO2e",
            factor_used=factor,
            success=True,
        )
