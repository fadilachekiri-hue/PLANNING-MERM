-- ============================================================================
-- PLANNING MERM — schéma de base de données (Supabase / PostgreSQL)
-- À exécuter une seule fois dans Supabase > SQL Editor sur un projet neuf.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- PROFILS (un profil = un compte, lié à auth.users)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  identifiant text not null unique,          -- utilisé pour se connecter (ex: lisa.chekiri)
  auth_email text not null unique,           -- adresse technique interne (identifiant@merm.local), jamais utilisée pour envoyer un e-mail
  contact_email text,                        -- vraie adresse e-mail, pour invitations/notifications
  phone text,
  first_name text not null,
  last_name text not null,
  role text not null default 'member' check (role in ('owner','admin','member')),
  status text not null default 'pending' check (status in ('pending','active','disabled')),
  job_title text,                            -- fonction
  contracted_hours numeric(5,2) default 35,
  usual_days text,                           -- texte libre : jours habituels
  usual_hours text,                          -- texte libre : horaires habituels
  shift_preference text default 'none' check (shift_preference in ('morning','evening','none')),
  overtime_ok boolean default false,
  notes text,
  import_key text,                           -- clé stable (nom d'origine du fichier importé), ne change jamais même si le prénom/nom est corrigé — sert à éviter les doublons si l'import est relancé
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_status_idx on public.profiles(status);

-- Annuaire public restreint (aucune coordonnée sensible), visible par tout
-- utilisateur connecté. Comme cette vue n'est pas "security_invoker", elle
-- s'exécute avec les droits de son propriétaire : elle peut donc exposer ces
-- quelques colonnes même si la table profiles, elle, reste verrouillée par RLS.
create view public.directory as
  select id, first_name, last_name, role, status, shift_preference, job_title
  from public.profiles;

-- ----------------------------------------------------------------------------
-- POSTES (machines)
-- ----------------------------------------------------------------------------
create table public.machines (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color_hex text not null,
  active boolean not null default true,      -- false = retiré des nouveaux plannings (historique conservé)
  position int not null default 0,
  requires_machine_id uuid references public.machines(id),  -- ex: X-STRAHL nécessite Scanner en parallèle (règle à confirmer avant activation)
  created_at timestamptz not null default now()
);

-- Fermeture temporaire d'un poste (maintenance, panne...). N'affecte pas
-- l'historique ni les créneaux déjà planifiés : sert à exclure ce poste des
-- alertes d'effectif et à le signaler dans la Vue par postes pour la
-- période concernée. Heures nulles = fermé toute la journée.
create table public.machine_closures (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.machines(id) on delete cascade,
  date date not null,
  start_time time,
  end_time time,
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index machine_closures_date_idx on public.machine_closures(machine_id, date);

insert into public.machines (name, color_hex, position) values
  ('Clinac', '#c9a227', 1),
  ('Unity', '#1e3a8a', 2),
  ('Scanner', '#16a34a', 3),
  ('Versa HD', '#ec4899', 4),
  ('X-STRAHL', '#d6c7a1', 5);

-- Poste historique conservé pour ne pas casser les anciennes données, mais
-- exclu des nouveaux plannings (active = false).
insert into public.machines (name, color_hex, position, active) values
  ('Clinac 2', '#8a7a1f', 99, false);

-- ----------------------------------------------------------------------------
-- COMPÉTENCES PAR POSTE (niveau de formation de chaque manipulateur)
-- ----------------------------------------------------------------------------
create table public.competencies (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  machine_id uuid not null references public.machines(id) on delete cascade,
  level text not null default 'none' check (level in ('none','training','autonomous')),
  updated_at timestamptz not null default now(),
  primary key (profile_id, machine_id)
);

-- Règles de composition des binômes, définies par la cadre, par poste
create table public.pairing_rules (
  machine_id uuid primary key references public.machines(id) on delete cascade,
  min_autonomous int not null default 1,     -- nb minimum de personnes autonomes requis
  team_size int not null default 2,          -- effectif attendu sur ce poste
  allow_training_with_supervisor boolean not null default false,
  notes text,
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- SEMAINES DE PLANNING
-- ----------------------------------------------------------------------------
create table public.weeks (
  id uuid primary key default gen_random_uuid(),
  start_date date not null unique,           -- lundi de la semaine
  status text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  published_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- APPARTENANCE À UNE SEMAINE (qui apparaît dans le planning de cette semaine)
-- Permet de "retirer du planning" une personne pour une semaine précise sans
-- toucher aux autres semaines ni à son compte.
-- ----------------------------------------------------------------------------
create table public.week_members (
  week_id uuid not null references public.weeks(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (week_id, profile_id)
);

-- ----------------------------------------------------------------------------
-- CRÉNEAUX (travail, congé, RTT, repos, absence)
-- ----------------------------------------------------------------------------
create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.weeks(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0 = lundi
  start_time time,
  end_time time,
  shift_type text not null check (shift_type in ('work','conge','rtt','repos','absence')),
  machine_id uuid references public.machines(id),   -- uniquement si shift_type = 'work'
  pair_id uuid,                                      -- même valeur = binôme lié sur le même créneau/poste
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shifts_week_idx on public.shifts(week_id);
create index shifts_profile_idx on public.shifts(profile_id);
create index shifts_pair_idx on public.shifts(pair_id);

-- ----------------------------------------------------------------------------
-- EFFECTIFS MINIMUMS PAR POSTE / JOUR / CRÉNEAU
-- ----------------------------------------------------------------------------
create table public.min_staffing (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.machines(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  min_count int not null default 1
);

-- ----------------------------------------------------------------------------
-- DISPONIBILITÉS / INDISPONIBILITÉS RÉCURRENTES
-- ----------------------------------------------------------------------------
create table public.availabilities (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time,
  end_time time,
  kind text not null check (kind in ('available','unavailable')),
  note text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- DEMANDES DE CONGÉ / RTT / ABSENCE / INDISPONIBILITÉ
-- ----------------------------------------------------------------------------
create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('conge','rtt','absence','indisponibilite')),
  date_start date not null,
  date_end date not null,
  comment text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  decision_comment text,
  created_at timestamptz not null default now()
);
create index leave_requests_profile_idx on public.leave_requests(profile_id);
create index leave_requests_status_idx on public.leave_requests(status);

-- ----------------------------------------------------------------------------
-- RECHERCHE DE REMPLAÇANT
-- ----------------------------------------------------------------------------
create table public.replacement_requests (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid references public.shifts(id) on delete set null,
  day date not null,
  start_time time not null,
  end_time time not null,
  machine_id uuid references public.machines(id),
  reason text,
  status text not null default 'open' check (status in ('open','filled','cancelled')),
  created_by uuid references public.profiles(id) on delete set null,
  filled_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.replacement_candidates (
  request_id uuid not null references public.replacement_requests(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  response text check (response in ('available','unavailable')),
  responded_at timestamptz,
  primary key (request_id, profile_id)
);

-- ----------------------------------------------------------------------------
-- NOTIFICATIONS
-- ----------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_profile_idx on public.notifications(profile_id, read_at);

-- ----------------------------------------------------------------------------
-- JETONS D'ACCÈS (invitation / réinitialisation de mot de passe)
-- Table utilisée uniquement par le serveur (clé service_role) — jamais
-- exposée directement au navigateur.
-- ----------------------------------------------------------------------------
create table public.access_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  type text not null check (type in ('invite','reset')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index access_tokens_profile_idx on public.access_tokens(profile_id);

-- ----------------------------------------------------------------------------
-- JOURNAL DES E-MAILS (statut honnête d'envoi)
-- ----------------------------------------------------------------------------
create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  subject text not null,
  category text not null,
  status text not null check (status in ('sent','failed')),
  error text,
  profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- HISTORIQUE DES ACTIONS IMPORTANTES
-- ----------------------------------------------------------------------------
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log(created_at desc);

-- ============================================================================
-- FONCTIONS UTILITAIRES POUR LES POLITIQUES DE SÉCURITÉ (RLS)
-- ============================================================================
create or replace function public.current_role_v()
returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin_or_owner()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('owner','admin') from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_owner()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'owner' from public.profiles where id = auth.uid()), false);
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.machines enable row level security;
alter table public.competencies enable row level security;
alter table public.pairing_rules enable row level security;
alter table public.weeks enable row level security;
alter table public.week_members enable row level security;
alter table public.shifts enable row level security;
alter table public.min_staffing enable row level security;
alter table public.availabilities enable row level security;
alter table public.leave_requests enable row level security;
alter table public.replacement_requests enable row level security;
alter table public.replacement_candidates enable row level security;
alter table public.notifications enable row level security;
alter table public.access_tokens enable row level security;
alter table public.email_log enable row level security;
alter table public.audit_log enable row level security;

-- PROFILES : chacun voit et modifie certains champs de son propre profil ;
-- admins/owner voient et gèrent tout le monde.
create policy profiles_select_self_or_admin on public.profiles
  for select using (id = auth.uid() or public.is_admin_or_owner());
create policy profiles_update_admin on public.profiles
  for update using (public.is_admin_or_owner());
create policy profiles_update_self_limited on public.profiles
  for update using (id = auth.uid());
create policy profiles_insert_admin on public.profiles
  for insert with check (public.is_admin_or_owner());
create policy profiles_delete_admin on public.profiles
  for delete using (public.is_admin_or_owner());

-- MACHINES / RÈGLES DE BINÔMES / EFFECTIFS MINIMUMS : lecture pour tous les
-- connectés, écriture réservée aux administratrices.
create policy machines_select_all on public.machines for select using (auth.uid() is not null);
create policy machines_write_admin on public.machines for all using (public.is_admin_or_owner()) with check (public.is_admin_or_owner());

create policy pairing_rules_select_all on public.pairing_rules for select using (auth.uid() is not null);
create policy pairing_rules_write_admin on public.pairing_rules for all using (public.is_admin_or_owner()) with check (public.is_admin_or_owner());

create policy min_staffing_select_all on public.min_staffing for select using (auth.uid() is not null);
create policy min_staffing_write_admin on public.min_staffing for all using (public.is_admin_or_owner()) with check (public.is_admin_or_owner());

alter table public.machine_closures enable row level security;
create policy machine_closures_select_all on public.machine_closures for select using (auth.uid() is not null);
create policy machine_closures_write_admin on public.machine_closures for all using (public.is_admin_or_owner()) with check (public.is_admin_or_owner());

-- COMPÉTENCES : visibles par la personne concernée et les administratrices ;
-- modifiables uniquement par les administratrices.
create policy competencies_select on public.competencies
  for select using (profile_id = auth.uid() or public.is_admin_or_owner());
create policy competencies_write_admin on public.competencies
  for all using (public.is_admin_or_owner()) with check (public.is_admin_or_owner());

-- SEMAINES : les membres ne voient que les semaines publiées, les
-- administratrices voient tout.
create policy weeks_select on public.weeks
  for select using (status = 'published' or public.is_admin_or_owner());
create policy weeks_write_admin on public.weeks
  for all using (public.is_admin_or_owner()) with check (public.is_admin_or_owner());

-- APPARTENANCE À UNE SEMAINE : mêmes règles de visibilité que les semaines.
create policy week_members_select on public.week_members
  for select using (
    public.is_admin_or_owner()
    or exists (select 1 from public.weeks w where w.id = week_id and w.status = 'published')
  );
create policy week_members_write_admin on public.week_members
  for all using (public.is_admin_or_owner()) with check (public.is_admin_or_owner());

-- CRÉNEAUX : un membre voit uniquement les créneaux des semaines publiées ;
-- les administratrices voient et gèrent tout, y compris les brouillons.
create policy shifts_select on public.shifts
  for select using (
    public.is_admin_or_owner()
    or exists (select 1 from public.weeks w where w.id = week_id and w.status = 'published')
  );
create policy shifts_write_admin on public.shifts
  for all using (public.is_admin_or_owner()) with check (public.is_admin_or_owner());

-- DISPONIBILITÉS : chacun gère les siennes ; administratrices voient tout.
create policy availabilities_select on public.availabilities
  for select using (profile_id = auth.uid() or public.is_admin_or_owner());
create policy availabilities_write_self on public.availabilities
  for all using (profile_id = auth.uid() or public.is_admin_or_owner())
  with check (profile_id = auth.uid() or public.is_admin_or_owner());

-- DEMANDES DE CONGÉ/RTT/ABSENCE : chacun crée et voit les siennes ;
-- administratrices voient tout et décident.
create policy leave_requests_select on public.leave_requests
  for select using (profile_id = auth.uid() or public.is_admin_or_owner());
create policy leave_requests_insert_self on public.leave_requests
  for insert with check (profile_id = auth.uid());
create policy leave_requests_update_admin on public.leave_requests
  for update using (public.is_admin_or_owner());

-- REMPLACEMENTS : administratrices créent/gèrent ; les personnes ciblées
-- voient les demandes qui les concernent (via replacement_candidates).
create policy replacement_requests_select on public.replacement_requests
  for select using (
    public.is_admin_or_owner()
    or exists (select 1 from public.replacement_candidates c where c.request_id = id and c.profile_id = auth.uid())
  );
create policy replacement_requests_write_admin on public.replacement_requests
  for all using (public.is_admin_or_owner()) with check (public.is_admin_or_owner());

create policy replacement_candidates_select on public.replacement_candidates
  for select using (profile_id = auth.uid() or public.is_admin_or_owner());
create policy replacement_candidates_insert_admin on public.replacement_candidates
  for insert with check (public.is_admin_or_owner());
create policy replacement_candidates_update_self on public.replacement_candidates
  for update using (profile_id = auth.uid() or public.is_admin_or_owner());

-- NOTIFICATIONS : chacun voit et marque comme lues les siennes uniquement.
create policy notifications_select_self on public.notifications
  for select using (profile_id = auth.uid());
create policy notifications_update_self on public.notifications
  for update using (profile_id = auth.uid());
create policy notifications_write_admin on public.notifications
  for insert with check (public.is_admin_or_owner());

-- ACCESS_TOKENS / EMAIL_LOG : aucune politique = uniquement accessible via la
-- clé service_role côté serveur (jamais exposée au navigateur).

-- AUDIT_LOG : lecture réservée aux administratrices ; écriture serveur.
create policy audit_log_select_admin on public.audit_log
  for select using (public.is_admin_or_owner());

-- ============================================================================
-- DÉCLENCHEUR : maintien à jour de updated_at
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================================
-- PROTECTION DES CHAMPS SENSIBLES DU PROFIL
-- La policy RLS "profiles_update_self_limited" autorise un membre à mettre à
-- jour SA PROPRE ligne, mais ne peut pas restreindre QUELLES colonnes sont
-- modifiées. Ce déclencheur applique cette limite réellement côté serveur :
-- un membre ne peut changer que ses préférences, jamais son rôle, son statut,
-- ses heures contractuelles ou d'autres champs gérés par les administratrices.
-- ============================================================================
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin_or_owner() or auth.role() = 'service_role' then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.identifiant is distinct from old.identifiant
     or new.auth_email is distinct from old.auth_email
     or new.contracted_hours is distinct from old.contracted_hours
     or new.contact_email is distinct from old.contact_email
     or new.phone is distinct from old.phone
     or new.job_title is distinct from old.job_title
     or new.usual_days is distinct from old.usual_days
     or new.usual_hours is distinct from old.usual_hours
     or new.notes is distinct from old.notes
     or new.first_name is distinct from old.first_name
     or new.last_name is distinct from old.last_name
  then
    raise exception 'Modification non autorisée : seules vos préférences (matin/soir, heures supplémentaires) peuvent être modifiées par vous-même.';
  end if;

  return new;
end;
$$;

create trigger profiles_protect_columns before update on public.profiles
  for each row execute function public.protect_profile_columns();
create trigger shifts_set_updated_at before update on public.shifts
  for each row execute function public.set_updated_at();
create trigger competencies_set_updated_at before update on public.competencies
  for each row execute function public.set_updated_at();
create trigger pairing_rules_set_updated_at before update on public.pairing_rules
  for each row execute function public.set_updated_at();

-- ============================================================================
-- FIN — base vierge : aucun personnel, aucun planning, aucune demande.
-- La toute première administratrice (Lisa) est créée séparément, voir
-- README.md § "Créer le tout premier compte propriétaire".
-- ============================================================================
