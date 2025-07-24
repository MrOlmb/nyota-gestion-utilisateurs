```mermaid
erDiagram

        user_ministry_type {
            MINISTRE MINISTRE
DIRECTEUR_CABINET DIRECTEUR_CABINET
SECRETAIRE_GENERAL SECRETAIRE_GENERAL
DIRECTEUR DIRECTEUR
CHEF_SERVICE CHEF_SERVICE
INSPECTEUR INSPECTEUR
ANALYSTE ANALYSTE
ASSISTANT ASSISTANT
AUTRE AUTRE
        }
    


        user_school_type {
            DIRECTEUR DIRECTEUR
PROVISEUR PROVISEUR
CENSEUR CENSEUR
SURVEILLANT_GENERAL SURVEILLANT_GENERAL
ENSEIGNANT ENSEIGNANT
PERSONNEL_ADMIN PERSONNEL_ADMIN
COMPTABLE COMPTABLE
ELEVE ELEVE
PARENT PARENT
AUTRE AUTRE
        }
    


        type_etablissement {
            PRESCOLAIRE PRESCOLAIRE
PRIMAIRE PRIMAIRE
COLLEGE COLLEGE
LYCEE_GENERAL LYCEE_GENERAL
LYCEE_TECHNIQUE LYCEE_TECHNIQUE
SUPERIEUR SUPERIEUR
        }
    


        zone {
            URBAINE URBAINE
RURALE RURALE
        }
    


        secteur_etablissement {
            PUBLIC PUBLIC
PRIVE_SOUS_CONTRAT PRIVE_SOUS_CONTRAT
PRIVE_HORS_CONTRAT PRIVE_HORS_CONTRAT
        }
    


        statut_administratif {
            EN_ATTENTE EN_ATTENTE
AUTORISE AUTORISE
SUSPENDU SUSPENDU
FERME FERME
        }
    


        object_scope {
            MINISTRY MINISTRY
SCHOOL SCHOOL
COMMON COMMON
        }
    


        rule_type {
            HIERARCHY HIERARCHY
GEOGRAPHY GEOGRAPHY
OWNERSHIP OWNERSHIP
TENANT TENANT
CUSTOM CUSTOM
        }
    


        ui_element_type {
            FIELD FIELD
BUTTON BUTTON
MENU MENU
SECTION SECTION
PAGE PAGE
        }
    


        type_demande {
            CREATION CREATION
MODIFICATION MODIFICATION
FERMETURE FERMETURE
SUSPENSION SUSPENSION
REOUVERTURE REOUVERTURE
        }
    


        statut_demande {
            SOUMISE SOUMISE
EN_COURS EN_COURS
APPROUVEE APPROUVEE
REJETEE REJETEE
ANNULEE ANNULEE
        }
    


        statut_etape {
            EN_ATTENTE EN_ATTENTE
EN_COURS EN_COURS
TERMINEE TERMINEE
BLOQUEE BLOQUEE
ANNULEE ANNULEE
        }
    


        statut_autorisation {
            ACTIVE ACTIVE
SUSPENDUE SUSPENDUE
EXPIREE EXPIREE
REVOQUEE REVOQUEE
        }
    


        statut_infrastructure {
            OPERATIONNEL OPERATIONNEL
EN_MAINTENANCE EN_MAINTENANCE
HORS_SERVICE HORS_SERVICE
EN_CONSTRUCTION EN_CONSTRUCTION
        }
    


        type_budget {
            FONCTIONNEMENT FONCTIONNEMENT
INVESTISSEMENT INVESTISSEMENT
SUBVENTION SUBVENTION
        }
    


        statut_budget {
            PREVISIONNEL PREVISIONNEL
APPROUVE APPROUVE
EXECUTE EXECUTE
CLOTURE CLOTURE
        }
    


        statut_subvention {
            ATTRIBUEE ATTRIBUEE
VERSEE VERSEE
SUSPENDUE SUSPENDUE
ANNULEE ANNULEE
        }
    


        statut_inspection {
            PLANIFIEE PLANIFIEE
EN_COURS EN_COURS
TERMINEE TERMINEE
REPORTEE REPORTEE
ANNULEE ANNULEE
        }
    


        note_inspection {
            EXCELLENT EXCELLENT
BIEN BIEN
SATISFAISANT SATISFAISANT
INSUFFISANT INSUFFISANT
CRITIQUE CRITIQUE
        }
    
  "ministeres" {
    String id "🗝️"
    String nom 
    String nom_complet 
    String code 
    String acronyme "❓"
    String logo_url "❓"
    String site_web "❓"
    String email "❓"
    String telephone "❓"
    String adresse "❓"
    String ministre_actuel_id "❓"
    DateTime date_nomination "❓"
    Boolean est_actif 
    DateTime cree_le 
    DateTime modifie_le 
    }
  

  "users_ministry" {
    String id "🗝️"
    String email 
    String password_hash 
    String prenom 
    String nom 
    UserMinistryType type_utilisateur 
    String titre "❓"
    String manager_id "❓"
    String departement_id "❓"
    String departement_geo_id "❓"
    Boolean est_actif 
    DateTime derniere_connexion "❓"
    Int tentatives_echouees 
    DateTime verrou_jusqu_a "❓"
    DateTime mdp_change_a "❓"
    DateTime cree_le 
    DateTime modifie_le 
    }
  

  "users_school" {
    String id "🗝️"
    String email 
    String password_hash 
    String prenom 
    String nom 
    UserSchoolType type_utilisateur 
    String etablissement_id 
    String matricule "❓"
    DateTime date_naissance "❓"
    String classe "❓"
    String matiere_principale "❓"
    String parent_id "❓"
    Boolean est_actif 
    DateTime derniere_connexion "❓"
    Int tentatives_echouees 
    DateTime verrou_jusqu_a "❓"
    DateTime cree_le 
    DateTime modifie_le 
    }
  

  "departements" {
    String id "🗝️"
    String nom 
    String code 
    Boolean est_actif 
    }
  

  "districts" {
    String id "🗝️"
    String nom 
    String code 
    String departement_id 
    Boolean est_actif 
    }
  

  "communes" {
    String id "🗝️"
    String nom 
    String code 
    String code_postal "❓"
    String district_id 
    Boolean est_actif 
    }
  

  "arrondissements" {
    String id "🗝️"
    String nom 
    String code 
    String commune_id 
    Boolean est_actif 
    }
  

  "departements_ministeriels" {
    String id "🗝️"
    String nom 
    String code 
    String description "❓"
    String ministere_id 
    String departement_parent_id "❓"
    Boolean est_actif 
    }
  

  "etablissements" {
    String id "🗝️"
    String nom 
    String code_etablissement 
    TypeEtablissement type_etablissement 
    SecteurEtablissement secteur 
    StatutAdministratif statut_administratif 
    Zone zone 
    String adresse_complete 
    Decimal latitude "❓"
    Decimal longitude "❓"
    String departement_id 
    String district_id 
    String commune_id 
    String arrondissement_id "❓"
    String numero_telephone "❓"
    String email_officiel "❓"
    String site_web "❓"
    Int effectif_total_eleves 
    Int effectif_total_personnel 
    DateTime date_ouverture "❓"
    DateTime date_fermeture "❓"
    Boolean est_actif 
    DateTime cree_le 
    DateTime modifie_le 
    String cree_par_id 
    String modifie_par_id 
    }
  

  "security_groups_ministry" {
    String id "🗝️"
    String nom 
    String description "❓"
    Boolean est_systeme 
    Boolean est_actif 
    DateTime cree_le 
    DateTime modifie_le 
    }
  

  "security_groups_school" {
    String id "🗝️"
    String nom 
    String description "❓"
    String etablissement_id "❓"
    Boolean est_systeme 
    Boolean est_actif 
    DateTime cree_le 
    DateTime modifie_le 
    }
  

  "user_ministry_security_groups" {
    String user_id 
    String group_id 
    DateTime assigned_at 
    DateTime expires_at "❓"
    Boolean est_actif 
    }
  

  "user_school_security_groups" {
    String user_id 
    String group_id 
    DateTime assigned_at 
    DateTime expires_at "❓"
    Boolean est_actif 
    }
  

  "business_objects" {
    String id "🗝️"
    String nom 
    ObjectScope scope 
    String module 
    String description "❓"
    Boolean est_actif 
    DateTime cree_le 
    DateTime modifie_le 
    }
  

  "group_permissions_ministry" {
    String id "🗝️"
    String group_id 
    String object_id 
    Boolean peut_lire 
    Boolean peut_ecrire 
    Boolean peut_creer 
    Boolean peut_supprimer 
    Boolean peut_approuver 
    Json permissions_champs "❓"
    DateTime cree_le 
    DateTime modifie_le 
    }
  

  "group_permissions_school" {
    String id "🗝️"
    String group_id 
    String object_id 
    Boolean peut_lire 
    Boolean peut_ecrire 
    Boolean peut_creer 
    Boolean peut_supprimer 
    Json permissions_champs "❓"
    DateTime cree_le 
    DateTime modifie_le 
    }
  

  "visibility_rules_ministry" {
    String id "🗝️"
    String nom 
    String group_id 
    String object_id 
    RuleType type_regle 
    Json condition 
    Int priorite 
    Boolean est_active 
    DateTime cree_le 
    DateTime modifie_le 
    }
  

  "visibility_rules_school" {
    String id "🗝️"
    String nom 
    String group_id 
    String object_id 
    RuleType type_regle 
    Json condition 
    Int priorite 
    Boolean est_active 
    DateTime cree_le 
    DateTime modifie_le 
    }
  

  "ui_rules_ministry" {
    String id "🗝️"
    String group_id 
    String nom_element 
    UIElementType type_element 
    Boolean est_visible 
    Boolean est_actif 
    Json conditions "❓"
    DateTime cree_le 
    DateTime modifie_le 
    }
  

  "ui_rules_school" {
    String id "🗝️"
    String group_id 
    String nom_element 
    UIElementType type_element 
    Boolean est_visible 
    Boolean est_actif 
    Json conditions "❓"
    DateTime cree_le 
    DateTime modifie_le 
    }
  

  "demandes_etablissement" {
    String id "🗝️"
    TypeDemande type_demande 
    StatutDemande statut_demande 
    String etablissement_id "❓"
    String demandeur_id 
    String assigne_id "❓"
    String justification "❓"
    Json donnees_demande "❓"
    DateTime date_soumission 
    DateTime date_traitement "❓"
    String commentaires_traitement "❓"
    String traite_par_id "❓"
    DateTime cree_le 
    DateTime modifie_le 
    }
  

  "etapes_workflow" {
    String id "🗝️"
    String demande_id 
    String nom_etape 
    Int ordre_etape 
    StatutEtape statut_etape 
    String responsable_id "❓"
    DateTime date_debut "❓"
    DateTime date_fin "❓"
    String commentaires "❓"
    Json donnees_etape "❓"
    DateTime cree_le 
    DateTime modifie_le 
    }
  

  "journal_audit" {
    String id "🗝️"
    String user_ministry_id "❓"
    String user_school_id "❓"
    String etablissement_id "❓"
    String action 
    String module 
    String id_ressource "❓"
    String type_ressource "❓"
    Json details_avant "❓"
    Json details_apres "❓"
    String adresse_ip "❓"
    String user_agent "❓"
    DateTime cree_le 
    }
  

  "types_autorisation" {
    String id "🗝️"
    String nom 
    String code 
    String description "❓"
    Boolean est_obligatoire 
    Int duree_validite_mois "❓"
    Boolean est_actif 
    }
  

  "autorisations_etablissement" {
    String id "🗝️"
    String etablissement_id 
    String type_autorisation_id 
    String numero_autorisation 
    StatutAutorisation statut_autorisation 
    DateTime date_emission 
    DateTime date_expiration "❓"
    String conditions_particulieres "❓"
    String emise_par_id 
    DateTime cree_le 
    DateTime modifie_le 
    }
  

  "types_infrastructure" {
    String id "🗝️"
    String nom 
    String code 
    String description "❓"
    Boolean est_obligatoire 
    Boolean est_actif 
    }
  

  "infrastructures_etablissement" {
    String id "🗝️"
    String etablissement_id 
    String type_infrastructure_id 
    String nom_infrastructure 
    String description "❓"
    StatutInfrastructure statut_infrastructure 
    Int capacite "❓"
    Decimal surface_m2 "❓"
    DateTime date_construction "❓"
    DateTime date_derniere_renovation "❓"
    Decimal valeur_estimee "❓"
    String commentaires "❓"
    DateTime cree_le 
    DateTime modifie_le 
    }
  

  "budgets_etablissement" {
    String id "🗝️"
    String etablissement_id 
    Int annee_budgetaire 
    TypeBudget type_budget 
    Decimal montant_prevu 
    Decimal montant_realise "❓"
    StatutBudget statut_budget 
    String commentaires "❓"
    String cree_par_id 
    DateTime cree_le 
    DateTime modifie_le 
    }
  

  "subventions_etablissement" {
    String id "🗝️"
    String etablissement_id 
    String type_subvention 
    String organisme_financeur 
    Decimal montant_subvention 
    DateTime date_attribution 
    DateTime date_versement "❓"
    StatutSubvention statut_subvention 
    String conditions_utilisation "❓"
    DateTime cree_le 
    DateTime modifie_le 
    }
  

  "types_inspection" {
    String id "🗝️"
    String nom 
    String code 
    String description "❓"
    Boolean est_obligatoire 
    Int frequence_mois "❓"
    Boolean est_actif 
    }
  

  "inspections_etablissement" {
    String id "🗝️"
    String etablissement_id 
    String type_inspection_id 
    String numero_inspection 
    DateTime date_inspection 
    StatutInspection statut_inspection 
    String inspecteur_principal_id 
    String observations_generales "❓"
    NoteInspection note_globale "❓"
    String recommandations "❓"
    DateTime date_rapport "❓"
    Boolean conformite_reglementaire "❓"
    DateTime cree_le 
    DateTime modifie_le 
    }
  

  "criteres_inspection" {
    String id "🗝️"
    String type_inspection_id 
    String nom_critere 
    String description_critere "❓"
    Int poids_critere 
    Boolean est_obligatoire 
    Boolean est_actif 
    }
  

  "evaluations_criteres" {
    String id "🗝️"
    String inspection_id 
    String critere_id 
    NoteInspection note_critere 
    String commentaires_critere "❓"
    Boolean est_conforme 
    String actions_correctives "❓"
    DateTime cree_le 
    }
  
    "ministeres" o|--|o "users_ministry" : "ministreActuel"
    "ministeres" o{--}o "departements_ministeriels" : "departements"
    "users_ministry" o|--|| "UserMinistryType" : "enum:type_utilisateur"
    "users_ministry" o|--|o "users_ministry" : "manager"
    "users_ministry" o{--}o "users_ministry" : "subordonnes"
    "users_ministry" o|--|o "departements_ministeriels" : "departement"
    "users_ministry" o|--|o "departements" : "departementGeo"
    "users_ministry" o{--}o "user_ministry_security_groups" : "groupesSecurite"
    "users_ministry" o{--}o "etablissements" : "etablissementsCrees"
    "users_ministry" o{--}o "etablissements" : "etablissementsModifies"
    "users_ministry" o{--}o "demandes_etablissement" : "demandesCreees"
    "users_ministry" o{--}o "demandes_etablissement" : "demandesAssignees"
    "users_ministry" o{--}o "demandes_etablissement" : "demandesTraitees"
    "users_ministry" o{--}o "inspections_etablissement" : "inspectionsPrincipales"
    "users_ministry" o{--}o "journal_audit" : "journalAudit"
    "users_ministry" o{--}o "ministeres" : "ministere"
    "users_ministry" o{--}o "etapes_workflow" : "EtapeWorkflow"
    "users_ministry" o{--}o "autorisations_etablissement" : "AutorisationEtablissement"
    "users_ministry" o{--}o "budgets_etablissement" : "BudgetEtablissement"
    "users_school" o|--|| "UserSchoolType" : "enum:type_utilisateur"
    "users_school" o|--|| "etablissements" : "etablissement"
    "users_school" o|--|o "users_school" : "parent"
    "users_school" o{--}o "users_school" : "enfants"
    "users_school" o{--}o "user_school_security_groups" : "groupesSecurite"
    "users_school" o{--}o "journal_audit" : "journalAudit"
    "departements" o{--}o "districts" : "districts"
    "departements" o{--}o "etablissements" : "etablissements"
    "departements" o{--}o "users_ministry" : "usersMinistry"
    "districts" o|--|| "departements" : "departement"
    "districts" o{--}o "communes" : "communes"
    "districts" o{--}o "etablissements" : "etablissements"
    "communes" o|--|| "districts" : "district"
    "communes" o{--}o "arrondissements" : "arrondissements"
    "communes" o{--}o "etablissements" : "etablissements"
    "arrondissements" o|--|| "communes" : "commune"
    "arrondissements" o{--}o "etablissements" : "etablissements"
    "departements_ministeriels" o|--|| "ministeres" : "ministere"
    "departements_ministeriels" o|--|o "departements_ministeriels" : "parent"
    "departements_ministeriels" o{--}o "departements_ministeriels" : "enfants"
    "departements_ministeriels" o{--}o "users_ministry" : "usersMinistry"
    "etablissements" o|--|| "TypeEtablissement" : "enum:type_etablissement"
    "etablissements" o|--|| "SecteurEtablissement" : "enum:secteur"
    "etablissements" o|--|| "StatutAdministratif" : "enum:statut_administratif"
    "etablissements" o|--|| "Zone" : "enum:zone"
    "etablissements" o|--|| "departements" : "departement"
    "etablissements" o|--|| "districts" : "district"
    "etablissements" o|--|| "communes" : "commune"
    "etablissements" o|--|o "arrondissements" : "arrondissement"
    "etablissements" o|--|| "users_ministry" : "creePar"
    "etablissements" o|--|| "users_ministry" : "modifiePar"
    "etablissements" o{--}o "users_school" : "usersSchool"
    "etablissements" o{--}o "demandes_etablissement" : "demandes"
    "etablissements" o{--}o "autorisations_etablissement" : "autorisations"
    "etablissements" o{--}o "infrastructures_etablissement" : "infrastructures"
    "etablissements" o{--}o "budgets_etablissement" : "budgets"
    "etablissements" o{--}o "subventions_etablissement" : "subventions"
    "etablissements" o{--}o "inspections_etablissement" : "inspections"
    "etablissements" o{--}o "security_groups_school" : "groupesSecuriteSchool"
    "etablissements" o{--}o "journal_audit" : "journalAudit"
    "security_groups_ministry" o{--}o "user_ministry_security_groups" : "users"
    "security_groups_ministry" o{--}o "group_permissions_ministry" : "permissions"
    "security_groups_ministry" o{--}o "visibility_rules_ministry" : "visibilityRules"
    "security_groups_ministry" o{--}o "ui_rules_ministry" : "uiRules"
    "security_groups_school" o|--|o "etablissements" : "etablissement"
    "security_groups_school" o{--}o "user_school_security_groups" : "users"
    "security_groups_school" o{--}o "group_permissions_school" : "permissions"
    "security_groups_school" o{--}o "visibility_rules_school" : "visibilityRules"
    "security_groups_school" o{--}o "ui_rules_school" : "uiRules"
    "user_ministry_security_groups" o|--|| "users_ministry" : "user"
    "user_ministry_security_groups" o|--|| "security_groups_ministry" : "group"
    "user_school_security_groups" o|--|| "users_school" : "user"
    "user_school_security_groups" o|--|| "security_groups_school" : "group"
    "business_objects" o|--|| "ObjectScope" : "enum:scope"
    "business_objects" o{--}o "group_permissions_ministry" : "permissionsMinistry"
    "business_objects" o{--}o "group_permissions_school" : "permissionsSchool"
    "business_objects" o{--}o "visibility_rules_ministry" : "visibilityRulesMinistry"
    "business_objects" o{--}o "visibility_rules_school" : "visibilityRulesSchool"
    "group_permissions_ministry" o|--|| "security_groups_ministry" : "group"
    "group_permissions_ministry" o|--|| "business_objects" : "object"
    "group_permissions_school" o|--|| "security_groups_school" : "group"
    "group_permissions_school" o|--|| "business_objects" : "object"
    "visibility_rules_ministry" o|--|| "security_groups_ministry" : "group"
    "visibility_rules_ministry" o|--|| "business_objects" : "object"
    "visibility_rules_ministry" o|--|| "RuleType" : "enum:type_regle"
    "visibility_rules_school" o|--|| "security_groups_school" : "group"
    "visibility_rules_school" o|--|| "business_objects" : "object"
    "visibility_rules_school" o|--|| "RuleType" : "enum:type_regle"
    "ui_rules_ministry" o|--|| "security_groups_ministry" : "group"
    "ui_rules_ministry" o|--|| "UIElementType" : "enum:type_element"
    "ui_rules_school" o|--|| "security_groups_school" : "group"
    "ui_rules_school" o|--|| "UIElementType" : "enum:type_element"
    "demandes_etablissement" o|--|| "TypeDemande" : "enum:type_demande"
    "demandes_etablissement" o|--|| "StatutDemande" : "enum:statut_demande"
    "demandes_etablissement" o|--|o "etablissements" : "etablissement"
    "demandes_etablissement" o|--|| "users_ministry" : "demandeur"
    "demandes_etablissement" o|--|o "users_ministry" : "assigne"
    "demandes_etablissement" o|--|o "users_ministry" : "traitePar"
    "demandes_etablissement" o{--}o "etapes_workflow" : "etapesWorkflow"
    "etapes_workflow" o|--|| "demandes_etablissement" : "demande"
    "etapes_workflow" o|--|| "StatutEtape" : "enum:statut_etape"
    "etapes_workflow" o|--|o "users_ministry" : "responsable"
    "journal_audit" o|--|o "users_ministry" : "userMinistry"
    "journal_audit" o|--|o "users_school" : "userSchool"
    "journal_audit" o|--|o "etablissements" : "etablissement"
    "types_autorisation" o{--}o "autorisations_etablissement" : "autorisations"
    "autorisations_etablissement" o|--|| "etablissements" : "etablissement"
    "autorisations_etablissement" o|--|| "types_autorisation" : "typeAutorisation"
    "autorisations_etablissement" o|--|| "StatutAutorisation" : "enum:statut_autorisation"
    "autorisations_etablissement" o|--|| "users_ministry" : "emisePar"
    "types_infrastructure" o{--}o "infrastructures_etablissement" : "infrastructures"
    "infrastructures_etablissement" o|--|| "etablissements" : "etablissement"
    "infrastructures_etablissement" o|--|| "types_infrastructure" : "typeInfrastructure"
    "infrastructures_etablissement" o|--|| "StatutInfrastructure" : "enum:statut_infrastructure"
    "budgets_etablissement" o|--|| "etablissements" : "etablissement"
    "budgets_etablissement" o|--|| "TypeBudget" : "enum:type_budget"
    "budgets_etablissement" o|--|| "StatutBudget" : "enum:statut_budget"
    "budgets_etablissement" o|--|| "users_ministry" : "creePar"
    "subventions_etablissement" o|--|| "etablissements" : "etablissement"
    "subventions_etablissement" o|--|| "StatutSubvention" : "enum:statut_subvention"
    "types_inspection" o{--}o "inspections_etablissement" : "inspections"
    "types_inspection" o{--}o "criteres_inspection" : "criteres"
    "inspections_etablissement" o|--|| "etablissements" : "etablissement"
    "inspections_etablissement" o|--|| "types_inspection" : "typeInspection"
    "inspections_etablissement" o|--|| "StatutInspection" : "enum:statut_inspection"
    "inspections_etablissement" o|--|| "users_ministry" : "inspecteurPrincipal"
    "inspections_etablissement" o|--|o "NoteInspection" : "enum:note_globale"
    "inspections_etablissement" o{--}o "evaluations_criteres" : "evaluationsCriteres"
    "criteres_inspection" o|--|| "types_inspection" : "typeInspection"
    "criteres_inspection" o{--}o "evaluations_criteres" : "evaluations"
    "evaluations_criteres" o|--|| "inspections_etablissement" : "inspection"
    "evaluations_criteres" o|--|| "criteres_inspection" : "critere"
    "evaluations_criteres" o|--|| "NoteInspection" : "enum:note_critere"
```
