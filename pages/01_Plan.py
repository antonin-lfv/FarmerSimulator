import streamlit as st
import plotly.graph_objects as go
from streamlit_plotly_events import plotly_events
from svgpathtools import parse_path, Line, CubicBezier, QuadraticBezier, Arc
import xml.etree.ElementTree as ET
from PIL import Image
from typing import List, Dict, Optional, Any
import numpy as np
from config import PATH_config, CSS
from logo import add_logo
import streamlit as st
from database_manager import (
    get_possible_actions, get_wallet_balance, buy_parcel, get_parcel_info,
    get_user_inventory, get_items_by_subcategory, check_user_resources,
    get_available_workers, start_action_with_time, complete_finished_actions
)

st.set_page_config(layout="wide")

# Ajouter le CSS personnalisé
st.markdown(CSS, unsafe_allow_html=True)

# Ajouter le logo à la barre latérale
add_logo()

# Afficher le solde de l'utilisateur dans la barre latérale
user_balance = get_wallet_balance(PATH_config.db_path)
if user_balance is not None:
    st.sidebar.markdown(f"**Solde : ${user_balance:.2f} USD**")
else:
    st.sidebar.error("Erreur de récupération du solde de l'utilisateur.")


# Initialiser 'selected_parcelle' dans session_state
if "selected_parcelle" not in st.session_state:
    st.session_state["selected_parcelle"] = 0  # 0 ou None selon votre préférence


@st.cache_data(show_spinner=False, ttl=3600)
def parse_svg(svg_path: str) -> List[Dict[str, any]]:
    try:
        tree = ET.parse(svg_path)
    except ET.ParseError as e:
        st.error(f"Erreur de parsing du fichier SVG : {e}")
        return []
    except FileNotFoundError:
        st.error(f"Fichier SVG non trouvé à l'emplacement : {svg_path}")
        return []

    root = tree.getroot()
    svg_ns = "http://www.w3.org/2000/svg"
    namespaces = {"svg": svg_ns}

    parcels = []

    for path in root.findall(".//svg:path", namespaces):
        d = path.get("d")
        title_elem = path.find("svg:title", namespaces)
        title = (
            title_elem.text.strip()
            if title_elem is not None and title_elem.text
            else "Inconnu"
        )

        parsed_path = parse_path(d)
        points = []

        for segment in parsed_path:
            if isinstance(segment, Line):
                points.append((segment.start.real, segment.start.imag))
                points.append((segment.end.real, segment.end.imag))
            elif isinstance(segment, (CubicBezier, QuadraticBezier, Arc)):
                num_points = (
                    5  # Réduire le nombre de points pour améliorer les performances
                )
                points.extend(
                    [
                        (segment.point(t).real, segment.point(t).imag)
                        for t in np.linspace(0, 1, num_points)
                    ]
                )

        cleaned_points = [points[0]] if points else []
        for point in points[1:]:
            if point != cleaned_points[-1]:
                cleaned_points.append(point)

        if cleaned_points and cleaned_points[0] != cleaned_points[-1]:
            cleaned_points.append(cleaned_points[0])

        parcels.append({"title": title, "points": cleaned_points})

    return parcels


@st.cache_resource(show_spinner=False, ttl=3600)
def load_image(image_path: str) -> Optional[Image.Image]:
    try:
        return Image.open(image_path)
    except FileNotFoundError:
        st.error(f"Fichier image non trouvé à l'emplacement spécifié : {image_path}")
    except Exception as e:
        st.error(f"Erreur lors du chargement de l'image : {e}")
    return None


