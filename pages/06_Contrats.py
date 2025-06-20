import streamlit as st
import time
from database_manager import (
    get_available_contracts,
    accept_contract,
    generate_new_contracts,
    get_available_workers,
    get_wallet_balance,
    get_ongoing_actions,
    complete_finished_actions
)
from config import PATH_config
from logo import add_logo

# Configuration de la page
st.set_page_config(page_title="Contrats", layout="wide")

# Ajouter le logo à la barre latérale
add_logo()

# Titre de la page
st.title("📋 Centre des Contrats")

# Afficher le solde de l'utilisateur dans la barre latérale
user_balance = get_wallet_balance(PATH_config.db_path)
if user_balance is not None:
    st.sidebar.markdown(f"**Solde : ${user_balance:.2f} USD**")
else:
    st.sidebar.error("Erreur de récupération du solde de l'utilisateur.")

# Auto-refresh pour mettre à jour les contrats
if 'last_contracts_refresh' not in st.session_state:
    st.session_state.last_contracts_refresh = time.time()

# Compléter les actions terminées
complete_finished_actions(PATH_config.db_path)

# Générer de nouveaux contrats périodiquement
if time.time() - st.session_state.last_contracts_refresh > 120:  # Toutes les 2 minutes
    generate_new_contracts(PATH_config.db_path)
    st.session_state.last_contracts_refresh = time.time()

# Interface avec onglets
tab1, tab2 = st.tabs(["📋 Contrats Disponibles", "🔄 Contrats en Cours"])

with tab1:
    st.header("Contrats Disponibles")
    
    # Bouton pour générer de nouveaux contrats
    if st.button("🆕 Générer de nouveaux contrats"):
        generate_new_contracts(PATH_config.db_path)
        st.rerun()
    
    # Récupérer les contrats disponibles
    contracts = get_available_contracts(PATH_config.db_path)
    
    if not contracts:
        st.info("Aucun contrat disponible actuellement.")
        st.write("Les nouveaux contrats apparaissent régulièrement. Revenez plus tard !")
    else:
        st.write(f"**{len(contracts)} contrat(s) disponible(s)**")
        st.write("")
        
        for contract in contracts:
            with st.container():
                st.markdown(f"### 📄 {contract['description']}")
                
                col1, col2 = st.columns([2, 1])
                
                with col1:
                    st.markdown(f"**💰 Récompense :** ${contract['reward']:.2f}")
                    
                    # Estimation de la durée (entre 2 et 6 heures)
                    st.markdown("**⏰ Durée estimée :** 2-6 heures")
                    
                    # Récupérer les ouvriers disponibles
                    available_workers = get_available_workers(PATH_config.db_path)
                    
                    if available_workers:
                        st.markdown("**👤 Ouvriers disponibles :**")
                        worker_options = [f"{w['worker_name']} (${w['worker_price']:.2f}/h)" for w in available_workers]
                        selected_worker_idx = st.selectbox(
                            "Choisissez un ouvrier :",
                            options=range(len(worker_options)),
                            format_func=lambda x: worker_options[x],
                            key=f"worker_contract_{contract['contract_id']}"
                        )
                        selected_worker = available_workers[selected_worker_idx]
                        
                        # Calculer le coût estimé
                        estimated_duration = 4  # Moyenne entre 2 et 6 heures
                        estimated_cost = selected_worker["worker_price"] * estimated_duration
                        estimated_profit = contract['reward'] - estimated_cost
                        
                        st.markdown(f"**💸 Coût estimé :** ${estimated_cost:.2f}")
                        
                        if estimated_profit > 0:
                            st.markdown(f"**✅ Profit estimé :** ${estimated_profit:.2f}")
                        else:
                            st.markdown(f"**❌ Perte estimée :** ${abs(estimated_profit):.2f}")
                    else:
                        st.warning("❌ Aucun ouvrier disponible")
                
                with col2:
                    st.write("")  # Espacement
                    
                    if available_workers:
                        if estimated_profit > 0:
                            button_type = "primary"
                            button_text = "✅ Accepter le contrat"
                        else:
                            button_type = "secondary"
                            button_text = "⚠️ Accepter (perte)"
                        
                        if st.button(
                            button_text,
                            key=f"accept_{contract['contract_id']}",
                            type=button_type
                        ):
                            success = accept_contract(
                                PATH_config.db_path,
                                contract['contract_id'],
                                selected_worker['worker_id']
                            )
                            
                            if success:
                                st.success(f"✅ Contrat accepté ! {selected_worker['worker_name']} est maintenant en mission.")
                                st.balloons()
                                st.rerun()
                            else:
                                st.error("❌ Impossible d'accepter le contrat. Vérifiez votre solde.")
                    else:
                        st.write("Aucun ouvrier disponible")
                
                st.divider()

