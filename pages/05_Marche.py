import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
from datetime import datetime
import pandas as pd
from database_manager import (
    get_current_market_prices,
    get_price_history,
    update_market_prices,
    init_market_prices,
    sell_harvest,
    get_wallet_balance,
    get_user_inventory
)
from config import PATH_config
from logo import add_logo

# Configuration de la page
st.set_page_config(page_title="Marché", layout="wide")

# Ajouter le logo à la barre latérale
add_logo()

# Titre de la page
st.title("📈 Marché des Matières Premières")

# Afficher le solde de l'utilisateur dans la barre latérale
user_balance = get_wallet_balance(PATH_config.db_path)
if user_balance is not None:
    st.sidebar.markdown(f"**Solde : ${user_balance:.2f} USD**")
else:
    st.sidebar.error("Erreur de récupération du solde de l'utilisateur.")

# Initialiser les prix du marché si nécessaire
init_market_prices(PATH_config.db_path)

# Bouton pour mettre à jour les prix (simulation des fluctuations)
if st.sidebar.button("🔄 Actualiser les prix du marché"):
    update_market_prices(PATH_config.db_path)
    st.rerun()

# Récupérer les prix actuels
current_prices = get_current_market_prices(PATH_config.db_path)

if not current_prices:
    st.error("Aucun prix de marché disponible.")
    st.stop()

# Séparer les prix par catégorie
packs_prices = [p for p in current_prices if p['category'] == 'packs']
harvest_prices = [p for p in current_prices if p['category'] == 'harvest']

# Interface principale avec onglets
tab1, tab2, tab3 = st.tabs(["📊 Prix Actuels", "📈 Graphiques", "💰 Vendre"])

with tab1:
    st.header("Prix Actuels du Marché")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("🌱 Graines et Matériaux")
        for price in packs_prices:
            delta_color = "normal"
            
            # Récupérer l'historique récent pour calculer la tendance
            history = get_price_history(PATH_config.db_path, price['category'], price['subcategory'], 2)
            if len(history) >= 2:
                current_price = history[0]['price']
                previous_price = history[1]['price']
                change = current_price - previous_price
                change_percent = (change / previous_price) * 100
                
                if change > 0:
                    delta_color = "normal"
                    delta_text = f"+${change:.2f} ({change_percent:+.1f}%)"
                elif change < 0:
                    delta_color = "inverse"
                    delta_text = f"${change:.2f} ({change_percent:+.1f}%)"
                else:
                    delta_text = "Stable"
            else:
                delta_text = "Nouveau"
            
            st.metric(
                label=price['subcategory'].title(),
                value=f"${price['price']:.2f}",
                delta=delta_text
            )
    
    with col2:
        st.subheader("🌾 Prix de Vente des Récoltes")
        for price in harvest_prices:
            delta_color = "normal"
            
            # Récupérer l'historique récent pour calculer la tendance
            history = get_price_history(PATH_config.db_path, price['category'], price['subcategory'], 2)
            if len(history) >= 2:
                current_price = history[0]['price']
                previous_price = history[1]['price']
                change = current_price - previous_price
                change_percent = (change / previous_price) * 100
                
                if change > 0:
                    delta_color = "normal"
                    delta_text = f"+${change:.2f} ({change_percent:+.1f}%)"
                elif change < 0:
                    delta_color = "inverse"
                    delta_text = f"${change:.2f} ({change_percent:+.1f}%)"
                else:
                    delta_text = "Stable"
            else:
                delta_text = "Nouveau"
            
            st.metric(
                label=price['subcategory'].title(),
                value=f"${price['price']:.2f}",
                delta=delta_text
            )

