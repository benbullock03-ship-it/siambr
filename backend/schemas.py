"""Pydantic response models for the read-only serving layer."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class MemberSummary(BaseModel):
    id: str
    canonical_name: str
    cymraeg_name: str | None
    party_id: str | None
    constituency_name_en: str
    portrait_url: str | None


class SpeakerContribution(BaseModel):
    id: str
    sequence_number: int
    member: MemberSummary
    party_id_at_date: str | None
    role_title_en: str | None
    role_title_cy: str | None
    spoken_language: str
    verbatim_text_original: str
    verbatim_text_english: str
    video_timestamp_start: int | None
    video_timestamp_end: int | None


class MemberVoteCast(BaseModel):
    member: MemberSummary
    party_id_at_date: str | None
    vote_cast: str


class DivisionResult(BaseModel):
    id: str
    motion_text: str
    votes_for: int
    votes_against: int
    votes_abstain: int
    result: str
    ballots: list[MemberVoteCast]


class PetitionLink(BaseModel):
    id: str
    title_en: str
    signature_count: int
    status: str
    source_url: str


class DossierPlate(BaseModel):
    id: str
    session_id: str
    session_date: str
    item_order: int
    item_type: str
    title_en: str
    title_cy: str
    policy_domain_id: str
    # item_type and policy_domain_id are inferred from the item title; the record carries neither.
    classification_provenance: Literal["PROVENANCE_DERIVED"] = "PROVENANCE_DERIVED"
    senedd_tv_clip_url: str | None
    source_xml_url: str
    contributions: list[SpeakerContribution]
    divisions: list[DivisionResult]
    petitions: list[PetitionLink]


class AgendaItemSummary(BaseModel):
    id: str
    item_order: int
    item_type: str
    title_en: str
    title_cy: str
    policy_domain_id: str
    # item_type and policy_domain_id are inferred from the item title; the record carries neither.
    classification_provenance: Literal["PROVENANCE_DERIVED"] = "PROVENANCE_DERIVED"


class SessionSummary(BaseModel):
    id: str
    session_date: str
    senedd_term: int
    title_en: str
    title_cy: str
    source_xml_url: str
    items: list[AgendaItemSummary]


class PolicyDomain(BaseModel):
    id: str
    name_en: str
    name_cy: str


class MinisterialRole(BaseModel):
    title_en: str
    title_cy: str
    cabinet_level: str | None
    start_date: str
    end_date: str | None


class MemberTenure(BaseModel):
    senedd_term: int
    party_id: str
    is_regional_member: bool
    region_name: str | None
    start_date: str
    end_date: str | None


class MemberProfile(BaseModel):
    id: str
    canonical_name: str
    cymraeg_name: str | None
    honorific: str | None
    portrait_url: str | None
    official_profile_url: str
    current_status: str
    constituency_name_en: str
    constituency_name_cy: str
    tenures: list[MemberTenure]
    roles: list[MinisterialRole]
    contribution_count: int


class PresidingOfficer(BaseModel):
    member_id: str
    office: str
    start_date: str
    end_date: str | None
    provenance: str
    source_url: str


class ParliamentaryTerm(BaseModel):
    term: int
    label_en: str
    label_cy: str
    start_date: str
    end_date: str | None
    seat_count: int
    # Office-holders as curated from senedd.wales announcements; latest first.
    presiding_officers: list[PresidingOfficer] = []


class MemberSpeech(BaseModel):
    id: str
    agenda_item_id: str
    agenda_item_title_en: str
    session_date: str
    spoken_language: str
    verbatim_text_original: str
    verbatim_text_english: str
    video_timestamp_start: int | None


class MemberBallot(BaseModel):
    division_id: str
    agenda_item_id: str
    agenda_item_title_en: str
    session_date: str
    motion_text: str
    result: str
    vote_cast: str


class MemberRecord(BaseModel):
    member: MemberProfile
    speeches: list[MemberSpeech]
    speech_total: int
    ballots: list[MemberBallot]
    ballot_total: int


class PostcodeResolution(BaseModel):
    postcode: str
    constituency_member: MemberSummary | None
    regional_members: list[MemberSummary]


class SearchHit(BaseModel):
    contribution_id: str
    agenda_item_id: str
    agenda_item_title_en: str
    member: MemberSummary
    session_date: str
    snippet: str
    rank: float


class SearchResponse(BaseModel):
    query: str
    took_ms: float
    results: list[SearchHit]
