class VoiceUnavailable(RuntimeError):
    pass

class MockPrisma:
    provider = 'mock-disabled'
    async def transcribe(self, audio: bytes, language: str) -> str:
        raise VoiceUnavailable('Prisma integration is pending; no audio was sent.')
