from app.decision import VoiceJourneyCoordinator, VoiceOutputCoordinator
from app.domain import (
    AttentionState,
    ProximityDecision,
    ProximityReason,
    ProximityState,
    Reason,
    TargetDecision,
    VoiceJourneyState,
    VoiceStage,
)


def proximity(
    *,
    entered: bool = False,
    state: ProximityState = ProximityState.NEAR,
    track_id: int | None = 1,
    episode_id: str | None = "near-1",
) -> ProximityDecision:
    return ProximityDecision(
        state,
        track_id,
        0.2 if track_id is not None else None,
        entered,
        episode_id,
        (
            ProximityReason.NEAR_ENTERED
            if entered
            else ProximityReason.NEAR_HELD
        ),
    )


def attending(track_id: int | None = 1) -> TargetDecision:
    return TargetDecision(
        AttentionState.ATTENDING,
        track_id,
        (0.5, 0.5),
        Reason.ATTENTION_CONFIRMED,
        (track_id,) if track_id is not None else (),
    )


def test_stage_one_starts_one_interaction(config):
    journey = VoiceJourneyCoordinator(config)

    trigger = journey.on_proximity(proximity(entered=True))
    duplicate = journey.on_proximity(proximity())
    snapshot = journey.snapshot(trigger).as_dict()

    assert trigger is not None
    assert trigger.stage == VoiceStage.PROXIMITY_GREETING
    assert duplicate is None
    assert snapshot["state"] == "GREETED"
    assert snapshot["proximity_greeting_triggered"]
    assert snapshot["completed_stages"] == ["PROXIMITY_GREETING"]
    assert "purchase_started_triggered" not in snapshot


def test_followup_fires_at_ten_seconds_not_before(config):
    journey = VoiceJourneyCoordinator(config)
    journey.on_proximity(proximity(entered=True))

    assert journey.on_attention(attending(), proximity(), 1_000) is None
    assert journey.on_attention(attending(), proximity(), 10_999) is None
    trigger = journey.on_attention(attending(), proximity(), 11_000)

    assert trigger is not None
    assert trigger.stage == VoiceStage.ATTENTION_FOLLOW_UP
    assert journey.state == VoiceJourneyState.FOLLOWED_UP
    assert journey.snapshot(trigger).attention_dwell_ms == 10_000


def test_followup_timer_resets_on_target_or_near_break(config):
    journey = VoiceJourneyCoordinator(config)
    journey.on_proximity(proximity(entered=True))
    journey.on_attention(attending(), proximity(), 1_000)
    journey.on_attention(attending(2), proximity(), 10_000)
    assert journey.on_attention(attending(), proximity(), 20_000) is None
    assert (
        journey.on_attention(
            attending(),
            proximity(state=ProximityState.LEAVING),
            30_000,
        )
        is None
    )
    assert journey.on_attention(attending(), proximity(), 45_000) is None
    assert journey.on_attention(attending(), proximity(), 60_000) is not None


def test_cancel_followup_preserves_the_completed_greeting_stage(config):
    journey = VoiceJourneyCoordinator(config)
    trigger = journey.on_proximity(proximity(entered=True))
    assert trigger is not None
    interaction_id = journey.interaction_id

    journey.cancel_followup()
    snapshot = journey.snapshot().as_dict()

    assert journey.state == VoiceJourneyState.FOLLOWED_UP
    assert journey.interaction_id == interaction_id
    assert snapshot["completed_stages"] == ["PROXIMITY_GREETING"]
    assert not snapshot["attention_followup_triggered"]
    assert journey.on_attention(attending(), proximity(), 20_000) is None


def test_new_episode_rearms_after_zone_clear(config):
    journey = VoiceJourneyCoordinator(config)
    first = journey.on_proximity(proximity(entered=True))
    journey.on_proximity(
        proximity(
            state=ProximityState.FAR,
            track_id=None,
            episode_id=None,
        )
    )
    second = journey.on_proximity(
        proximity(entered=True, episode_id="near-2")
    )

    assert first is not None and second is not None
    assert first.interaction_id != second.interaction_id


def test_voice_output_preserves_stage_event_and_mute(config):
    journey = VoiceJourneyCoordinator(config)
    output = VoiceOutputCoordinator(config)
    trigger = journey.on_proximity(proximity(entered=True))
    assert trigger is not None

    allowed, reason, event = output.decide(
        trigger, muted=False, available=True
    )
    assert allowed and reason is None
    assert event.event_id == trigger.event_id
    assert event.clip_id == "proximity_greeting"
    assert event.status == "PENDING"

    allowed, reason, event = output.decide(
        trigger, muted=True, available=True
    )
    assert not allowed
    assert reason == Reason.VOICE_MUTED
    assert event.status == "MUTED"


def test_voice_output_reports_missing_audio(config):
    journey = VoiceJourneyCoordinator(config)
    output = VoiceOutputCoordinator(config)
    trigger = journey.on_proximity(proximity(entered=True))
    assert trigger is not None

    allowed, reason, event = output.decide(
        trigger, muted=False, available=False
    )
    assert not allowed
    assert reason == Reason.AUDIO_UNAVAILABLE
    assert event.status == "UNAVAILABLE"


def test_attention_followup_uses_quick_buy_prompt(config):
    journey = VoiceJourneyCoordinator(config)
    output = VoiceOutputCoordinator(config)
    journey.on_proximity(proximity(entered=True))
    journey.on_attention(attending(), proximity(), 1_000)
    trigger = journey.on_attention(attending(), proximity(), 11_000)
    assert trigger is not None

    allowed, reason, event = output.decide(
        trigger, muted=False, available=True
    )
    assert allowed and reason is None
    assert event.clip_id == "quick_buy_prompt"
