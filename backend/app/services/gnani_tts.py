from .gnani_stt import VoiceUnavailable

class MockTimbre:
    provider = 'mock-disabled'
    async def synthesize(self, text: str, language: str) -> bytes:
        raise VoiceUnavailable('Timbre integration is pending; no speech was generated.')