@st.cache_resource(show_spinner=False, ttl=3600)
def create_plot(
    parcels: List[Dict[str, any]],
    x_shift: float = -66,
    y_shift: float = -10,
    zoom_factor: float = 1.07,
) -> go.Figure:
    # Charger l'image à l'intérieur de la fonction si elle est nécessaire
    image = load_image(PATH_config.image_path)
    fig = go.Figure()
    all_x, all_y = [], []

    for parcel in parcels:
        points = parcel["points"]
        if not points:
            continue

        x, y = zip(*points)
        all_x.extend(x)
        all_y.extend(y)

        fig.add_trace(
            go.Scatter(
                x=x,
                y=y,
                mode="lines",
                fill="toself",
                name=parcel["title"],
                hoverinfo="text",
                text=parcel["title"],
                line=dict(color="rgba(200,200,200,0.5)", width=2),
                fillcolor="rgba(200,200,200,0.)",
                showlegend=False,
            )
        )

    if not all_x or not all_y:
        st.error("Aucun polygone trouvé dans le fichier SVG.")
        return fig

    min_x, max_x = min(all_x), max(all_x)
    min_y, max_y = min(all_y), max(all_y)

    fig.update_xaxes(visible=False, range=[min_x, max_x], fixedrange=True)
    fig.update_yaxes(
        visible=False,
        range=[min_y, max_y],
        scaleanchor="x",
        scaleratio=1,
        autorange="reversed",
        fixedrange=True,
    )

    fig.update_layout(
        autosize=True,
        margin=dict(l=0, r=0, t=0, b=0),
        dragmode=False,
        plot_bgcolor="rgba(0,0,0,0)",
        paper_bgcolor="rgba(0,0,0,0)",
    )

    if image:
        sizex = (max_x - min_x) * zoom_factor
        sizey = (max_y - min_y) * zoom_factor
        x_image = min_x + x_shift
        y_image = min_y + y_shift

        fig.add_layout_image(
            dict(
                source=image,
                xref="x",
                yref="y",
                x=x_image,
                y=y_image,
                sizex=sizex,
                sizey=sizey,
                sizing="stretch",
                opacity=0.9,
                layer="below",
            )
        )

    return fig


def display_item_radio(
    action_id: int, subcategory: str, items: List[Dict[str, Any]]
) -> Optional[Dict[str, Any]]:
    """
    Affiche un ensemble de boutons radio avec des images pour sélectionner un item.

    Parameters:
        action_id (int): ID de l'action.
        subcategory (str): Sous-catégorie des items.
        items (List[Dict[str, Any]]): Liste des items disponibles.

    Returns:
        Optional[Dict[str, Any]]: Item sélectionné ou None.
    """
    option_names = [f"{item['name']} (Disponible : {item['amount']})" for item in items]
    selected_option = st.radio(
        f"Choisissez un {subcategory} :",
        options=option_names,
        key=f"radio_{action_id}_{subcategory}",
    )
    selected_index = option_names.index(selected_option)
    selected_item = items[selected_index]
    return selected_item


