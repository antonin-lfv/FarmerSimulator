import streamlit as st
import time
from database_manager import (
    get_all_workers_status,
    get_available_workers,
    hire_worker,
    fire_worker,
    get_wallet_balance,
    get_ongoing_actions,
    complete_finished_actions
)
from config import PATH_config
from logo import add_logo

# Configuration de la page
st.set_page_config(page_title="Gestion des Ouvriers", layout="wide")

# Ajouter le logo à la barre latérale
add_logo()

# Titre de la page
st.title("🧑‍🌾 Gestion des Ouvriers")

# Afficher le solde de l'utilisateur dans la barre latérale
user_balance = get_wallet_balance(PATH_config.db_path)
if user_balance is not None:
    st.sidebar.markdown(f"**Solde : ${user_balance:.2f} USD**")
else:
    st.sidebar.error("Erreur de récupération du solde de l'utilisateur.")

# Auto-refresh pour mettre à jour les actions en cours
if 'last_refresh' not in st.session_state:
    st.session_state.last_refresh = time.time()

# Refresh automatique toutes les 30 secondes
if time.time() - st.session_state.last_refresh > 30:
    st.rerun()

# Compléter les actions terminées
complete_finished_actions(PATH_config.db_path)

# Créer deux colonnes principales
col1, col2 = st.columns([1, 1])

with col1:
    st.header("📋 Actions en Cours")
    
    ongoing_actions = get_ongoing_actions(PATH_config.db_path)
    
    if not ongoing_actions:
        st.info("Aucune action en cours.")
    else:
        for action in ongoing_actions:
            with st.container():
                st.markdown(f"**{action['action_type'].title()}** - Parcelle {action['parcel_id']}")
                st.markdown(f"👨‍💼 Ouvrier: {action['worker_name']}")
                st.markdown(f"🌾 Superficie: {action['superficie']:.1f} hectares")
                st.markdown(f"💰 Coût: ${action['cost']:.2f}")
                
                # Barre de progression
                progress_bar = st.progress(action['progress'] / 100)
                
                # Temps restant
                remaining_minutes = action['remaining_minutes']
                if remaining_minutes > 60:
                    remaining_hours = remaining_minutes / 60
                    st.markdown(f"⏰ Temps restant: {remaining_hours:.1f} heures")
                else:
                    st.markdown(f"⏰ Temps restant: {remaining_minutes:.1f} minutes")
                
                st.divider()

with col2:
    st.header("👥 Gestion des Ouvriers")
    
    # Section embauche
    with st.expander("➕ Embaucher un ouvrier", expanded=False):
        st.write("**Embauche d'un nouvel ouvrier**")
        st.write("Le nom et le salaire horaire seront générés automatiquement selon les standards du marché local.")
        
        if st.button("🤝 Embaucher un ouvrier", type="primary"):
            if hire_worker(PATH_config.db_path):
                st.success("✅ Nouvel ouvrier embauché avec succès !")
                st.rerun()
            else:
                st.error("❌ Erreur lors de l'embauche.")
    
    st.write("### 👷 Liste des Ouvriers")
    
    workers = get_all_workers_status(PATH_config.db_path)
    
    if not workers:
        st.info("Aucun ouvrier embauché.")
    else:
        for worker in workers:
            with st.container():
                col_info, col_action = st.columns([3, 1])
                
                with col_info:
                    st.markdown(f"**{worker['worker_name']}**")
                    st.markdown(f"💰 Prix: ${worker['worker_price']:.2f}/heure")
                    
                    # Statut avec couleur
                    if "Disponible" in worker['status']:
                        st.markdown(f"🟢 {worker['status']}")
                    else:
                        st.markdown(f"🔴 {worker['status']}")
                        if worker['remaining_time'] > 0:
                            if worker['remaining_time'] > 60:
                                remaining_hours = worker['remaining_time'] / 60
                                st.markdown(f"⏰ Fin dans: {remaining_hours:.1f}h")
                            else:
                                st.markdown(f"⏰ Fin dans: {worker['remaining_time']:.1f}min")
                
                with col_action:
                    if "Disponible" in worker['status']:
                        if st.button("🗑️ Licencier", key=f"fire_{worker['worker_id']}", type="secondary"):
                            if fire_worker(PATH_config.db_path, worker['worker_id']):
                                st.success("Ouvrier licencié.")
                                st.rerun()
                            else:
                                st.error("Impossible de licencier.")
                    else:
                        st.markdown("*Occupé*")
                
                st.divider()

# Section statistiques en bas
st.header("📊 Statistiques")

col_stat1, col_stat2, col_stat3, col_stat4 = st.columns(4)

with col_stat1:
    total_workers = len(workers)
    st.metric("Total Ouvriers", total_workers)

with col_stat2:
    available_workers = len([w for w in workers if "Disponible" in w['status']])
    st.metric("Ouvriers Disponibles", available_workers)

with col_stat3:
    total_ongoing = len(ongoing_actions)
    st.metric("Actions en Cours", total_ongoing)

with col_stat4:
    if ongoing_actions:
        total_cost = sum(action['cost'] for action in ongoing_actions)
        st.metric("Coût Total Actions", f"${total_cost:.2f}")
    else:
        st.metric("Coût Total Actions", "$0.00")

# Bouton de refresh manuel
if st.button("🔄 Actualiser", type="primary"):
    st.session_state.last_refresh = time.time()
    st.rerun()