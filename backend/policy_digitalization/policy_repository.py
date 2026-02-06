"""Policy Repository — stores and retrieves digitized policies from PolicyCacheModel."""

import json
import hashlib
from datetime import datetime
from typing import Optional, List
from uuid import uuid4

from backend.models.policy_schema import DigitizedPolicy
from backend.storage.database import get_db
from backend.storage.models import PolicyCacheModel
from backend.policy_digitalization.exceptions import PolicyNotFoundError
from backend.config.logging_config import get_logger

logger = get_logger(__name__)


class PolicyVersionInfo:
    """Lightweight version info for listing."""
    def __init__(self, version: str, cached_at: str, content_hash: str):
        self.version = version
        self.cached_at = cached_at
        self.content_hash = content_hash


class PolicyRepository:
    """Async repository for digitized policies — populates PolicyCacheModel.parsed_criteria."""

    async def store(self, policy: DigitizedPolicy) -> str:
        """Store a digitized policy, populating parsed_criteria."""
        from sqlalchemy import select

        policy_dict = policy.model_dump(mode="json")
        content_hash = hashlib.sha256(
            json.dumps(policy_dict, sort_keys=True, default=str).encode()
        ).hexdigest()[:16]

        payer = policy.payer_name.lower().replace(" ", "_")
        medication = policy.medication_name.lower().replace(" ", "_")
        version = policy.version or "latest"

        async with get_db() as session:
            # Check for existing entry
            stmt = select(PolicyCacheModel).where(
                PolicyCacheModel.payer_name == payer,
                PolicyCacheModel.medication_name == medication,
                PolicyCacheModel.policy_version == version,
            )
            result = await session.execute(stmt)
            existing = result.scalar_one_or_none()

            if existing:
                existing.parsed_criteria = policy_dict
                existing.content_hash = content_hash
                existing.cached_at = datetime.utcnow()
                cache_id = existing.id
            else:
                cache_id = str(uuid4())
                entry = PolicyCacheModel(
                    id=cache_id,
                    payer_name=payer,
                    medication_name=medication,
                    policy_version=version,
                    content_hash=content_hash,
                    policy_text=json.dumps(policy_dict, default=str),
                    parsed_criteria=policy_dict,
                )
                session.add(entry)
            # get_db() auto-commits on success

        logger.info("Policy stored", payer=payer, medication=medication, version=version)
        return cache_id

    async def load(
        self, payer_name: str, medication_name: str, version: str = "latest"
    ) -> Optional[DigitizedPolicy]:
        """Load a digitized policy from cache."""
        from sqlalchemy import select

        payer = payer_name.lower().replace(" ", "_")
        medication = medication_name.lower().replace(" ", "_")

        async with get_db() as session:
            stmt = select(PolicyCacheModel).where(
                PolicyCacheModel.payer_name == payer,
                PolicyCacheModel.medication_name == medication,
                PolicyCacheModel.policy_version == version,
            )
            result = await session.execute(stmt)
            entry = result.scalar_one_or_none()

            if not entry or not entry.parsed_criteria:
                return None

            try:
                return DigitizedPolicy(**entry.parsed_criteria)
            except Exception as e:
                logger.warning(
                    "Corrupted cached policy, treating as cache miss",
                    payer=payer, medication=medication, error=str(e)
                )
                return None

    async def invalidate(self, payer_name: str, medication_name: str) -> bool:
        """Invalidate cached policy."""
        from sqlalchemy import delete

        payer = payer_name.lower().replace(" ", "_")
        medication = medication_name.lower().replace(" ", "_")

        async with get_db() as session:
            stmt = delete(PolicyCacheModel).where(
                PolicyCacheModel.payer_name == payer,
                PolicyCacheModel.medication_name == medication,
            )
            result = await session.execute(stmt)
            deleted = result.rowcount > 0

        logger.info("Policy cache invalidated", payer=payer, medication=medication, deleted=deleted)
        return deleted

    async def store_version(self, policy: DigitizedPolicy, version_label: str) -> str:
        """Store a specific version of a digitized policy."""
        policy.version = version_label
        return await self.store(policy)

    async def list_versions(self, payer: str, medication: str) -> List[PolicyVersionInfo]:
        """List all stored versions for a payer/medication."""
        from sqlalchemy import select

        payer_key = payer.lower().replace(" ", "_")
        med_key = medication.lower().replace(" ", "_")

        async with get_db() as session:
            stmt = select(PolicyCacheModel).where(
                PolicyCacheModel.payer_name == payer_key,
                PolicyCacheModel.medication_name == med_key,
            ).order_by(PolicyCacheModel.cached_at.desc())
            result = await session.execute(stmt)
            entries = result.scalars().all()

            return [
                PolicyVersionInfo(
                    version=e.policy_version or "latest",
                    cached_at=e.cached_at.isoformat() if e.cached_at else "",
                    content_hash=e.content_hash,
                )
                for e in entries
            ]

    async def load_version(
        self, payer: str, medication: str, version: str
    ) -> Optional[DigitizedPolicy]:
        """Load a specific version."""
        return await self.load(payer, medication, version)


# Global instance
_policy_repository: Optional[PolicyRepository] = None


def get_policy_repository() -> PolicyRepository:
    """Get or create global PolicyRepository."""
    global _policy_repository
    if _policy_repository is None:
        _policy_repository = PolicyRepository()
    return _policy_repository
