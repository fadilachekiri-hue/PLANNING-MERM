# Planning MERM — Hôpital Henri-Mondor

Application de gestion des plannings du service de radiothérapie (manipulateurs en électroradiologie médicale) : plannings, postes, binômes, congés/RTT, remplacements, notifications.

Ce guide est écrit pour une personne qui n'est **pas développeuse**. Suivez les étapes dans l'ordre, une seule fois pour la mise en place initiale.

---

## Ce qui a été fait, et ce qui reste à vérifier en conditions réelles

Le code complet a été écrit et **compile sans erreur** (vérifié avec `npm run build`). Toutes les fonctionnalités demandées sont implémentées : connexion par identifiant, invitations, gestion d'équipe, planning avec les 5 postes, binômes, demandes, remplacements, notifications, historique, PWA.

Ce qui **n'a pas encore pu être testé en conditions réelles**, faute d'avoir un projet Supabase et un compte Resend connectés à ce stade : l'envoi effectif d'un e-mail d'invitation, la réception réelle, l'installation sur un iPhone physique. Une fois les comptes créés (étapes ci-dessous), il faudra faire un premier essai complet avec un compte de test avant de l'utiliser avec toute l'équipe. Je resterai disponible pour corriger ce qui ne fonctionnerait pas.

**Point à trancher avec vous avant d'aller plus loin** : la règle "le X-STRAHL ne peut être programmé que si le Scanner est aussi prévu au même moment" n'est affichée pour l'instant que comme une alerte visuelle dans la Vue par postes — elle ne bloque rien. Avant de la rendre contraignante, il faut me confirmer si le Scanner et le X-STRAHL sont couverts par le même binôme ou par deux équipes distinctes.

---

## 1. Créer la base de données (Supabase) — gratuit

