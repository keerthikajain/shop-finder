from datetime import datetime
from typing import Literal, Annotated
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
Category = Literal['washing_machine','refrigerator','fan','mixer_grinder','electric_iron','water_purifier']

class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid')

class Evidence(StrictModel):
    field: Text
    source: Text
    checked_by: Text
    checked_at: datetime

class Verification(StrictModel):
    status: Literal['unverified','verified','needs_review'] = 'unverified'
    verified_by: Text | None = None
    verified_at: datetime | None = None
    evidence: list[Evidence] = Field(default_factory=list)

class Location(StrictModel):
    rack: Text
    shelf: Text
    box: Text

class Compatibility(StrictModel):
    manufacturer: Text
    model: Text
    evidence: Evidence

class Product(StrictModel):
    id: Annotated[str, StringConstraints(pattern=r'^[A-Za-z0-9-]{1,40}$')]
    shop_id: Text
    name: Text
    aliases: list[Text] = Field(default_factory=list, max_length=20)
    appliance_category: Category
    manufacturer: Text | None = None
    model: Text | None = None
    part_number: Text | None = None
    part_number_kind: Literal['synthetic','manufacturer','unknown'] = 'unknown'
    specifications: dict[str, str | int | float] = Field(default_factory=dict)
    dimensions: dict[str, str | int | float] = Field(default_factory=dict)
    connector_type: Text | None = None
    compatibility: list[Compatibility] = Field(default_factory=list)
    location: Location
    photo_url: str | None = None
    is_synthetic: bool
    verification: Verification
    provenance: Text
    created_at: datetime
    updated_at: datetime

    @model_validator(mode='after')
    def enforce_provenance(self):
        if self.created_at.tzinfo is None or self.updated_at.tzinfo is None:
            raise ValueError('Timestamps require a timezone')
        if self.updated_at < self.created_at:
            raise ValueError('updated_at must not precede created_at')
        if self.is_synthetic:
            if self.verification.status == 'verified' or self.verification.evidence or self.compatibility:
                raise ValueError('Synthetic records cannot carry verification or compatibility claims')
            if self.manufacturer or self.model or self.part_number_kind != 'synthetic':
                raise ValueError('Demo records must not imply manufacturer identifiers')
        if self.verification.status == 'verified':
            v = self.verification
            if not v.verified_by or not v.verified_at:
                raise ValueError('Staff identity and verification date required')
            required = {'name', 'location'}
            required.update('specifications.' + k for k in self.specifications)
            required.update('dimensions.' + k for k in self.dimensions)
            required.update(k for k in ('manufacturer','model','part_number','connector_type') if getattr(self,k))
            if not required.issubset({e.field for e in v.evidence}):
                raise ValueError('Every populated identity, location and technical field needs evidence')
        return self
