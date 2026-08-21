# Verdance — mécaniques de jeu

Documentation vivante du jeu tel qu'il fonctionne aujourd'hui (à tenir à jour à chaque changement
de mécanique — contrairement à `docs/legacy-streamlit-app.md`, qui est un instantané figé de
l'ancienne version Streamlit).

## Calendrier

Le temps du jeu est dérivé du temps réel écoulé depuis le lancement de la partie
(`GameState.epoch_ts`), pas stocké tour par tour. Un an de jeu dure `month_duration_seconds × 12`
secondes réelles (par défaut 1 mois = 1 semaine réelle ; `GAME_MONTH_SECONDS` en variable
d'environnement pour accélérer en debug, 5 min par défaut en Docker Compose). L'année compte 366
jours répartis sur des mois à longueur réelle (février = 29 jours) — le jeu affiche une vraie date
("23 mai") mais **aucune année** : le calendrier boucle indéfiniment, il n'y a pas de compteur
d'année à afficher.

## Météo

Déterministe par jour (seed = `day_index × 7919 + 17`), donc la prévision affichée est **exacte**,
pas une estimation — voir/prévisions ("today" et `get_forecast` appellent la même fonction). Quatre
états : ensoleillé, pluie, gel, canicule, avec des probabilités mensuelles calées sur un climat
français (gel concentré en hiver, canicule en été).

- **Pluie** : accélère la pousse des cultures (`rain_growth_multiplier`, ×1.1) et allonge/raccourcit
  légèrement la durée des actions en cours.
- **Gel/canicule** : endommage `yield_health` chaque jour (15/10 points de base, réduit par la
  résistance de la variété plantée, annulé si la parcelle est protégée ce jour-là) et déclenche une
  notification. La canicule ralentit aussi la pousse (`heat_growth_multiplier`, ×0.85).
- **Protection** : brasero anti-gel / système d'irrigation (catalogue), 600$ sans équipement, 150$
  si on possède l'accessoire correspondant.

## Cycle de culture

`labourer → semer → mettre engrais → récolter → labourer...` (vigne/forêt : `planter → récolter`).
Chaque étape est une action manuelle avec un coût (main d'œuvre × durée × superficie, + location
éventuelle) affiché avant de démarrer.

**Pousse réaliste** : une fois semé, la récolte n'est pas immédiatement disponible même si
l'engrais est déjà passé — une jauge de pousse (`growth_progress`, en jours de jeu accumulés,
incrémentée une fois par jour du multiplicateur météo du jour) doit atteindre un seuil avant que
`récolter` soit acceptée par le serveur. Seuils de base (`BASE_GROWTH_DAYS`,
`calendar_service.py`) : céréales 6j, coton 7j, patates 6j, vigne 10j, forêt 14j — multipliés par
le `growth_multiplier` de la variété plantée (voir plus bas). Tenter de récolter trop tôt renvoie
une erreur explicite avec le nombre de jours restants.

**Santé de la récolte** (`yield_health`, 100→0) : baisse uniquement à cause du gel/canicule non
protégé, remise à 100 à chaque nouveau semis. Scale le rendement final à la récolte.

## Variétés de graines/pousses

Chaque variété (`app/seed_traits.py`) a un vrai compromis, pas juste un skin :
`growth_multiplier` (vitesse de pousse — affecte aussi la durée de l'action de semis et le seuil de
jours requis), `frost_resistance`/`heat_resistance` (0-1, réduit les dégâts météo), `yield_multiplier`
(quantité récoltée). 18 variétés au total (6 céréales, 3 coton, 3 patates, 3 raisins, 3 bois). La
récolte crédite l'exacte variété plantée, pas un item générique.

## Marché

Un prix par article et **par jour de jeu** (pas un minuteur temps réel indépendant) — calculé dans
la même boucle que le calendrier (`calendar_service.process_day_tick` →
`market_service.process_day`), donc parfaitement synchronisé avec les jours affichés. Marche
aléatoire autour d'une moyenne propre à chaque article (le milieu de sa fourchette de prix, pas une
cible unique partagée par tous les articles) avec un bruit quotidien ±6%, une réversion vers la
moyenne, et ~12% de chance par article d'un pic ou d'une chute plus marquée (±15-35%). ~10% de
chance par jour d'un évènement de marché global (sécheresse, récolte exceptionnelle...).

## Stockage

Capacité totale = base + niveau × capacité par entrepôt possédé. Un achat qui dépasserait la
capacité est refusé ; une récolte qui dépasse la capacité restante vend l'excédent au prix du
marché du jour au lieu de le perdre.

## Banque

Un seul prêt actif à la fois, mensualités automatiques (intérêt + capital, cycle de facturation
fixe de 30 jours — indépendant de la longueur réelle des mois calendaires). Notifications à chaque
prêt accordé/mensualité prélevée (ou impayée)/remboursement.