1. Allez sur [supabase.com](https://supabase.com), créez un compte, puis « New Project ».
2. Choisissez un nom (ex. `planning-merm`), un mot de passe de base de données (à conserver de côté), une région proche (Europe).
3. Une fois le projet créé, allez dans **SQL Editor** (menu de gauche) → **New query**.
4. Ouvrez le fichier `supabase/schema.sql` de ce dépôt, copiez tout son contenu, collez-le dans l'éditeur, cliquez **Run**. Cela crée toutes les tables, la sécurité et les 5 postes (aucune personne, aucun planning : base vierge).
5. Allez dans **Project Settings > API**. Notez trois valeurs, elles serviront à l'étape 3 :
   - `Project URL`
   - `anon public` key
   - `service_role` key (secrète — ne jamais la partager ni la publier)

## 2. Créer le compte d'envoi d'e-mails (Resend) — gratuit

1. Allez sur [resend.com](https://resend.com), créez un compte gratuit (jusqu'à 3000 e-mails/mois, 100/jour).
2. Dans **API Keys**, créez une clé et notez-la.
3. Pour commencer, vous pouvez envoyer depuis `onboarding@resend.dev` (déjà vérifié par Resend, mais visible comme expéditeur non personnalisé). Pour un envoi depuis une adresse comme `planning@votredomaine.fr`, il faudra vérifier un nom de domaine dans Resend (gratuit, mais nécessite d'avoir un nom de domaine — étape facultative, à voir plus tard si besoin).

## 3. Déployer l'application (Vercel) — gratuit pour démarrer

1. Allez sur [vercel.com](https://vercel.com), connectez-vous avec le compte GitHub `fadilachekiri-hue`.
2. **Add New > Project**, importez le dépôt `PLANNING-MERM`.
3. Avant de déployer, ouvrez **Environment Variables** et ajoutez :

   | Nom | Valeur |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | l'URL notée à l'étape 1 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la clé `anon public` |
   | `SUPABASE_SERVICE_ROLE_KEY` | la clé `service_role` (secrète) |
   | `RESEND_API_KEY` | la clé Resend |
   | `EMAIL_FROM` | `Planning MERM <onboarding@resend.dev>` (ou votre adresse vérifiée) |
   | `NEXT_PUBLIC_APP_URL` | l'adresse Vercel, ex. `https://planning-merm.vercel.app` (vous pouvez la mettre à jour après le premier déploiement une fois l'adresse connue) |
   | `SETUP_SECRET` | une suite de caractères longue et unique, inventée par vous (ex. via [1password.com/password-generator](https://1password.com/password-generator/)) |

4. Cliquez **Deploy**. Au bout de quelques minutes, l'application est en ligne à l'adresse indiquée par Vercel (du type `planning-merm-xxxx.vercel.app`, ou `planning-merm.vercel.app` si le nom est disponible).
5. Retournez dans les variables d'environnement, mettez à jour `NEXT_PUBLIC_APP_URL` avec l'adresse réelle obtenue, puis redéployez (**Deployments > ⋯ > Redeploy**). Cette adresse sert à fabriquer les liens dans les e-mails.

## 4. Créer votre compte (propriétaire)

1. Ouvrez `https://<votre-adresse>.vercel.app/premiere-configuration`.
2. Renseignez le **code d'installation** (la valeur de `SETUP_SECRET`), votre prénom, nom, et choisissez votre mot de passe.
3. Validez. Votre **identifiant** de connexion s'affiche (ex. `lisa.chlon-chekiri`) — notez-le, il vous servira à chaque connexion. Cette page ne fonctionne qu'une seule fois.

## 5. Ajouter Gloria comme administratrice

1. Menu **Équipe > + Ajouter un membre**. Renseignez son prénom, nom, fonction, et son adresse e-mail dès que vous l'aurez (vous pourrez la modifier plus tard sans perdre ses données).
2. Sur sa fiche, cliquez **Promouvoir administratrice** (visible seulement par vous, la propriétaire).
3. Cliquez **Envoyer une invitation** (nécessite son adresse e-mail) ou **Créer un lien d'accès** pour le lui transmettre vous-même (SMS, messagerie).

## 6. Ajouter un premier membre de l'équipe

1. **Équipe > + Ajouter un membre**, remplissez sa fiche.
2. **Envoyer une invitation** : un e-mail part avec un lien personnel.
   - Si l'envoi échoue (service non configuré, adresse invalide), l'erreur exacte s'affiche et un lien de secours apparaît à copier.
3. La personne reçoit l'e-mail, clique sur **Activer mon compte**, arrive directement sur l'application, choisit son mot de passe. Son identifiant s'affiche à l'écran. Elle accède ensuite au planning avec les droits d'un membre (lecture seule + ses propres demandes).
4. Pour se reconnecter plus tard : identifiant + mot de passe, sur la page de connexion normale — aucun e-mail nécessaire à chaque fois.

## 7. Créer et publier un planning

1. Menu **Planning**, naviguez jusqu'à la semaine voulue, cliquez **Créer cette semaine** (tout le personnel actif y est automatiquement inclus ; retirez ou ajoutez des personnes au besoin).
2. Cliquez **+ Ajouter** dans une case pour créer un créneau : travail (poste + horaires), congé, RTT, repos ou absence.
3. Une fois complet, cliquez **Publier le planning**. Les personnes concernées reçoivent une notification (dans l'application) et un e-mail si leur adresse est enregistrée.
4. **Vue par postes** montre la couverture de chaque machine et signale les manques d'effectif (à condition d'avoir défini des règles dans **Paramètres**).

## 8. Notifications — ce qui fonctionne vraiment

- **E-mail** : arrive dans la boîte mail même si l'application est fermée, dès qu'un envoi a réellement été accepté par Resend (sinon l'erreur est affichée, jamais un faux « envoyé »).
- **Notification dans l'application** (cloche/page Notifications) : visible seulement en ouvrant l'application — ce n'est **pas** une notification qui apparaît sur l'écran verrouillé du téléphone.
- Il n'y a pas, dans cette version, de vraie notification push sur téléphone (qui apparaîtrait même app fermée, écran verrouillé). C'est technique possible à ajouter plus tard si besoin, je peux vous expliquer le coût et l'effort le moment venu.
- Les SMS ne sont pas activés (payants, ~0,05 à 0,08 €/SMS selon le fournisseur) — à activer plus tard si vous le souhaitez.

## 9. Installer l'application

- **iPhone (Safari)** : ouvrez le lien → bouton Partager (carré avec flèche) → **Sur l'écran d'accueil**.
- **Android (Chrome)** : ouvrez le lien → menu ⋮ → **Installer l'application** (ou bandeau automatique proposé).
- **Mac (Safari 17+)** : menu **Fichier > Ajouter au Dock**. Sur Chrome : icône d'installation dans la barre d'adresse.
- **Windows (Chrome/Edge)** : icône d'installation (écran avec flèche) dans la barre d'adresse, ou menu ⋮ → **Installer Planning MERM**.
- Dans tous les cas, l'application reste aussi utilisable simplement depuis un navigateur, sans rien installer.

## 10. Partager l'application

Bouton **Partager l'application** en haut de chaque page (une fois connecté) : copie l'adresse générale de l'application. C'est différent d'un lien d'invitation personnel (à usage unique, lié à une personne) — ne transmettez jamais un lien d'activation à quelqu'un d'autre que son destinataire.

## 11. Demander des modifications plus tard

Toutes les données (personnel, plannings, demandes...) vivent dans Supabase, séparément du code. Une modification du code (nouvelle fonctionnalité, correction) ne touche jamais ces données, sauf si on ajoute explicitement une nouvelle table ou colonne (ce qui n'efface rien d'existant). Vous pouvez donc redemander des évolutions à tout moment sans perdre l'historique.

---

## Ce que je n'ai pas encore construit, à prioriser ensemble si besoin

- Sauvegardes automatiques régulières de la base (Supabase conserve un historique de restauration sur les projets payants ; sur le plan gratuit, pensez à exporter la base ponctuellement via **Database > Backups** ou `pg_dump`).
- Notifications push réelles sur téléphone (hors PWA basique).
- Export du planning en PDF/impression.
- Application de la règle X-STRAHL/Scanner en blocage strict (en attente de votre confirmation, voir en haut de ce document).

## Sécurité — ce qui est déjà en place

- Aucune donnée médicale de patient n'est stockée.
- Les mots de passe sont gérés par Supabase Auth (jamais stockés en clair, jamais dans le code).
- La clé secrète de la base (`service_role`) n'est utilisée que côté serveur, jamais envoyée au navigateur.
- Les droits (lecture seule pour les membres, actions réservées aux administratrices, seule la propriétaire peut créer une administratrice) sont vérifiés côté serveur ET dans la base de données (RLS), pas seulement en cachant des boutons à l'écran.
- Les liens d'invitation et de réinitialisation sont personnels, à usage unique, et expirent (7 jours pour l'invitation, 2 heures pour la réinitialisation).

Avant une utilisation officielle par le service, faites valider l'hébergement (Vercel + Supabase, tous deux hors de France par défaut sauf choix de région Europe) par la direction informatique / le DPO de l'hôpital, conformément au RGPD pour les données du personnel.
