#!/bin/bash

# Script pour voir les logs en temps réel
echo "📋 === LOGS DU SIMULATEUR DE FERME ==="
echo ""
echo "🌐 STREAMLIT LOGS (Ctrl+C pour quitter):"
echo "────────────────────────────────────────"

cd /app

# Afficher les 20 dernières lignes puis suivre en temps réel
echo "Dernières activités:"
tail -20 logs/streamlit.log
echo ""
echo "═══════════════════════════════════════"
echo "Logs en temps réel (nouvelles lignes):"
echo "═══════════════════════════════════════"

# Suivre les nouveaux logs
tail -f logs/streamlit.log