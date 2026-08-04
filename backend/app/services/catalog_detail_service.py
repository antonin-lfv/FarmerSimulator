from sqlalchemy import select
from sqlalchemy.orm import Session

from app.catalog_descriptions import DESCRIPTIONS
from app.config import settings
from app.models import Action, ActionRequirement, Catalog
from app.seed_traits import SeedTraits, get_traits
from app.services import catalog_service
from app.services.action_service import EQUIPMENT_DURATION_MULTIPLIER, SEED_SUBCATEGORIES


def _growth_label(mult: float) -> str:
    if mult <= 0.85:
        return "Rapide"
    if mult >= 1.15:
        return "Lente"
    return "Standard"


def _yield_label(mult: float) -> str:
    if mult >= 1.15:
        return "Élevé"
    if mult <= 0.85:
        return "Réduit"
    return "Standard"


def _resistance_label(value: float) -> str:
    if value >= 0.25:
        return "Élevée"
    if value > 0:
        return "Modérée"
    return "Aucune"


def _best_period(traits: SeedTraits) -> str:
    frost_ok = traits.frost_resistance >= 0.15
    heat_ok = traits.heat_resistance >= 0.1
    if frost_ok and heat_ok:
        return "Toute l'année — bonne tenue face au gel comme à la canicule."
    if frost_ok:
        return "Idéale pour un semis hivernal — bonne résistance au gel."
    if heat_ok:
        return "Idéale pour un semis estival — tolère bien la canicule."
    return "Hors périodes à risque — avril ou octobre, entre les vagues de gel et de canicule."


def _usage_lines(db: Session, item: Catalog) -> list[str]:
    action_ids = (
        db.execute(
            select(ActionRequirement.action_id)
            .where(ActionRequirement.subcategory == item.subcategory)
            .distinct()
        )
        .scalars()
        .all()
    )

    lines: list[str] = []
    for action_id in action_ids:
        action = db.get(Action, action_id)
        if action is None:
            continue
        siblings = (
            db.execute(
                select(ActionRequirement.subcategory).where(
                    ActionRequirement.action_id == action_id,
                    ActionRequirement.subcategory != item.subcategory,
                )
            )
            .scalars()
            .all()
        )
        if siblings:
            lines.append(f"« {action.action_type} » — avec {', '.join(siblings)}")
        else:
            lines.append(f"« {action.action_type} »")
    return lines


def get_detail(db: Session, item_id: int) -> dict | None:
    item = catalog_service.get_catalog_item(db, item_id)
    if item is None:
        return None

    specs: list[dict[str, str]] = []
    best_period: str | None = None

    if item.category in ("vehicules", "accessoires"):
        specs.append({"label": "Louable chez un prestataire", "value": "Oui"})
        specs.append(
            {"label": "Coût de location", "value": f"{item.price * settings.rental_fee_rate:,.0f}$ par utilisation"}
        )

    if item.item_id in EQUIPMENT_DURATION_MULTIPLIER:
        mult = EQUIPMENT_DURATION_MULTIPLIER[item.item_id]
        pct = round((1 - mult) * 100)
        specs.append(
            {
                "label": "Vitesse d'exécution",
                "value": f"{'+' if pct > 0 else ''}{pct}% par rapport au modèle standard" if pct != 0 else "Standard",
            }
        )

    if item.item_id in (42, 43):
        specs.append(
            {
                "label": "Coût de la protection",
                "value": f"{settings.protection_cost_with_equipment_usd:.0f}$ au lieu de {settings.protection_cost_usd:.0f}$",
            }
        )

    if item.category == "packs" and item.subcategory in SEED_SUBCATEGORIES:
        traits = get_traits(item.item_id)
        specs.append({"label": "Vitesse de croissance", "value": _growth_label(traits.growth_multiplier)})
        specs.append({"label": "Résistance au gel", "value": _resistance_label(traits.frost_resistance)})
        specs.append({"label": "Résistance à la canicule", "value": _resistance_label(traits.heat_resistance)})
        specs.append({"label": "Rendement", "value": _yield_label(traits.yield_multiplier)})
        best_period = _best_period(traits)

    return {
        "item_id": item.item_id,
        "category": item.category,
        "subcategory": item.subcategory,
        "name": item.name,
        "price": item.price,
        "promotion": item.promotion,
        "img_path": item.img_path,
        "amount_owned": catalog_service.owned_amount(db, item.item_id, item.category),
        "rental_price": (
            item.price * settings.rental_fee_rate if item.category in ("vehicules", "accessoires") else None
        ),
        "description": DESCRIPTIONS.get(item.item_id, ""),
        "usage": _usage_lines(db, item),
        "best_period": best_period,
        "specs": specs,
    }