## Notifications

Générées automatiquement (alertes météo, évènements bancaires), jamais par une action manuelle du
joueur. Conservées `notification_retention_days` (30) jours de jeu, purgées automatiquement à la
lecture. Cloche dans la navbar, badge de non-lus, marquées lues à l'ouverture du menu.

## Location de matériel

Alternative à l'achat pour véhicules et accessoires (pas les consommables) : `rental_fee_rate`
(15% du prix catalogue) par utilisation, aucun verrou de possession créé — le prestataire ramène
tout, disponible même si vous ne possédez rien.

## Interface

- **Navbar fixe** : date/météo (widget partagé avec la carte météo du dashboard — même source de
  données, jamais désynchronisés), trésorerie, stockage, notifications, menu (Compte / Gestion des
  parcelles / Banque / Paramètres). Mises à jour instantanées après toute mutation (achat, vente,
  action...) via un bus d'évènements côté client, pas juste l'intervalle de sondage habituel.
- **Tableau de bord** : carte + panneau de parcelle sélectionnée (achat, lancement d'action) en
  haut, activités en cours juste en dessous, marché express et types de surface plus bas.
- **Fiches produit** (`/catalog/{id}`) : une par article du catalogue, description + specs dérivées
  des vraies mécaniques (pas de texte statique désynchronisable) + utilisation + meilleure période
  pour les graines.
- **Achat/vente** : toujours via une modale de confirmation (image, prix, quantité, total) — jamais
  d'action instantanée au clic. Le lancement d'une activité permet d'acheter directement le
  matériel manquant, y compris parcourir d'autres modèles/variétés non possédés via les flèches,
  sans quitter la page.
- **Info-bulles** : un petit repère « ⓘ » (`InfoTip`, `title` natif) à côté des libellés non
  triviaux — santé de la récolte, pousse, engrais, coût total, stockage, mensualité de prêt, prix
  du marché, location de matériel... Pas de nouveau composant JS de tooltip, juste `title` sur un
  `<span>` pour rester léger.
- **Cycle de culture visible** (`ParcelPanel`) : le cycle complet de la parcelle (labourer → semer →
  engrais → récolter pour un champ, planter → récolter/couper pour vigne/forêt) s'affiche en
  totalité avec l'étape courante en surbrillance, pas seulement l'étape précédente/suivante — le
  cycle est une donnée purement d'affichage côté frontend (`getCropCycle`, `lib/utils.ts`), la
  chaîne réelle reste pilotée par `Action.next_action` côté backend.
- **« À faire » vs « en pousse »** : une parcelle dont la prochaine étape est une récolte
  (`récolter X`/`recolter raisins`/`couper le bois`) mais dont la pousse n'a pas atteint 100%
  n'apparaît plus comme « prête » dans les listes d'actions groupées (dashboard et `/parcels`) —
  elle bascule dans une section « En pousse » séparée (compte + pousse moyenne), pour ne jamais
  proposer une action que le serveur refuserait. Le panneau de parcelle individuelle applique la
  même règle : le formulaire de lancement est remplacé par un message d'attente tant que la pousse
  n'est pas à 100%.

## Actions groupées

Pensé pour une exploitation avec beaucoup de parcelles (dizaines de champs) où répéter la même
action une par une n'est plus praticable :

- **Protection météo groupée** — un bouton « Protéger toutes » (page `/parcels` et directement sur
  la carte météo du dashboard) protège en un clic toutes les parcelles possédées exposées au
  gel/canicule du jour et non déjà protégées, au même tarif que la protection individuelle
  (`POST /api/parcels/bulk/protect`).
- **Action groupée par étape** — la page `/parcels` regroupe les parcelles possédées sans action en
  cours par leur `parcel_next_action` (ex. « Semer céréales — 12 parcelles »). Choisir « Lancer sur
  toutes » ouvre une modale où l'on sélectionne une seule fois le matériel/graines (achat ou
  location) pour tout le groupe, puis `POST /api/parcels/bulk/actions` démarre l'action sur chaque
  parcelle éligible.
- **Pas de limite artificielle** : aucune notion de main d'œuvre limitée (voir plus haut, tarif
  fixe) — une action groupée démarre sur toutes les parcelles éligibles d'un coup. Seul le matériel
  réellement disponible (véhicules/accessoires non déjà occupés) peut faire échouer certaines
  parcelles ; celles-ci sont signalées dans la réponse, relancer la même action groupée plus tard
  reprend exactement là où elle s'est arrêtée puisqu'elle ne cible que les parcelles encore en
  attente de cette étape. Chaque parcelle passe par le même `action_service.start_action` que
  l'action individuelle (mêmes vérifications de stock, de véhicule disponible, de solde) — aucune
  règle dupliquée ou contournée pour le mode groupé.
