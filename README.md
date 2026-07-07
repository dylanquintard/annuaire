# Annuaire interne

Application privée d’annuaire et de gestion d’enquêtes. Chaque compte possède un espace totalement séparé : un compte ne peut jamais lire ni modifier les membres ou enquêtes d’un autre.

## Démarrage

1. Copier `.env.example` vers `.env`.
2. Remplacer les secrets dans `.env`. Renseigner `INITIAL_PASSWORD` avec le mot de passe initial.
3. Lancer `docker compose up -d --build` dans ce dossier.
4. Ouvrir http://localhost:8080 puis se connecter avec `moore`.

Le mot de passe initial est haché lors de la création du compte et n’est jamais enregistré en clair dans PostgreSQL. Le fichier `.env` est exclu de Git. Après le premier démarrage, modifier `INITIAL_PASSWORD` ne change pas le compte existant.

## Deuxième compte

Une fois connecté, utiliser **Créer un compte** dans le menu. Son annuaire et ses enquêtes seront indépendants et invisibles depuis le compte `moore`.