with tab2:
    st.header("Évolution des Prix")
    
    # Sélecteur de produit
    all_products = [(p['category'], p['subcategory']) for p in current_prices]
    product_options = [f"{cat.title()}: {sub.title()}" for cat, sub in all_products]
    
    selected_product_idx = st.selectbox(
        "Choisissez un produit à analyser:",
        options=range(len(product_options)),
        format_func=lambda x: product_options[x]
    )
    
    if selected_product_idx is not None:
        selected_category, selected_subcategory = all_products[selected_product_idx]
        
        # Récupérer l'historique
        history = get_price_history(PATH_config.db_path, selected_category, selected_subcategory, 50)
        
        if history:
            # Créer un DataFrame pour Plotly
            df = pd.DataFrame(history)
            df['datetime'] = pd.to_datetime(df['timestamp'], unit='s')
            df = df.sort_values('datetime')
            
            # Créer le graphique
            fig = go.Figure()
            fig.add_trace(go.Scatter(
                x=df['datetime'],
                y=df['price'],
                mode='lines+markers',
                name=f"{selected_subcategory.title()}",
                line=dict(color='#1f77b4', width=3),
                marker=dict(size=6)
            ))
            
            fig.update_layout(
                title=f"Évolution du prix - {selected_subcategory.title()}",
                xaxis_title="Temps",
                yaxis_title="Prix (USD)",
                hovermode='x unified',
                height=400
            )
            
            st.plotly_chart(fig, use_container_width=True)
            
            # Statistiques
            if len(df) > 1:
                col1, col2, col3, col4 = st.columns(4)
                
                with col1:
                    st.metric("Prix Actuel", f"${df['price'].iloc[-1]:.2f}")
                
                with col2:
                    min_price = df['price'].min()
                    st.metric("Prix Minimum", f"${min_price:.2f}")
                
                with col3:
                    max_price = df['price'].max()
                    st.metric("Prix Maximum", f"${max_price:.2f}")
                
                with col4:
                    avg_price = df['price'].mean()
                    st.metric("Prix Moyen", f"${avg_price:.2f}")
        else:
            st.info("Pas assez de données historiques pour ce produit.")

with tab3:
    st.header("Vendre vos Récoltes")
    
    # Récupérer l'inventaire de l'utilisateur
    inventory = get_user_inventory(PATH_config.db_path)
    
    # Filtrer les items qui peuvent être vendus (récoltes)
    sellable_items = []
    for item in inventory:
        if item['category'] == 'packs' and item['amount'] > 0:
            # Vérifier s'il y a un prix de marché pour ce type de récolte
            subcategory_match = None
            for price in harvest_prices:
                if price['subcategory'] in item['subcategory'] or item['subcategory'] in price['subcategory']:
                    subcategory_match = price['subcategory']
                    break
            
            if subcategory_match:
                sellable_items.append({
                    'item': item,
                    'market_subcategory': subcategory_match,
                    'market_price': next(p['price'] for p in harvest_prices if p['subcategory'] == subcategory_match)
                })
    
    if not sellable_items:
        st.info("Vous n'avez aucune récolte à vendre actuellement.")
    else:
        st.write("### 🌾 Vos Récoltes Disponibles")
        
        for sellable in sellable_items:
            item = sellable['item']
            market_price = sellable['market_price']
            
            with st.container():
                col1, col2, col3 = st.columns([2, 1, 1])
                
                with col1:
                    st.write(f"**{item['name']}**")
                    st.write(f"Quantité disponible: {item['amount']}")
                    st.write(f"Prix de marché: ${market_price:.2f}/unité")
                
                with col2:
                    max_sellable = min(item['amount'], 1000)  # Limite pratique
                    quantity_to_sell = st.number_input(
                        "Quantité à vendre:",
                        min_value=1,
                        max_value=max_sellable,
                        value=1,
                        key=f"sell_qty_{item['item_id']}"
                    )
                    
                    total_value = quantity_to_sell * market_price
                    st.write(f"**Valeur totale: ${total_value:.2f}**")
                
                with col3:
                    if st.button(
                        "💰 Vendre",
                        key=f"sell_btn_{item['item_id']}",
                        type="primary"
                    ):
                        if sell_harvest(PATH_config.db_path, sellable['market_subcategory'], quantity_to_sell):
                            st.success(f"Vendu {quantity_to_sell} {item['name']} pour ${total_value:.2f}!")
                            st.rerun()
                        else:
                            st.error("Erreur lors de la vente.")
                
                st.divider()

# Section informations en bas
st.markdown("---")
st.markdown("""
### ℹ️ À propos du Marché

- Les prix fluctuent automatiquement en fonction de l'offre et de la demande
- Consultez les graphiques pour identifier les meilleures opportunités de vente
- Les prix sont mis à jour régulièrement - pensez à actualiser !
- Vendez vos récoltes au meilleur moment pour maximiser vos profits
""")