#!/bin/bash

# Script de lancement complet du simulateur de ferme
# Lance l'application Streamlit ET le service de mise à jour des marchés

echo "🚜 === DÉMARRAGE DU SIMULATEUR DE FERME ==="
echo ""

# Aller dans le répertoire de l'application
cd /app

# Vérifier que Python et les dépendances sont installées
echo "📦 Vérification des dépendances..."
if ! python3 -c "import streamlit" 2>/dev/null; then
    echo "❌ Streamlit non installé. Installation..."
    pip install -r requirements.txt
fi

# Créer les logs directory si nécessaire
mkdir -p logs

echo "✅ Dépendances OK"
echo ""

# Fonction pour nettoyer les processus lors de l'arrêt
cleanup() {
    echo ""
    echo "🛑 Arrêt en cours..."
    
    # Arrêter Streamlit
    if [ ! -z "$STREAMLIT_PID" ]; then
        echo "🔄 Arrêt de Streamlit (PID: $STREAMLIT_PID)..."
        kill $STREAMLIT_PID 2>/dev/null
    fi
    
    # Arrêter le service de mise à jour des marchés
    if [ ! -z "$MARKET_PID" ]; then
        echo "🔄 Arrêt du service de marché (PID: $MARKET_PID)..."
        kill $MARKET_PID 2>/dev/null
    fi
    
    echo "✅ Arrêt terminé"
    exit 0
}

# Capturer les signaux d'arrêt
trap cleanup SIGINT SIGTERM

echo "🌐 Démarrage de l'application Streamlit..."
streamlit run Dashboard.py --server.port 8001 --server.address 0.0.0.0 > logs/streamlit.log 2>&1 &
STREAMLIT_PID=$!
echo "✅ Streamlit démarré (PID: $STREAMLIT_PID)"
echo "🔗 Application disponible sur: http://localhost:8001"
echo ""

echo "📈 Démarrage du service de mise à jour des marchés..."
python3 market_updater.py > logs/market_updater.log 2>&1 &
MARKET_PID=$!
echo "✅ Service de marché démarré (PID: $MARKET_PID)"
echo ""

echo "🎉 === SYSTÈME DÉMARRÉ AVEC SUCCÈS ==="
echo ""
echo "💡 Informations importantes:"
echo "   • Application web: http://localhost:8001"
echo "   • Mise à jour automatique des marchés: ACTIVE"
echo "   • Logs Streamlit: logs/streamlit.log"
echo "   • Logs Marché: logs/market_updater.log"
echo ""
echo "🔄 Pour voir les logs en temps réel:"
echo "   tail -f logs/streamlit.log"
echo "   tail -f logs/market_updater.log"
echo ""
echo "🛑 Pour arrêter: Ctrl+C"
echo ""

# Attendre que les processus tournent
while kill -0 $STREAMLIT_PID 2>/dev/null && kill -0 $MARKET_PID 2>/dev/null; do
    sleep 5
done

echo "❌ Un des services s'est arrêté de manière inattendue"
cleanup