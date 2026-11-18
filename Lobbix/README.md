# Lobbix 1.0 · SafeGuard 2.0

Application statique : `index.html`, `static/v1.css`, `static/v1.js` et `static/screen-share.js`. L’authentification et les opérations partagées utilisent le projet Supabase existant. Aucun changement de forfait ni service payant ajouté.

## Comportements

- Navigation en haut du lobby. La discussion occupe l’espace principal par défaut, puis devient une conversation latérale refermable pendant les activités. Sur mobile, le bouton Conversation ouvre un panneau superposé.
- Plusieurs activités indépendantes : tableau blanc, roue de choix, sondage, morpion et défi calcul. Chaque membre peut les démarrer depuis le catalogue.
- Tableau blanc partagé : coordonnées normalisées, transmission des nouveaux tracés, vote à la majorité des participants pour effacer. Le dessin s’efface lorsque le dernier participant quitte le tableau, avec un délai de présence de 90 secondes en cas de fermeture brutale.
- Morpion : deux joueurs, tours et victoire vérifiés côté serveur ; trois points par victoire, un par joueur en cas d’égalité. Défi calcul : cinq questions, deux minutes par participant, deux points par bonne réponse. Classement propre au lobby.
- Lobbies publics ou privés. Une invitation privée contient seulement l’identifiant du lobby ; le mot de passe se partage séparément. Hash bcrypt inaccessible aux clients ; cinq essais par minute et par compte.
- Expiration contrôlée côté serveur : durée maximale, ou délai configuré après le départ du dernier membre. Lorsqu’une page disparaît sans notification, sa présence expire après 90 secondes. Le lobby Random reste permanent. La fermeture interdit les entrées et les messages ; les enregistrements existants sont conservés.
- Partage d’écran vidéo sans audio : autorisation explicite du navigateur, un présentateur par lobby, dix minutes par présentation, une minute d’attente par compte après l’arrêt, nombre de présentations illimité. Un rechargement arrête la capture et le partage précédent. Les navigateurs sans capture compatible peuvent regarder.
- Photos de fond locales, import automatique, lien HTTPS facultatif et réglage d’opacité conservés. Session d’authentification propre à chaque onglet via `sessionStorage` : conservée au rechargement. La restauration d’onglets après fermeture dépend aussi du navigateur.

## SafeGuard 2.0

`server/index.ts` est la fonction Edge `lobbix-safeguard`, avec JWT obligatoire. L’identité provient du jeton authentifié. La clé privilégiée reste côté serveur. Les clients ne peuvent pas publier directement dans les nouvelles tables.

`server/moderation.js` applique des règles explicites aux messages, pseudos, noms et descriptions de lobbies, sondages et roues : normalisation Unicode, certaines variantes d’insultes, avertissements pour propos blessants, blocage de menaces et de certaines sollicitations inappropriées, coordonnées personnelles détectables, liens/code dangereux et répétitions. Les limites de fréquence, doublons et suspensions restent contrôlées par le serveur. Ce filtre ne garantit pas de reconnaître tous les abus ni toutes les informations personnelles.

Les dessins et les flux vidéo ne sont pas analysés automatiquement. Les membres peuvent les signaler ; l’administration peut fermer une activité ou un partage depuis sa file de signalements. Les messages restent également signalables.

## Installation serveur

1. Appliquer `server/database_v1.sql` comme migration Supabase. Cette migration ajoute un schéma privé, des tables et des RPC aux objets Lobbix existants ; elle ne supprime aucun compte, message ni lobby existant.
2. Déployer `server/index.ts` et `server/moderation.js` dans `lobbix-safeguard`, avec vérification JWT activée. Dépendance : `npm:@supabase/server@1.9.2`.
3. Publier le dossier Lobbix complet sur GitHub Pages. Ne pas publier `tests/node_modules` ni `tests/artifacts`.

Les anciens points d’entrée SafeGuard restent compatibles pendant la mise à jour des navigateurs. Les RPC `lobbix_v1_*` utilisent le schéma privé et vérifient l’identité, la présence et l’expiration. Les tables nouvelles ont la RLS activée et les écritures des clients sont refusées.

Le partage utilise WebRTC entre participants, avec STUN et sans relais TURN ajouté. Certains réseaux restrictifs empêcheront la connexion vidéo. Les dix minutes sont appliquées par le client officiel et par la signalisation serveur ; ce système ne peut pas couper physiquement une connexion directe entre clients modifiés. Ajouter un relais contrôlé serait nécessaire pour cette garantie.

## Vérifications reproductibles

Avec Node.js 24 et les dépendances npm disponibles :

```sh
cd Lobbix/tests
npm ci
npm test
```

Les tests n’utilisent aucun compte ni donnée de production. Ils exécutent le SQL réel dans PGlite avec pgcrypto, le gestionnaire TypeScript SafeGuard avec une enveloppe d’authentification simulée, et trois interfaces JSDOM dont deux membres reliés à la même base de test.

La suite couvre 159 vérifications : expiration et conservation des messages, permissions et accès privés, votes et dessins, jeux et points, signalements et administration, limites de partage, modération et appels Edge, navigation, conversation latérale, import de fond disponible et inscription. Le test WebRTC utilise deux connexions natives pour négocier les pistes et vérifier l’arrêt à l’échéance. Le transport réel d’images entre appareils n’a pas pu être vérifié dans l’environnement d’exécution, qui bloque l’énumération des interfaces réseau.

La validation finale sur deux appareils doit inclure : accepter la capture, recevoir l’image, arrêter depuis le navigateur, vérifier le délai d’une minute, puis relancer ; laisser également une session atteindre dix minutes. Les limites temporelles et les autorisations de signalisation sont déjà vérifiées par les tests isolés.
