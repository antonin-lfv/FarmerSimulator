# inventory_page.py

import streamlit as st
from database_manager import (
    get_user_inventory,
    get_wallet_balance,
    sell_item,
)
from typing import Dict, Any
import base64
from config import PATH_config, get_image
from logo import add_logo

# Configuration de la page
st.set_page_config(page_title="Mon Inventaire", layout="wide")

# Ajouter le logo à la barre latérale
add_logo()

# Titre de la page
st.title("Mon Inventaire")

# ID du wallet (puisqu'il y a un seul utilisateur, wallet_id = 1)
WALLET_ID = 1

# Afficher le solde de l'utilisateur dans la barre latérale
user_balance = get_wallet_balance(PATH_config.db_path)
if user_balance is not None:
    st.sidebar.markdown(f"**Solde : ${user_balance:.2f} USD**")
else:
    st.sidebar.error("Erreur de récupération du solde de l'utilisateur.")


# Récupérer l'inventaire de l'utilisateur
inventory = get_user_inventory(PATH_config.db_path)

if not inventory:
    st.info("Votre inventaire est vide.")
else:
    # Obtenir les catégories présentes dans l'inventaire
    categories = list(set(item["category"] for item in inventory))
    categories.sort()  # Trier les catégories pour un affichage cohérent

    # Créer des onglets pour chaque catégorie
    tab_objects = st.tabs(categories)

    for tab, category in zip(tab_objects, categories):
        with tab:
            st.write("")
            # Filtrer les items pour cette catégorie
            items_in_category = [
                item for item in inventory if item["category"] == category
            ]

            if not items_in_category:
                st.info(f"Aucun article dans la catégorie '{category}'.")
                continue

            # Organiser les articles en lignes de 3 colonnes
            for i in range(0, len(items_in_category), 3):
                cols = st.columns(3)
                for j in range(3):
                    if i + j < len(items_in_category):
                        item = items_in_category[i + j]
                        with cols[j]:
                            # Afficher l'article
                            image_data = get_image(item["img_path"])
                            if image_data != "":
                                st.markdown(
                                    f"""
                                    <div style="border: 1px solid #e1e1e1; border-radius: 5px; padding: 10px; text-align: center;">
                                        <h4>{item['name'].capitalize()}</h4>
                                        <img src="data:image/png;base64,{image_data}" alt="{item['subcategory']}" style="width:100%; max-width:200px;">
                                        <p><strong>Quantité possédée :</strong> {item['amount']}</p>
                                    </div>
                                    """,
                                    unsafe_allow_html=True,
                                )
                            else:
                                st.write(f"{item['subcategory'].capitalize()}")
                                st.write(f"Quantité possédée : {item['amount']}")

                            st.write("")
                            # Champ pour spécifier la quantité à vendre
                            sell_quantity = st.number_input(
                                f"Quantité à vendre",
                                min_value=1,
                                max_value=item["amount"],
                                value=1,
                                key=f"sell_qty_{item['item_id']}",
                            )
                            # Bouton de vente
                            if st.button(
                                f"Vendre",
                                key=f"sell_btn_{item['item_id']}",
                                use_container_width=True,
                            ):
                                if sell_quantity <= item["amount"]:
                                    # Effectuer la vente
                                    success = sell_item(
                                        PATH_config.db_path,
                                        WALLET_ID,
                                        item["item_id"],
                                        int(sell_quantity),
                                    )
                                    if success:
                                        st.success(
                                            f"Vous avez vendu {int(sell_quantity)} x {item['subcategory']} pour ${sell_quantity * item['price'] * 0.8:.2f} USD."
                                        )
                                        # Rafraîchir la page pour mettre à jour le solde et l'inventaire
                                        st.rerun()
                                    else:
                                        st.error(
                                            "La vente a échoué. Veuillez réessayer."
                                        )
                                else:
                                    st.error("Quantité insuffisante pour la vente.")

    # Optionnel : Afficher une description ou des informations supplémentaires
    st.markdown(
        """
        ---
        ### À propos de l'Inventaire
        Ici, vous pouvez voir tous les articles que vous possédez. Vous pouvez vendre des articles en spécifiant la quantité que vous souhaitez vendre.
        """
    )
