# catalog_page.py

import streamlit as st
from database_manager import (
    get_categories,
    get_catalog_by_category,
    get_wallet_balance,
    add_transaction,
    add_10k_usd,
)
from typing import Dict, Any
import base64
from config import PATH_config, get_image
from logo import add_logo

# Configuration de la page
st.set_page_config(page_title="Catalogue", layout="wide")

# Ajouter le logo à la barre latérale
add_logo()

# Titre de la page
st.title("Catalogue des Articles")

# ID du wallet (puisqu'il y a un seul utilisateur, wallet_id = 1)
WALLET_ID = 1

# Récupérer les catégories
categories = get_categories(PATH_config.db_path)

# Afficher le solde de l'utilisateur dans la barre latérale
user_balance = get_wallet_balance(PATH_config.db_path)
if user_balance is not None:
    st.sidebar.markdown(f"**Solde : ${user_balance:.2f} USD**")
else:
    st.sidebar.error("Erreur de récupération du solde de l'utilisateur.")

if st.sidebar.button("Ajouter 10k USD à mon solde"):
    add_10k_usd(PATH_config.db_path)
    st.rerun()


# Fonction pour afficher un article dans un conteneur avec bordure
def display_item(item: Dict[str, Any]):
    image_data = get_image(item["img_path"])
    with st.container():
        st.markdown(
            f"""
            <div style="border: 1px solid #e1e1e1; border-radius: 5px; padding: 10px; text-align: center;">
                <h4>{item['name'].capitalize()}</h4>
                <img src="data:image/png;base64,{image_data}" alt="{item['subcategory']}" style="width:100%; max-width:200;">
                <p><strong>Prix :</strong> ${item['price']:.2f} USD</p>
                <p><strong>Promotion :</strong> {item['promotion']*100:.0f}%</p>
            </div>
            """,
            unsafe_allow_html=True,
        )


# Créer des onglets pour chaque catégorie
tab_objects = st.tabs(categories)

for tab, category in zip(tab_objects, categories):
    with tab:
        st.write("")
        # Récupérer les articles de la catégorie
        catalog = get_catalog_by_category(PATH_config.db_path, category)
        if not catalog:
            st.info(f"Aucun article disponible dans la catégorie '{category}'.")
            continue

        # Organiser les articles en lignes de 3 colonnes
        for i in range(0, len(catalog), 3):
            cols = st.columns(3)
            for j in range(3):
                if i + j < len(catalog):
                    item = catalog[i + j]
                    with cols[j]:
                        # Afficher l'article
                        display_item(item)
                        st.write("")
                        # Bouton d'achat
                        if st.button(
                            f"Acheter",
                            key=f"{item['item_id']}_{i+j}",
                            use_container_width=True,
                        ):
                            # Vérifier le solde de l'utilisateur
                            user_balance = get_wallet_balance(PATH_config.db_path)
                            if user_balance >= item["price"]:
                                # Effectuer l'achat
                                success = add_transaction(
                                    PATH_config.db_path,
                                    WALLET_ID,
                                    item["item_id"],
                                    quantity=1,
                                )
                                if success:
                                    st.success(
                                        f"Vous avez acheté {item['subcategory']} pour ${item['price']:.2f} USD."
                                    )
                                    # Rafraîchir la page pour mettre à jour le solde
                                    st.rerun()
                                else:
                                    st.error("L'achat a échoué. Veuillez réessayer.")
                            else:
                                st.error("Solde insuffisant pour cet achat.")

                        st.write("###")

# Optionnel : Afficher une description ou des informations supplémentaires
st.markdown(
    """
    ---
    ### À propos du Catalogue
    Ici, vous pouvez parcourir tous les articles disponibles à l'achat, classés par catégorie. Cliquez sur un bouton d'achat pour acquérir l'article sélectionné.
    """
)
