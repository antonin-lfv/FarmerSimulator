#!/bin/bash

# Script d'arrêt du simulateur de ferme

echo "🛑 === ARRÊT DU SIMULATEUR DE FERME ==="
echo ""

# Arrêter Streamlit
echo "🔄 Arrêt de Streamlit..."
pkill -f "streamlit run Dashboard.py" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Streamlit arrêté"
else
    echo "ℹ️  Streamlit n'était pas en cours d'exécution"
fi

# Arrêter le service de mise à jour des marchés
echo "🔄 Arrêt du service de marché..."
pkill -f "market_updater.py" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Service de marché arrêté"
else
    echo "ℹ️  Service de marché n'était pas en cours d'exécution"
fi

# Arrêter tous les processus Python liés au projet (sécurité)
echo "🔄 Nettoyage des processus..."
pkill -f "start_farm_simulator.sh" 2>/dev/null

echo ""
echo "✅ === ARRÊT TERMINÉ ==="
echo ""
echo "💡 Pour redémarrer le simulateur:"
echo "   ./start_farm_simulator.sh"
echo ""