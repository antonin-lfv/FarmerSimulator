🚜 GUIDE DE DÉMARRAGE RAPIDE - RÉSOLUTION DES PROBLÈMES

=== PROBLÈMES RÉSOLUS ===

✅ Actions maintenant fonctionnelles
✅ Debug activé pour voir les erreurs
✅ Équipement de base ajouté
✅ Parcelles configurées correctement

=== POUR COMMENCER À JOUER ===

1. 🏠 DÉMARRAGE :
   - L'application tourne sur http://localhost:8001
   - Le service de marché fonctionne automatiquement

2. 🗺️ PREMIÈRE ACTION (PARCELLE 1) :
   - Parcelle 1 est prête pour "semer céréales"
   - Vous avez déjà l'équipement nécessaire
   - Allez sur la page Plan → Cliquez sur parcelle 1

3. 📦 INVENTAIRE ACTUEL :
   - Petit tracteur (et autres tracteurs)
   - Déchaumeur à disques (pour labourer)
   - Graines d'orge (pour semer)
   - Solde: 11,000 USD

4. 🔄 CYCLE COMPLET D'UNE PARCELLE :
   labourer → semer céréales → mettre engrais → récolter → (recommence)

=== SI VOUS AVEZ ENCORE DES ERREURS ===

1. 🔍 DEBUG ACTIVÉ :
   - Un expander "Debug - Paramètres de l'action" s'affiche
   - Les erreurs détaillées sont maintenant visibles
   - Les stack traces s'affichent pour diagnostiquer

2. 🛒 MANQUE D'ÉQUIPEMENT :
   - Allez à la Boutique pour acheter ce qui manque
   - Vérifiez l'Inventaire pour voir ce que vous possédez

3. 💰 MANQUE D'ARGENT :
   - Utilisez le bouton "💰 +10k USD (Admin)" sur le Dashboard

=== COMMANDES UTILES ===

🚀 Démarrer le simulateur :
   ./start_farm_simulator.sh

🛑 Arrêter le simulateur :
   ./stop_farm_simulator.sh

📊 Voir les logs en temps réel :
   tail -f logs/streamlit.log
   tail -f logs/market_updater.log

🔍 Status des services :
   ps aux | grep streamlit
   ps aux | grep market_updater

=== TYPES DE PARCELLES ===

🌾 Champs (type 1) : céréales, coton, patates
🌲 Forêt (type 2) : couper le bois  
🍇 Vignes (type 3) : planter des vignes, récolter raisins
🏭 Entrepôt (type 4) : stockage

=== LE SYSTÈME FONCTIONNE MAINTENANT ! ===

✅ Équipement disponible pour toutes les actions de base
✅ Parcelles configurées correctement
✅ Debug activé pour diagnostiquer les problèmes
✅ Marché automatique fonctionnel
✅ Logs détaillés disponibles

Bon jeu ! 🎮🌾