# Frontend Verdance

Next.js App Router, TypeScript, Tailwind CSS et Three.js. Le lancement complet
avec Docker, le rythme de test et les règles météo sont décrits dans le
[README principal](../README.md). Les commandes de la carte sont détaillées dans
[La ferme en 3D](../docs/carte-3d.md).

```sh
npm ci
npm run dev
```

Le serveur de développement utilise le port 3000 : arrêter le conteneur frontend
avant de le lancer. Le frontend Docker est une compilation de production ;
reconstruire son image pour prendre en compte les changements.

```sh
npm run test:map
npm run build
```

Les modules Three.js sont dans `src/components/map/three/` : `createFarmScene.ts`
assemble la scène, `terrain.ts` calcule les hauteurs et passages des véhicules,
`weatherEffects.ts` gère les particules et l'atmosphère. Les données de parcelles
proviennent de l'API ; aucune météo de test n'est exposée dans l'application.
