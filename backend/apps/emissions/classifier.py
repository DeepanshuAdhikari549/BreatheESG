"""
Scope 1 / 2 / 3 classifier using GHG Protocol rules.

Scope 1 — Direct emissions (own combustion / fuel)
Scope 2 — Indirect energy (purchased electricity/heat)
Scope 3 — Value chain (travel, upstream procurement, etc.)
"""


class ScopeClassifier:
    # Keywords that indicate Scope 1 fuel combustion
    _SCOPE1_FUEL_KEYWORDS = {
        "diesel", "dieselkraftstoff", "petrol", "benzin", "lpg", "flüssiggas",
        "fluessiggas", "natural gas", "erdgas", "coal", "kohle", "fuel oil",
        "heizöl", "heizoel", "kerosene", "kerosin",
    }
    # Keywords in activity description suggesting combustion
    _SCOPE1_DESC_KEYWORDS = {
        "combustion", "verbrennung", "boiler", "heizkessel", "furnace",
        "generator", "fleet", "vehicle",
    }
    _SCOPE2_KEYWORDS = {
        "electricity", "elektrizität", "elektrizitaet", "strom", "power",
        "kwh", "mwh", "grid", "utility",
    }
    _SCOPE3_CATEGORIES = {
        "travel", "flight", "hotel", "taxi", "business travel", "procurement",
        "upstream", "supply chain", "waste", "water",
    }

    def classify(
        self,
        source_type: str,
        category: str = "",
        fuel_type: str = "",
        activity_description: str = "",
    ) -> str:
        src = source_type.upper()
        cat = category.lower()
        fuel = fuel_type.lower()
        desc = activity_description.lower()

        # UTILITY → always Scope 2
        if src == "UTILITY":
            return "2"

        # TRAVEL → always Scope 3
        if src == "TRAVEL":
            return "3"

        # SAP: check fuel type for Scope 1
        if src == "SAP":
            if any(k in fuel for k in self._SCOPE1_FUEL_KEYWORDS):
                return "1"
            if any(k in desc for k in self._SCOPE1_DESC_KEYWORDS):
                return "1"
            if any(k in desc for k in self._SCOPE2_KEYWORDS):
                return "2"
            if any(k in cat for k in self._SCOPE3_CATEGORIES):
                return "3"
            # Default SAP to Scope 1 (combustion)
            return "1"

        # Fallback heuristics
        if any(k in fuel for k in self._SCOPE1_FUEL_KEYWORDS):
            return "1"
        if any(k in desc for k in self._SCOPE2_KEYWORDS):
            return "2"
        return "3"
