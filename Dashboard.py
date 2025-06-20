import streamlit as st
import time
from database_manager import (
    get_wallet_balance, get_ongoing_actions, get_all_workers_status,
    get_current_market_prices, get_available_contracts, complete_finished_actions,
    update_market_prices, generate_new_contracts, init_market_prices
)
import os
from config import PATH_config
from logo import add_logo

st.set_page_config(layout="wide", page_title="Farming Simulator - Dashboard")

# Ajouter le logo à la barre latérale
add_logo()

# Initialiser la base de données si nécessaire
if not os.path.exists(PATH_config.db_path):
    from database_manager import init_db, populate_db
    init_db(PATH_config.db_path)
    populate_db(PATH_config.db_path)

# Initialiser les prix du marché
init_market_prices(PATH_config.db_path)

# Auto-refresh et mise à jour automatique
if 'last_dashboard_refresh' not in st.session_state:
    st.session_state.last_dashboard_refresh = time.time()

# Mise à jour automatique des prix du marché toutes les 5 minutes
if time.time() - st.session_state.last_dashboard_refresh > 300:
    update_market_prices(PATH_config.db_path)
    generate_new_contracts(PATH_config.db_path)
    st.session_state.last_dashboard_refresh = time.time()

# Compléter les actions terminées
complete_finished_actions(PATH_config.db_path)

# Titre principal avec animation
st.markdown("""
<div style="text-align: center; padding: 2rem 0;">
    <h1 style="color: #2E8B57; font-size: 3rem; margin-bottom: 0.5rem;">
        🚜 Farming Simulator Dashboard
    </h1>
    <p style="font-size: 1.2rem; color: #666; margin-bottom: 0;">
        Gérez votre ferme avec efficacité et prospérité !
    </p>
</div>
""", unsafe_allow_html=True)

st.divider()

# Section des métriques principales
st.header("📊 Vue d'ensemble")

# Récupérer les données
user_balance = get_wallet_balance(PATH_config.db_path)
ongoing_actions = get_ongoing_actions(PATH_config.db_path)
workers_status = get_all_workers_status(PATH_config.db_path)
available_contracts = get_available_contracts(PATH_config.db_path)

# Métriques principales en colonnes
col1, col2, col3, col4 = st.columns(4)

with col1:
    if user_balance is not None:
        st.metric(
            label="💰 Solde Total",
            value=f"${user_balance:,.2f}",
            delta=f"USD"
        )
    else:
        st.metric("💰 Solde Total", "Erreur")

with col2:
    active_actions = len(ongoing_actions)
    st.metric(
        label="⚙️ Actions en Cours",
        value=active_actions,
        delta=f"operation{'s' if active_actions != 1 else ''}"
    )

with col3:
    available_workers = len([w for w in workers_status if "Disponible" in w['status']])
    total_workers = len(workers_status)
    st.metric(
        label="👥 Ouvriers Libres",
        value=f"{available_workers}/{total_workers}",
        delta=f"disponible{'s' if available_workers != 1 else ''}"
    )

with col4:
    contracts_count = len(available_contracts)
    st.metric(
        label="📋 Contrats Disponibles",
        value=contracts_count,
        delta=f"mission{'s' if contracts_count != 1 else ''}"
    )

st.divider()

# Section des activités en cours
col_left, col_right = st.columns([2, 1])

