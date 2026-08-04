from typing import NamedTuple


class SeedTraits(NamedTuple):
    """Gameplay trade-offs for a specific seed/sapling catalog item.

    growth_multiplier: applied to the planting action's duration (<1 faster, >1 slower).
    frost_resistance / heat_resistance: fraction (0-1) of frost/canicule yield_health
      damage negated each day while this variety is growing.
    yield_multiplier: applied to the harvested quantity.
    """

    growth_multiplier: float = 1.0
    frost_resistance: float = 0.0
    heat_resistance: float = 0.0
    yield_multiplier: float = 1.0


DEFAULT_TRAITS = SeedTraits()

# Keyed by catalog item_id. Items with no entry (the original baseline varieties)
# use DEFAULT_TRAITS — every variety is a real trade-off, not a reskinned default.
SEED_TRAITS: dict[int, SeedTraits] = {
    # Céréales (18 Blé = baseline)
    19: SeedTraits(growth_multiplier=1.1, heat_resistance=0.15, yield_multiplier=1.2),  # Maïs
    20: SeedTraits(growth_multiplier=0.85, frost_resistance=0.25, yield_multiplier=0.9),  # Orge
    21: SeedTraits(frost_resistance=0.1, heat_resistance=0.1, yield_multiplier=1.1),  # Colza
    29: SeedTraits(growth_multiplier=0.9, frost_resistance=0.3, yield_multiplier=0.85),  # Avoine
    30: SeedTraits(growth_multiplier=0.9, frost_resistance=0.35, yield_multiplier=0.8),  # Seigle
    # Coton (23 Coton standard = baseline)
    31: SeedTraits(growth_multiplier=1.15, heat_resistance=0.1, yield_multiplier=1.3),  # Pima
    32: SeedTraits(growth_multiplier=1.2, yield_multiplier=1.1),  # Bio
    # Patates (25 standard = baseline)
    33: SeedTraits(growth_multiplier=0.8, yield_multiplier=0.9),  # Charlotte
    34: SeedTraits(growth_multiplier=1.3, yield_multiplier=1.4),  # Vitelotte
    # Raisins (22 Raisins de table = baseline)
    35: SeedTraits(growth_multiplier=1.15, heat_resistance=0.15, yield_multiplier=1.25),  # Cabernet Sauvignon
    36: SeedTraits(growth_multiplier=1.1, frost_resistance=0.2, yield_multiplier=1.2),  # Chardonnay
    # Bois (24 Pousses d'arbres = baseline)
    37: SeedTraits(growth_multiplier=1.5, frost_resistance=0.2, heat_resistance=0.1, yield_multiplier=1.6),  # Chêne
    38: SeedTraits(growth_multiplier=0.75, frost_resistance=0.3, yield_multiplier=0.8),  # Pin
}


def get_traits(item_id: int | None) -> SeedTraits:
    if item_id is None:
        return DEFAULT_TRAITS
    return SEED_TRAITS.get(item_id, DEFAULT_TRAITS)
