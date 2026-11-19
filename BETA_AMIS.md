# JJCookieLabs — Bêta privée sur invitation

État : préparé sur la branche `beta-amis-2026-11`. La branche `main` reste inchangée.

## Inviter un ami

Dans le SQL Editor du projet Supabase `hkwnfxgrnyvyfprzvlyb`, exécuter **avec le rôle administrateur** :

```sql
SELECT lobbix_private.create_beta_invite('adresse-de-ton-ami@example.com');
```

Le résultat est un code d'invitation aléatoire à 48 caractères hexadécimaux. Le transmettre **en privé** à l'ami correspondant à cette adresse. Ne jamais publier le code dans GitHub, un article ou un canal public.

- Code valable 14 jours, une seule inscription.
- Un code est lié à une seule adresse de courrier électronique.
- Demander à l'ami de se rendre sur Lobbix, de choisir Inscription et de coller le code.
- Lors de la création de compte, la base Supabase vérifie le code *avant* de créer le compte.
- Ne pas partager les identifiants et mots de passe des comptes.

## Rétention

La tâche `lobbix-messages-retention-7d` exécute une suppression chaque cinq minutes. Les signalements directement associés aux messages sont également supprimés par la relation en cascade.

## Suppression du compte

Le bouton utilise la fonction Edge `lobbix-delete-account` : connexion existante + revalidation du mot de passe + confirmation SUPPRIMER. Le compte administrateur est explicitement protégé.

## Limites et publication

La sécurité des comptes et des messages Lobbix repose sur Supabase, **pas** sur le fait de garder secret le lien GitHub Pages. Le site statique demeure consultable publiquement. DragonNet conserve pour l'instant un accès public indépendant et n'est PAS inclus dans la restriction Lobbix. L'accès à Lobbix avec une invitation ne constitue pas une validation juridique. Le projet est créé par un mineur ; la désignation du responsable légal et les informations RGPD restent à valider avec un parent avant le lancement d'un service public.

Contact : jjcookielabs@monemail.com