def display_manager(parcelle: int):

    # Compléter les actions terminées au début
    complete_finished_actions(PATH_config.db_path)

    # Récupérer les informations de la parcelle
    parcel_info = get_parcel_info(PATH_config.db_path, parcelle)
    superficie, type_surface, prix, is_purchased = parcel_info.values()

    st.write("##")

    with st.container(border=True):
        st.title(f"Parcelle {parcelle}")
        st.caption(
            f"{int(superficie)} hectares " + ("d'" if type_surface.capitalize()[0] in 'AEIOU' else 'de') + f" {type_surface.capitalize()}"
        )
        st.divider()

        # Si pas acheté, on affiche le prix et le bouton d'achat
        if not is_purchased:
            st.write(f"**Prix :** ${prix:.2f} USD")
            col1, col2 = st.columns([2, 1])
            if col2.button("Acheter la parcelle"):
                message = buy_parcel(PATH_config.db_path, parcelle)
                if message["success"]:
                    st.success(message["message"])
                    st.rerun()  # Rafraîchir la page pour afficher l'état mis à jour
                else:
                    st.error(message["message"])

        else:
            # Récupérer les actions possibles pour la parcelle
            actions = get_possible_actions(PATH_config.db_path, parcelle)

            if not actions:
                st.info(
                    f"Aucune action disponible pour la parcelle avec ID {parcelle}."
                )
            else:
                # Récupérer l'inventaire de l'utilisateur une seule fois
                inventory = get_user_inventory(PATH_config.db_path)
                inventory_dict = {item["item_id"]: item for item in inventory}

                # Récupérer les ouvriers disponibles
                available_workers = get_available_workers(PATH_config.db_path)

                if not available_workers:
                    st.warning("⚠️ Aucun ouvrier disponible ! Allez dans la section Ouvriers pour en embaucher.")
                    st.page_link("pages/04_Ouvriers.py", label="Gérer les ouvriers", icon="👥")
                    return

                # Afficher les actions
                for action in actions:
                    # Calcul du temps total
                    temps_par_hectare = action["action_time"]
                    temps_total = temps_par_hectare * superficie
                    
                    # Calculer le coût estimé avec les ouvriers disponibles
                    worker_price = available_workers[0]["worker_price"]  # Prix du premier ouvrier disponible
                    estimated_cost = worker_price * temps_total
                    
                    st.write(
                        f"**⏰ Temps nécessaire pour {action['action_type'].capitalize()}:** {temps_par_hectare} heures/hectare"
                    )
                    st.caption(f"(Total : {temps_total} heures)")
                    st.write(f"**💰 Coût estimé:** ${estimated_cost:.2f} USD")
                    st.write("")

                    # Sélection de l'ouvrier
                    st.subheader("👤 Sélection de l'ouvrier :")
                    worker_options = [f"{w['worker_name']} (${w['worker_price']:.2f}/h)" for w in available_workers]
                    selected_worker_idx = st.selectbox(
                        "Choisissez un ouvrier :",
                        options=range(len(worker_options)),
                        format_func=lambda x: worker_options[x],
                        key=f"worker_select_{action['action_id']}_{parcelle}"
                    )
                    selected_worker = available_workers[selected_worker_idx]
                    
                    # Recalculer le coût avec l'ouvrier sélectionné
                    actual_cost = selected_worker["worker_price"] * temps_total
                    if actual_cost != estimated_cost:
                        st.write(f"**💰 Coût réel:** ${actual_cost:.2f} USD")

                    # Afficher les exigences
                    st.subheader("**🔧 Exigences :**")
                    st.write("")
                    requirements = action["requirements"]
                    selected_requirements = {}
                    resources_sufficient = (
                        True  # Flag pour vérifier toutes les ressources
                    )

                    for req in requirements:
                        subcategory = req["subcategory"]
                        amount_required = req["amount"]

                        # Récupérer les items disponibles pour cette sous-catégorie
                        items = get_items_by_subcategory(
                            PATH_config.db_path, subcategory
                        )

                        if not items:
                            st.error(
                                f"Aucun item trouvé pour la sous-catégorie '{subcategory}'."
                            )
                            resources_sufficient = False
                            continue

                        # Utiliser un menu déroulant (selectbox) pour sélectionner l'item
                        if len(items) > 1:
                            option_names = [
                                f"{item['name']} (Disponible : {item['amount']})"
                                for item in items
                            ]
                            selected_option = st.selectbox(
                                f"Choisissez un {subcategory} :",
                                options=option_names,
                                key=f"select_{action['action_id']}_{subcategory}",
                                index=0,
                            )
                            selected_index = option_names.index(selected_option)
                            selected_item = items[selected_index]
                        else:
                            selected_item = items[0]
                            st.selectbox(
                                f"Choisissez un {subcategory} :",
                                options=[selected_item["name"]],
                                index=0,
                                disabled=True,
                                key=f"select_disabled_{action['action_id']}_{subcategory}",
                            )

                        if selected_item:
                            # Récupérer la catégorie de l'item
                            category = selected_item["category"]

                            # Ajuster l'exigence en fonction de la superficie si la catégorie est 'packs'
                            adjusted_amount_required = amount_required
                            if category.lower() == "packs":
                                adjusted_amount_required *= (
                                    superficie  # 1 pack par hectare
                                )

                            # Vérifier la disponibilité
                            item_id = selected_item["item_id"]
                            if item_id in inventory_dict:
                                owned_amount = inventory_dict[item_id]["amount"]
                                has_enough = owned_amount >= adjusted_amount_required
                            else:
                                owned_amount = 0
                                has_enough = False

                            # Afficher l'état des ressources
                            col1, col2 = st.columns([1, 1])
                            with col1:
                                st.write(
                                    f"→ **{selected_item['name']}** : {owned_amount} / {adjusted_amount_required}"
                                )
                            with col2:
                                if has_enough:
                                    st.markdown(
                                        "<span style='color: green;'>✔️ Suffisant</span>",
                                        unsafe_allow_html=True,
                                    )
                                else:
                                    st.markdown(
                                        "<span style='color: red;'>❌ Insuffisant</span>",
                                        unsafe_allow_html=True,
                                    )
                                    resources_sufficient = False

                            # Stocker la sélection avec la quantité ajustée
                            selected_requirements[subcategory] = {
                                "item_id": item_id,
                                "name": selected_item["name"],
                                "amount": adjusted_amount_required,
                                "category": category,
                            }

                        st.write("")

                    # Vérifier si toutes les ressources sont suffisantes
                    if check_user_resources(PATH_config.db_path, selected_requirements):
                        resources_sufficient = True
                    else:
                        resources_sufficient = False

                    # Vérifier si l'utilisateur a assez d'argent
                    current_balance = get_wallet_balance(PATH_config.db_path)
                    money_sufficient = current_balance >= actual_cost

                    st.write("")

                    # Afficher un résumé avant l'action
                    if resources_sufficient and money_sufficient:
                        with st.expander("📋 Résumé de l'action", expanded=True):
                            st.write(f"🎯 **Action :** {action['action_type'].title()}")
                            st.write(f"📍 **Parcelle :** {parcelle} ({superficie} hectares)")
                            st.write(f"👤 **Ouvrier :** {selected_worker['worker_name']}")
                            st.write(f"⏰ **Durée :** {temps_total} heures (≈ {temps_total:.0f} minutes réelles)")
                            st.write(f"💰 **Coût total :** ${actual_cost:.2f} USD")

                    # Bouton pour effectuer l'action
                    if resources_sufficient and money_sufficient:
                        if st.button(
                            f"🚀 Lancer l'action '{action['action_type']}'",
                            key=f"btn_{action['action_id']}_{parcelle}",
                            type="primary"
                        ):
                            success = start_action_with_time(
                                db_path=PATH_config.db_path,
                                parcel_id=parcelle,
                                action=action,
                                selected_requirements=selected_requirements,
                                worker_id=selected_worker["worker_id"]
                            )
                            if success:
                                st.success(
                                    f"✅ L'action '{action['action_type']}' a été lancée sur la parcelle {parcelle}!"
                                )
                                st.balloons()
                                st.rerun()  # Rafraîchir la page pour afficher les changements
                            else:
                                st.error(
                                    "❌ Une erreur est survenue lors du lancement de l'action."
                                )
                    else:
                        reasons = []
                        if not resources_sufficient:
                            reasons.append("ressources insuffisantes")
                        if not money_sufficient:
                            reasons.append(f"argent insuffisant (${actual_cost:.2f} requis, ${current_balance:.2f} disponible)")
                        
                        st.warning(f"⚠️ Impossible de lancer l'action : {', '.join(reasons)}")
                        
                        if not resources_sufficient:
                            st.page_link(
                                "pages/02_Shop.py",
                                label="🛒 Accéder à la boutique",
                                icon="🛒",
                            )
                    st.write("")


