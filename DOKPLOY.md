# Déploiement Dokploy

## Service

Créer un projet puis un service **Docker Compose** (pas Stack) avec le fichier `docker-compose.prod.yml`. Activer les déploiements isolés.

Dokploy doit récupérer ce dossier depuis un dépôt Git. Le mode Raw ne contient pas les sources nécessaires aux instructions `build`.

## Variables d’environnement

Copier dans l’onglet **Environment** les quatre variables du fichier local `.env.production`. Ce fichier est exclu de Git et ne doit jamais être publié.

- `DB_PASSWORD`
- `JWT_SECRET`
- `INITIAL_USERNAME`
- `INITIAL_PASSWORD`

`INITIAL_PASSWORD` sert uniquement à créer le premier compte lorsque la base est vide. Il peut être supprimé de Dokploy après le premier déploiement réussi.

## Domaine

Dans **Domains**, ajouter le domaine sur le service `client` et le port interne `80`. Dokploy configure Traefik et HTTPS automatiquement. Ne pas exposer `db` ou `server` publiquement.

## Données et sauvegardes

PostgreSQL utilise le volume nommé `annuaire_postgres_data`. Configurer une sauvegarde planifiée de ce volume dans **Volume Backups** avant l’utilisation réelle.

## Vérification

- Service `db` : healthy
- Service `server` : healthy
- Service `client` : healthy
- `https://votre-domaine/health` renvoie `ok`
- Connexion avec le compte initial