with tab2:
    st.header("Contrats en Cours")
    
    # Récupérer les actions en cours (y compris les contrats)
    ongoing_actions = get_ongoing_actions(PATH_config.db_path)
    contract_actions = [action for action in ongoing_actions if "Contrat:" in action['action_type']]
    
    if not contract_actions:
        st.info("Aucun contrat en cours.")
    else:
        st.write(f"**{len(contract_actions)} contrat(s) en cours**")
        st.write("")
        
        for action in contract_actions:
            with st.container():
                # Extraire la description du contrat
                contract_description = action['action_type'].replace("Contrat: ", "")
                
                st.markdown(f"### 📋 {contract_description}")
                
                col1, col2 = st.columns([2, 1])
                
                with col1:
                    st.markdown(f"**👤 Ouvrier :** {action['worker_name']}")
                    st.markdown(f"**💰 Coût :** ${action['cost']:.2f}")
                    
                    # Barre de progression
                    progress_bar = st.progress(action['progress'] / 100)
                    
                    # Temps restant
                    remaining_minutes = action['remaining_minutes']
                    if remaining_minutes > 60:
                        remaining_hours = remaining_minutes / 60
                        st.markdown(f"**⏰ Temps restant :** {remaining_hours:.1f} heures")
                    else:
                        st.markdown(f"**⏰ Temps restant :** {remaining_minutes:.1f} minutes")
                
                with col2:
                    # Afficher le statut
                    if action['progress'] >= 100:
                        st.success("✅ Terminé !")
                    elif action['progress'] >= 75:
                        st.info("🔄 Presque fini...")
                    elif action['progress'] >= 50:
                        st.info("⏳ En cours...")
                    else:
                        st.info("🚀 Démarré")
                
                st.divider()

# Section statistiques
st.header("📊 Statistiques des Contrats")

col1, col2, col3, col4 = st.columns(4)

with col1:
    available_count = len(contracts) if contracts else 0
    st.metric("Contrats Disponibles", available_count)

with col2:
    ongoing_count = len(contract_actions) if contract_actions else 0
    st.metric("Contrats en Cours", ongoing_count)

with col3:
    available_workers = get_available_workers(PATH_config.db_path)
    workers_count = len(available_workers)
    st.metric("Ouvriers Libres", workers_count)

with col4:
    if contract_actions:
        total_contract_cost = sum(action['cost'] for action in contract_actions)
        st.metric("Coût Total Contrats", f"${total_contract_cost:.2f}")
    else:
        st.metric("Coût Total Contrats", "$0.00")

# Bouton de refresh manuel
if st.button("🔄 Actualiser", type="secondary"):
    st.rerun()

# Informations en bas de page
st.markdown("---")
st.markdown("""
### ℹ️ À propos des Contrats

- Les contrats sont un excellent moyen de générer des revenus supplémentaires
- Chaque contrat nécessite un ouvrier disponible pour une durée déterminée
- Les récompenses varient selon la difficulté et la durée du contrat
- De nouveaux contrats apparaissent régulièrement
- Calculez bien vos coûts avant d'accepter un contrat !
""")