st.title("Gestion des parcelles")
st.divider()

# Parser le SVG
parcels = parse_svg(PATH_config.svg_path)

if not parcels:
    st.stop()

# Créer le graphique Plotly
fig = create_plot(parcels)

main_col_1, main_col_2 = st.columns([2, 1])

with main_col_1:
    st.title("Plan de la ferme")
    # Afficher le graphique et capturer les événements
    selected_points = plotly_events(
        fig,
        override_height=800,
        click_event=True,
    )

    # Mettre à jour 'selected_parcelle' dans session_state si une parcelle est sélectionnée
    if selected_points:
        point = selected_points[0]
        parcelle = point.get("curveNumber") + 1 if "curveNumber" in point else None
        if parcelle:
            st.session_state["selected_parcelle"] = parcelle
    else:
        # Optionnel : Réinitialiser la sélection ou la laisser telle quelle
        pass  # Vous pouvez choisir de ne rien faire ici pour conserver la sélection précédente

with main_col_2:
    parcelle = st.session_state["selected_parcelle"]
    if parcelle and parcelle != 0:
        display_manager(parcelle)
    else:
        st.info("Veuillez sélectionner une parcelle sur le plan de la ferme.")


# TODO : il faut préciser quelle céréale a été plantée, pour savoir quelle céréale on va récolter
