"""Predictive risk ML model abstraction (scikit-learn only).

The model is a ``RandomForestClassifier`` with a deterministic random state.
It is trained on time-based samples (see ``training_data``) and persisted as a
Joblib artifact next to a JSON metadata file under ``model_artifacts/``.
Artifacts are never stored in MongoDB and are excluded from the repository.

All functions respect ``risk_config.ARTIFACT_DIR`` at call time so tests can
redirect storage without touching the real model.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

from joblib import dump, load  # type: ignore[import-not-found]
from motor.motor_asyncio import AsyncIOMotorDatabase
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score

from ...schemas.predictive_risk import ModelInfo, TrainingResult
from . import risk_config
from .feature_builder import feature_names
from .training_data import (
    build_training_dataset,
    estimate_training_viability,
    latest_period_features,
)


def _model_path() -> Path:
    return risk_config.ARTIFACT_DIR / risk_config.MODEL_ARTIFACT_FILE


def _metadata_path() -> Path:
    return risk_config.ARTIFACT_DIR / risk_config.MODEL_METADATA_FILE


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def is_model_available() -> bool:
    return _model_path().exists()


def _read_metadata() -> dict | None:
    path = _metadata_path()
    if not path.exists():
        return None
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


_model_cache: tuple[Path, int, int, tuple[object, dict]] | None = None


async def train_model(db: AsyncIOMotorDatabase) -> TrainingResult:
    """Train (or retrain) the predictive risk model from real records.

    Returns a structured ``TrainingResult``. When the underlying dataset is
    too small or lacks class diversity the result reports ``trained=False``
    with a human-readable reason instead of raising.
    """
    X, y, meta = await build_training_dataset(db)
    viable, row_count, reason = await estimate_training_viability(X=X, y=y)
    if not viable:
        return TrainingResult(
            trained=False,
            status=reason,
            message=reason,
        )
    total = len(X)

    # Chronological train/test split: earlier months train, later months test.
    test_size = max(1, int(round(total * risk_config.TEST_RATIO)))
    test_index = total - test_size
    X_train, X_test = X[:test_index], X[test_index:]
    y_train, y_test = y[:test_index], y[test_index:]

    model = RandomForestClassifier(
        n_estimators=100,
        random_state=risk_config.RANDOM_STATE,
    )
    model.fit(X_train, y_train)

    predictions = model.predict(X_test)
    evaluation_metrics = {
        "accuracy": round(accuracy_score(y_test, predictions), 4),
        "precision": round(
            precision_score(y_test, predictions, zero_division=0), 4
        ),
        "recall": round(recall_score(y_test, predictions, zero_division=0), 4),
        "f1_score": round(f1_score(y_test, predictions, zero_division=0), 4),
        "test_samples": len(y_test),
        "training_samples": len(y_train),
    }

    metadata = {
        "model_type": risk_config.MODEL_TYPE,
        "training_date": _now(),
        "training_records": total,
        "features": feature_names(),
        "evaluation_metrics": evaluation_metrics,
        "model_version": risk_config.MODEL_VERSION,
    }

    art_dir = risk_config.ARTIFACT_DIR
    art_dir.mkdir(parents=True, exist_ok=True)
    dump(model, _model_path())
    with _metadata_path().open("w", encoding="utf-8") as handle:
        json.dump(metadata, handle, indent=2)
    _invalidated_load_cache()

    return TrainingResult(
        trained=True,
        status="Model trained successfully.",
        message="Model trained successfully.",
        model_type=metadata["model_type"],
        training_records=total,
        evaluation_metrics=evaluation_metrics,
        model_version=metadata["model_version"],
        timestamp=metadata["training_date"],
    )


def _invalidated_load_cache() -> None:
    """Drop the in-memory model cache (after train or artifact changes)."""
    global _model_cache
    _model_cache = None


def load_model() -> tuple[object, dict] | None:
    """Return ``(model, metadata)`` or ``None`` when no model is available.

    The model artifact is loaded once and cached in memory; the cache is
    keyed by artifact file mtimes so retrains, artifact removals, and test
    directory redirection are always honored.
    """
    global _model_cache
    if not is_model_available():
        _model_cache = None
        return None
    model_path = _model_path()
    metadata_path = _metadata_path()
    try:
        model_stamp = model_path.stat().st_mtime_ns
        metadata_stamp = metadata_path.stat().st_mtime_ns
    except OSError:
        _model_cache = None
        return None
    if (
        _model_cache is not None
        and _model_cache[0] == model_path
        and _model_cache[1] == model_stamp
        and _model_cache[2] == metadata_stamp
    ):
        return _model_cache[3]
    metadata = _read_metadata() or {}
    loaded: tuple[object, dict] = (load(model_path), metadata)
    _model_cache = (model_path, model_stamp, metadata_stamp, loaded)
    return loaded


def get_model_info() -> ModelInfo:
    """Public model information; never exposes internal filesystem paths."""
    if not is_model_available():
        return ModelInfo(available=False)
    metadata = _read_metadata() or {}
    training_date = metadata.get("training_date")
    return ModelInfo(
        available=True,
        model_type=metadata.get("model_type"),
        training_date=training_date,
        training_records=metadata.get("training_records"),
        features=metadata.get("features"),
        evaluation_metrics=metadata.get("evaluation_metrics"),
        model_version=metadata.get("model_version"),
    )


async def predict_ml(db: AsyncIOMotorDatabase, vendor_id: int) -> float | None:
    """Predictive risk score (0-100) for ``vendor_id`` from the trained model.

    Returns ``None`` when no model exists or the vendor has no month with
    sufficient recorded data (the caller must never claim ML in that case).
    The prediction uses the latest qualifying observation window, matching the
    feature distribution the model was trained on.
    """
    loaded = load_model()
    if loaded is None:
        return None
    model, metadata = loaded

    features = await latest_period_features(db, vendor_id)
    if features is None:
        return None

    trained_features = metadata.get("features") or []
    if not trained_features:
        return None
    row = [
        float(features.get(name, 0.0))
        for name in trained_features
    ]
    probabilities = model.predict_proba([row])  # type: ignore[attr-defined]
    if probabilities.shape[1] < 2:
        return None
    risk_score = float(probabilities[0][1]) * 100.0
    return round(risk_score, 2)


def clear_artifacts() -> None:
    """Remove local model artifacts (used by tests to restore a clean state)."""
    _invalidated_load_cache()
    for path in (_model_path(), _metadata_path()):
        if path.exists():
            path.unlink()