with col_left:
    st.header("🔄 Activités en Cours")
    
    if not ongoing_actions:
        st.info("🌾 Aucune activité en cours. Votre ferme est au repos !")
        st.markdown("👉 Rendez-vous sur la page **Plan** pour lancer de nouvelles actions.")
    else:
        for action in ongoing_actions[:5]:  # Afficher les 5 premières
            with st.container():
                col_action, col_progress, col_time = st.columns([2, 1, 1])
                
                with col_action:
                    if action['parcel_id'] != -1:
                        st.markdown(f"**🌾 {action['action_type'].title()}**")
                        st.caption(f"Parcelle {action['parcel_id']} • {action['worker_name']}")
                    else:
                        st.markdown(f"**📋 {action['action_type']}**")
                        st.caption(f"{action['worker_name']}")
                
                with col_progress:
                    progress_val = action['progress'] / 100
                    st.progress(progress_val)
                    st.caption(f"{action['progress']:.0f}% terminé")
                
                with col_time:
                    remaining = action['remaining_minutes']
                    if remaining > 60:
                        time_str = f"{remaining/60:.1f}h"
                    else:
                        time_str = f"{remaining:.0f}min"
                    st.markdown(f"**⏰ {time_str}**")
                    st.caption("restant")
                
                st.divider()
        
        if len(ongoing_actions) > 5:
            st.info(f"... et {len(ongoing_actions) - 5} autres activités")

with col_right:
    st.header("💹 Marché Express")
    
    # Afficher quelques prix du marché
    market_prices = get_current_market_prices(PATH_config.db_path)
    harvest_prices = [p for p in market_prices if p['category'] == 'harvest'][:4]
    
    if harvest_prices:
        for price in harvest_prices:
            col_item, col_price = st.columns([2, 1])
            with col_item:
                st.write(f"**{price['subcategory'].title()}**")
            with col_price:
                st.write(f"${price['price']:.2f}")
        
        st.page_link("pages/05_Marche.py", label="🔗 Voir tous les prix", icon="📈")
    else:
        st.info("Données de marché en cours de chargement...")

st.divider()

# Section navigation rapide
st.header("🧭 Navigation Rapide")

nav_col1, nav_col2, nav_col3 = st.columns(3)

with nav_col1:
    st.markdown("### 🎯 Gestion")
    st.page_link("pages/01_Plan.py", label="🗺️ Plan de la ferme", icon="🗺️")
    st.page_link("pages/04_Ouvriers.py", label="👥 Gérer les ouvriers", icon="👥")
    st.page_link("pages/03_Inventaire.py", label="📦 Mon inventaire", icon="📦")

with nav_col2:
    st.markdown("### 💼 Commerce")
    st.page_link("pages/02_Shop.py", label="🛒 Boutique", icon="🛒")
    st.page_link("pages/05_Marche.py", label="📈 Marché", icon="📈")
    
    # Afficher s'il y a des contrats intéressants
    if available_contracts:
        high_value_contracts = [c for c in available_contracts if c['reward'] > 500]
        if high_value_contracts:
            st.page_link("pages/06_Contrats.py", label="⭐ Contrats premium", icon="⭐")
        else:
            st.page_link("pages/06_Contrats.py", label="📋 Contrats", icon="📋")
    else:
        st.page_link("pages/06_Contrats.py", label="📋 Contrats", icon="📋")

with nav_col3:
    st.markdown("### ⚡ Actions Rapides")
    
    # Boutons d'actions rapides
    if st.button("💰 +10k USD (Admin)", type="secondary"):
        from database_manager import add_10k_usd
        add_10k_usd(PATH_config.db_path)
        st.success("💰 10,000 USD ajoutés !")
        st.rerun()
    
    if st.button("🔄 Actualiser tout"):
        update_market_prices(PATH_config.db_path)
        generate_new_contracts(PATH_config.db_path)
        st.success("✅ Données actualisées !")
        st.rerun()

# Pied de page avec informations système
st.divider()
st.markdown("---")

foot_col1, foot_col2, foot_col3 = st.columns(3)

with foot_col1:
    st.caption("🕐 Temps de jeu : 1 min = 1 heure")

with foot_col2:
    st.caption("🔄 Actualisation automatique active")

with foot_col3:
    current_time = time.strftime("%H:%M:%S")
    st.caption(f"⏰ Dernière mise à jour : {current_time}")

# Auto-refresh toutes les 30 secondes
time.sleep(1)  # Petite pause pour éviter le spam
if time.time() - st.session_state.get('last_auto_refresh', 0) > 30:
    st.session_state.last_auto_refresh = time.time()
    st.rerun()
