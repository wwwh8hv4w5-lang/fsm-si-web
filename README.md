# FSM SI — interface web

Interface de conversation pour **FSM SI**, le système multi-agents de F.S.M Game House.
Page statique (HTML/CSS/JS, sans serveur) qui parle directement à l'API GitHub depuis le navigateur.
Ce dépôt ne contient **aucune donnée ni aucun secret** : chacun colle son propre jeton, qui reste dans son navigateur.

## Jeton à créer
https://github.com/settings/personal-access-tokens/new — *Fine-grained*, compte propriétaire du dépôt `fsm-si`,
**Only select repositories → fsm-si**, permissions du dépôt :

| Permission | Niveau |
|---|---|
| Issues | Read and write |
| Contents | Read and write (envoi de fichiers dans `entree/`) |
| Actions | Read-only |
| Metadata | Read-only (automatique) |

## Fonctions
Conversations (issues), réponses en direct, commandes rapides, validations, fichiers joints (photos, appareil photo, coller, glisser-déposer, PDF/Word/Excel/ZIP…) déposés dans `entree/<n°>/`,
fichiers livrés (`sorties/<n°>/`) avec aperçus et téléchargement, projets, tâches planifiées, mémoire, activité du robot, recherche,
renommer/archiver/rouvrir, modifier/copier un message, dictée vocale, brouillons, notifications, thème clair/sombre, installation sur l'écran d'accueil.

Bibliothèques incluses : [marked](https://github.com/markedjs/marked) (MIT) et [DOMPurify](https://github.com/cure53/DOMPurify) (Apache-2.0/MPL-2.0).
