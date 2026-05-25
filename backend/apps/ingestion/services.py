"""
IngestionService: orchestrates parse → normalise → classify → flag → save.
"""
from __future__ import annotations
import logging
from decimal import Decimal

from django.db import transaction
from django.db.models import Avg, StdDev, Count

from .models import UploadBatch
from .parsers import SAPParser, UtilityParser, TravelParser
from .normaliser import UnitNormaliser
from .rules import SuspiciousRuleEngine

logger = logging.getLogger(__name__)
normaliser = UnitNormaliser()
rule_engine = SuspiciousRuleEngine()


def _get_parser(source_type: str):
    return {
        "SAP": SAPParser(),
        "UTILITY": UtilityParser(),
        "TRAVEL": TravelParser(),
    }.get(source_type)


def _get_org_stats(organisation_id, source_type: str) -> dict:
    """Compute rolling mean/std of CO2e for anomaly detection."""
    from apps.emissions.models import EmissionRecord
    qs = EmissionRecord.objects.filter(
        organisation_id=organisation_id,
        batch__source_type=source_type,
        normalised_qty_kg_co2e__isnull=False,
    )
    agg = qs.aggregate(
        mean_co2e=Avg("normalised_qty_kg_co2e"),
        std_co2e=StdDev("normalised_qty_kg_co2e"),
        record_count=Count("id"),
    )
    # Build duplicate key set
    existing_keys = set(
        qs.values_list(
            "organisation_id", "source_ref", "period_start", "quantity"
        )
    )
    existing_keys = {
        (str(o), str(s), str(p), f"{float(q):.4f}" if q is not None else "0.0000") for o, s, p, q in existing_keys
    }
    return {
        "mean_co2e": float(agg["mean_co2e"] or 0),
        "std_co2e": float(agg["std_co2e"] or 1),
        "record_count": agg["record_count"] or 0,
        "existing_keys": existing_keys,
    }


@transaction.atomic
def process_batch(batch_id: str) -> UploadBatch:
    """Parse, normalise, classify, flag, and persist records for a batch."""
    from apps.emissions.models import EmissionRecord
    from apps.emissions.classifier import ScopeClassifier
    from apps.audit.utils import log_action_system

    batch = UploadBatch.objects.select_related("organisation", "uploaded_by").get(
        pk=batch_id
    )
    batch.status = UploadBatch.Status.PROCESSING
    batch.save(update_fields=["status", "updated_at"])

    try:
        parser = _get_parser(batch.source_type)
        if parser is None:
            raise ValueError(f"Unknown source type: {batch.source_type}")

        with batch.file.open("rb") as fh:
            raw_rows = parser.parse(fh)
        org_stats = _get_org_stats(batch.organisation_id, batch.source_type)
        classifier = ScopeClassifier()

        batch.total_rows = len(raw_rows)
        processed = 0
        failed = 0
        records_to_create = []

        for row in raw_rows:
            try:
                qty = row.get("quantity")
                raw_unit = row.get("raw_unit", "")
                fuel_type = row.get("fuel_type", "")
                travel_class = row.get("travel_class", "")

                norm = normaliser.normalise(
                    raw_unit=raw_unit,
                    quantity=qty if qty is not None else 0,
                    fuel_type=fuel_type or None,
                    travel_class=travel_class or None,
                )

                row["normalised_qty_kg_co2e"] = norm.normalised_kg_co2e
                row["unit_success"] = norm.success
                row["organisation_id"] = str(batch.organisation_id)

                flags = rule_engine.check(row, org_stats)
                is_suspicious = len(flags) > 0

                scope = classifier.classify(
                    source_type=batch.source_type,
                    category=row.get("category", ""),
                    fuel_type=fuel_type,
                    activity_description=row.get("activity_description", ""),
                )

                records_to_create.append(
                    EmissionRecord(
                        batch=batch,
                        organisation=batch.organisation,
                        activity_description=row.get("activity_description", "")[:500],
                        quantity=Decimal(str(qty)) if qty is not None else Decimal("0"),
                        raw_unit=raw_unit[:50],
                        fuel_type=fuel_type[:100],
                        travel_class=travel_class[:20],
                        plant_code=str(row.get("plant_code", ""))[:50],
                        source_ref=str(row.get("source_ref", ""))[:255],
                        category=str(row.get("category", ""))[:100],
                        period_start=row.get("period_start"),
                        period_end=row.get("period_end"),
                        normalised_qty_kg_co2e=(
                            Decimal(str(round(norm.normalised_kg_co2e, 4)))
                            if norm.success else None
                        ),
                        canonical_unit="kg_CO2e",
                        emission_factor=(
                            Decimal(str(norm.factor_used)) if norm.success else None
                        ),
                        scope=scope,
                        is_suspicious=is_suspicious,
                        suspicious_reasons=flags,
                        review_status=EmissionRecord.ReviewStatus.PENDING,
                    )
                )
                processed += 1
            except Exception as row_err:
                logger.warning("Row failed: %s — %s", row, row_err)
                failed += 1

        EmissionRecord.objects.bulk_create(records_to_create, batch_size=500)

        batch.processed_rows = processed
        batch.failed_rows = failed
        batch.status = UploadBatch.Status.COMPLETED
        batch.error_message = ""
        batch.save(update_fields=["status", "processed_rows", "failed_rows",
                                   "total_rows", "error_message", "updated_at"])

        log_action_system(
            organisation=batch.organisation,
            entity_type="UploadBatch",
            entity_id=str(batch.id),
            action="BATCH_COMPLETED",
            diff={
                "source_type": batch.source_type,
                "total_rows": batch.total_rows,
                "processed_rows": batch.processed_rows,
                "failed_rows": batch.failed_rows,
            },
        )
        return batch

    except Exception as exc:
        logger.exception("Batch %s failed: %s", batch_id, exc)
        batch.status = UploadBatch.Status.FAILED
        batch.error_message = str(exc)[:1000]
        batch.save(update_fields=["status", "error_message", "updated_at"])
        raise
