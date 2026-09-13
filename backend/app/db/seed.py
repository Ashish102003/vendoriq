"""Backward-compatible wrapper around app.scripts.seed_roles."""
from ..scripts.seed_roles import DEFAULT_ROLES, seed_roles, main

__all__ = ["DEFAULT_ROLES", "seed_roles", "main"]

if __name__ == "__main__":
    main()