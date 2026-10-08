"""Unit tests for api.RateLimiter's counting logic, independent of a live
Redis (no network, no docker compose needed) - same fixed-window pattern as
the PREDICTIVE project's api/main.py::RateLimiter."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from api import RateLimiter


class _FakeRedisClient:
    """In-memory stand-in for a redis client: same incr/expire surface, no
    network. Used to test RateLimiter's real counting logic deterministically."""

    def __init__(self):
        self.counts: dict[str, int] = {}

    def incr(self, key):
        self.counts[key] = self.counts.get(key, 0) + 1
        return self.counts[key]

    def expire(self, key, seconds):
        pass


def test_rate_limiter_allows_up_to_limit_then_blocks():
    limiter = RateLimiter(client=_FakeRedisClient(), limit=20, window=60)
    results = [limiter.check("same-ip") for _ in range(30)]
    assert results[:20] == [True] * 20
    assert results[20:] == [False] * 10


def test_rate_limiter_is_noop_without_backend():
    limiter = RateLimiter(client=None, limit=1, window=60)
    # No backend configured (REDIS_URL unset) -> literal skip, never blocks
    # regardless of count.
    assert all(limiter.check("same-ip") for _ in range(10))


def test_rate_limiter_tracks_identities_independently():
    limiter = RateLimiter(client=_FakeRedisClient(), limit=2, window=60)
    assert limiter.check("ip-a") is True
    assert limiter.check("ip-a") is True
    assert limiter.check("ip-a") is False
    assert limiter.check("ip-b") is True


def test_rate_limiter_fails_open_on_backend_error():
    class _BrokenClient:
        def incr(self, key):
            raise ConnectionError("redis down")

    limiter = RateLimiter(client=_BrokenClient(), limit=1, window=60)
    # A backend error must never turn into a false rejection of a paying
    # user's request - fail open, same as a no-op limiter.
    assert limiter.check("ip-a") is True
