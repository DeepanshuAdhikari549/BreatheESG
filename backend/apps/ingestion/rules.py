"""
Suspicious Record Rule Engine.

Each rule returns a dict with:
  rule_id   : str  — machine-readable identifier
  rule_name : str  — human-readable name
  severity  : str  — 'HIGH' | 'MEDIUM' | 'LOW'
  detail    : str  — explanation for analysts
"""
from __future__ import annotations
from datetime import date
from typing import Optional


class SuspiciousRuleEngine:
    """Apply all suspicious-data rules to a single record dict."""

    def check(self, record_data: dict, org_stats: dict) -> list[dict]:
        """
        Parameters
        ----------
        record_data : dict
            Keys: quantity, normalised_qty_kg_co2e, raw_unit, period_start,
                  period_end, source_ref, organisation_id, travel_class,
                  unit_success (bool from normaliser)
        org_stats : dict
            Keys: mean_co2e, std_co2e, record_count, existing_keys (set of
                  (org_id, source_ref, period_start, quantity) tuples)

        Returns
        -------
        list of flag dicts
        """
        flags: list[dict] = []

        qty = record_data.get("quantity")
        co2e = record_data.get("normalised_qty_kg_co2e", 0.0)
        period_start = record_data.get("period_start")
        period_end = record_data.get("period_end")
        unit_success = record_data.get("unit_success", True)
        travel_class = record_data.get("travel_class", "")

        # ── RULE 1: Zero or negative quantity ───────────────────────────────
        if qty is not None and float(qty) <= 0:
            flags.append({
                "rule_id": "ZERO_OR_NEGATIVE",
                "rule_name": "Zero or Negative Quantity",
                "severity": "HIGH",
                "detail": f"Quantity is {qty}, which is zero or negative.",
            })

        # ── RULE 2: Future-dated activity period ─────────────────────────────
        today = date.today()
        if period_end and isinstance(period_end, date) and period_end > today:
            flags.append({
                "rule_id": "FUTURE_DATED",
                "rule_name": "Future-Dated Period",
                "severity": "MEDIUM",
                "detail": f"Period end date {period_end} is in the future.",
            })
        if period_start and isinstance(period_start, date) and period_start > today:
            flags.append({
                "rule_id": "FUTURE_DATED_START",
                "rule_name": "Future-Dated Period Start",
                "severity": "MEDIUM",
                "detail": f"Period start date {period_start} is in the future.",
            })

        # ── RULE 3: Statistical anomaly (>3σ from org mean) ─────────────────
        record_count = org_stats.get("record_count", 0)
        mean_co2e = org_stats.get("mean_co2e", 0.0) or 0.0
        std_co2e = org_stats.get("std_co2e", 1.0) or 1.0
        if record_count >= 10 and co2e:
            threshold = mean_co2e + 3 * std_co2e
            if float(co2e) > threshold:
                flags.append({
                    "rule_id": "EXTREME_VALUE",
                    "rule_name": "Statistically Extreme Value",
                    "severity": "HIGH",
                    "detail": (
                        f"CO2e value {co2e:.2f} kg exceeds 3σ threshold "
                        f"({threshold:.2f} kg) for this organisation."
                    ),
                })

        # ── RULE 4: Unknown unit ─────────────────────────────────────────────
        if not unit_success:
            flags.append({
                "rule_id": "UNKNOWN_UNIT",
                "rule_name": "Unknown or Unmappable Unit",
                "severity": "HIGH",
                "detail": f"Unit '{record_data.get('raw_unit')}' could not be normalised.",
            })

        # ── RULE 5: Duplicate detection ──────────────────────────────────────
        existing_keys = org_stats.get("existing_keys", set())
        qty_val = record_data.get("quantity")
        qty_str = f"{float(qty_val):.4f}" if qty_val is not None else "0.0000"
        dup_key = (
            str(record_data.get("organisation_id", "")),
            str(record_data.get("source_ref", "")),
            str(period_start),
            qty_str,
        )
        if dup_key in existing_keys and record_data.get("source_ref"):
            flags.append({
                "rule_id": "DUPLICATE",
                "rule_name": "Potential Duplicate Record",
                "severity": "MEDIUM",
                "detail": (
                    f"A record with the same source_ref, period_start, and "
                    f"quantity already exists in the database."
                ),
            })

        # ── RULE 6: First-class travel ───────────────────────────────────────
        if travel_class and travel_class.strip().upper() == "FIRST":
            flags.append({
                "rule_id": "FIRST_CLASS_TRAVEL",
                "rule_name": "First-Class Travel Detected",
                "severity": "LOW",
                "detail": "This record includes first-class travel, which requires policy approval.",
            })

        # ── RULE 7: Missing period ────────────────────────────────────────────
        if not period_start or not period_end:
            flags.append({
                "rule_id": "MISSING_PERIOD",
                "rule_name": "Missing Activity Period",
                "severity": "MEDIUM",
                "detail": "Activity period start or end is missing; cannot attribute to reporting year.",
            })

        return flags
