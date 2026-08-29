from typing import Optional

from pydantic import BaseModel, Field


class IncidentSubmit(BaseModel):
    narrative: str = Field(..., min_length=10)
    site: Optional[str] = None
    area: Optional[str] = None
    department: Optional[str] = None


class SemanticSearchRequest(BaseModel):
    query: str
    top_k: int = 10
    source_type: Optional[str] = None
    site: Optional[str] = None
    area: Optional[str] = None


class CopilotRequest(BaseModel):
    query: str = Field(..., min_length=2)


class BulletinRequest(BaseModel):
    scope: str = "daily"
    site: Optional[str] = None


class MemoryRecallRequest(BaseModel):
    narrative: str = Field(..., min_length=10)
    top_k: int = Field(8, ge=1, le=25)


class StructuredQueryRequest(BaseModel):
    query: str = Field(..., min_length=2)
