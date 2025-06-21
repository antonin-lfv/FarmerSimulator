#!/usr/bin/env python3
"""
Script automatique pour la mise à jour des prix du marché.
Ce script tourne en arrière-plan et met à jour les prix quotidiennement.
"""

import time
import sys
import os
from datetime import datetime

# Ajouter le chemin du projet
sys.path.append('/app')

from database_manager import automatic_market_update
from config import PATH_config

def log_message(message):
    """Log avec timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def main():
    log_message("🚀 Démarrage du service de mise à jour automatique des marchés")
    log_message("⏰ Fréquence: 1 fois par jour de jeu (24 minutes réelles)")
    
    while True:
        try:
            # Vérifier si la base de données existe
            if not os.path.exists(PATH_config.db_path):
                log_message("⚠️  Base de données non trouvée, attente...")
                time.sleep(60)  # Attendre 1 minute
                continue
            
            # Effectuer la mise à jour automatique
            log_message("🔄 Vérification des prix du marché...")
            automatic_market_update(PATH_config.db_path)
            log_message("✅ Vérification terminée")
            
            # Attendre 1 minute avant la prochaine vérification
            # La fonction automatic_market_update se charge de vérifier
            # si 24 minutes (1 jour de jeu) se sont écoulées
            time.sleep(60)
            
        except KeyboardInterrupt:
            log_message("🛑 Arrêt demandé par l'utilisateur")
            break
        except Exception as e:
            log_message(f"❌ Erreur: {e}")
            log_message("🔄 Redémarrage dans 30 secondes...")
            time.sleep(30)

if __name__ == "__main__":
    main()