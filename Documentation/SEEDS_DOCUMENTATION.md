# 📚 Documentation des Seeds NYOTA

## Vue d'Ensemble

Les scripts de seed ont été mis à jour pour refléter la nouvelle structure du schéma avec :
- **Séparation des utilisateurs** : `UserMinistry` et `UserSchool`
- **Hiérarchie administrative flexible** : Ministère → Administrations → Structures Administratives
- **15 départements du Congo** (incluant les 3 nouveaux de 2024)
- **Zone urbaine/rurale** pour les établissements
- **Arrondissements** pour Brazzaville et Pointe-Noire

## 🗂️ Structure des Seeds

### 1. `00-reset.seed.ts` - Réinitialisation
Supprime toutes les données dans le bon ordre pour éviter les conflits de clés étrangères.

### 2. `01-reference-data.seed.ts` - Données de Référence
Crée les données de base :
- **15 départements** avec leurs codes
- **Districts** pour chaque département
- **Communes** et **arrondissements**
- **Objets métier** (37 au total)
- **Types** d'autorisation, infrastructure et inspection
- **Critères d'inspection**

### 3. `02-security-groups.seed.ts` - Groupes de Sécurité
Crée les groupes et permissions :
- **12 groupes ministère** (Super Admin, Cabinet, Directeurs, etc.)
- **15 groupes école** (Direction, Enseignants, Élèves, etc.)
- **Permissions** par groupe et objet métier
- **Règles de visibilité** (géographique, hiérarchique, tenant)
- **Règles UI** (masquage de champs/boutons)

### 4. `03-admin-user.seed.ts` - Utilisateurs et Structure
Crée la structure complète :
- **1 Ministère** (MEPSA)
- **3 Administrations** (Cabinet, SG, Inspection)
- **15+ Structures administratives** (hiérarchisées)
- **9 Utilisateurs ministère**
- **8 Utilisateurs école**
- **3 Établissements** (2 urbains, 1 rural)

## 🏗️ Structure Administrative Créée

```
MEPSA (Ministère)
├── Cabinet du Ministre
│   ├── Cabinet du Ministre (Structure)
│   └── Conseillers du Ministre
├── Secrétariat Général
│   ├── Secrétariat Général (Structure)
│   ├── Direction de l'Enseignement Primaire
│   │   └── Service des Statistiques - Primaire
│   ├── Direction de l'Enseignement Secondaire
│   │   └── Service des Examens et Concours
│   ├── Direction des Ressources Humaines
│   ├── Direction des Affaires Financières
│   ├── Direction de la Planification
│   ├── Délégation Départementale de Brazzaville
│   └── Délégation Départementale de Pointe-Noire
└── Inspection Générale
    ├── Inspection Générale (Structure)
    ├── Inspection du Primaire
    └── Inspection du Secondaire
```

## 👥 Utilisateurs Créés

### Ministère (9 utilisateurs)
| Rôle | Email | Structure | Groupe |
|------|-------|-----------|--------|
| Super Admin | admin@mepsa.gouv.cg | Secrétariat Général | Super Administrateurs |
| Ministre | ministre@mepsa.gouv.cg | Cabinet | Cabinet Ministériel |
| Directeur Cabinet | dircab@mepsa.gouv.cg | Cabinet | Cabinet Ministériel |
| Secrétaire Général | sg@mepsa.gouv.cg | Secrétariat Général | Secrétariat Général |
| Inspecteur Général | ig@mepsa.gouv.cg | Inspection Générale | Directeurs Généraux |
| Dir. Primaire | dep@mepsa.gouv.cg | Dir. Enseignement Primaire | Directeurs Centraux |
| Dir. Secondaire | des@mepsa.gouv.cg | Dir. Enseignement Secondaire | Directeurs Centraux |
| Délégué Brazza | dd.brazza@mepsa.gouv.cg | Délégation Brazzaville | Délégués Régionaux |
| Inspecteur | insp.primaire@mepsa.gouv.cg | Inspection Primaire | Inspecteurs |

### École (8 utilisateurs)
| Rôle | Email | Établissement | Groupe |
|------|-------|---------------|--------|
| Directeur EP | directeur.epfrat@education.cg | École Primaire Fraternité | Direction |
| Proviseur | proviseur.sankara@education.cg | Lycée Thomas Sankara | Direction |
| Censeur | censeur.sankara@education.cg | Lycée Thomas Sankara | Censeurs |
| Prof Maths | prof.maths@sankara.education.cg | Lycée Thomas Sankara | Enseignants |
| Prof Français | prof.francais@epfrat.education.cg | École Primaire Fraternité | Enseignants |
| Élève Lycée | grace.moukassa@sankara.education.cg | Lycée Thomas Sankara | Élèves |
| Élève Primaire | jean.biyoudi@epfrat.education.cg | École Primaire Fraternité | Élèves |
| Parent | parent.moukassa@gmail.com | Lycée Thomas Sankara | Parents |

**Mot de passe par défaut** : `ChangeMe2024!`

## 🏫 Établissements Créés

1. **École Primaire de la Fraternité** (EP-FRAT-001)
   - Type : Primaire, Public, Urbain
   - Localisation : Makélékélé, Brazzaville
   - Effectif : 450 élèves, 22 personnels

2. **Lycée Thomas Sankara** (LYC-SANK-001)
   - Type : Lycée Général, Public, Urbain
   - Localisation : Bacongo, Brazzaville
   - Effectif : 1200 élèves, 85 personnels

3. **École Primaire de Mbanza** (EP-MBANZA-001)
   - Type : Primaire, Public, Rural
   - Localisation : Kinkala, Pool
   - Effectif : 120 élèves, 6 personnels

## 🔐 Modèle de Sécurité Implémenté

### Couche 2 : Permissions (ACL)
- **Super Admin Ministère** : Accès total aux objets MINISTRY et COMMON
- **Cabinet** : Lecture sur tout, approbation sur décisions stratégiques
- **Directeurs** : CRUD sur leur domaine, pas de suppression
- **Inspecteurs** : Création/modification des rapports d'inspection
- **Direction École** : Gestion complète sauf suppression
- **Enseignants** : Gestion notes, présences, discipline
- **Élèves** : Lecture seule sur leurs données

### Couche 3 : Visibilité (RLS)
- **Géographique** : Délégués régionaux voient seulement leur département
- **Hiérarchique** : Chefs voient leurs structures subordonnées
- **Tenant** : Isolation stricte par établissement pour les écoles
- **Custom** : Enseignants voient seulement leurs classes

### Couche 4 : UI
- Masquage des champs sensibles (salaires, données médicales)
- Désactivation des boutons dangereux (suppression permanente)
- Adaptation de l'interface selon le groupe

## 🚀 Commandes d'Exécution

```bash
# Réinitialiser la base (ATTENTION : supprime tout!)
npm run seed:reset

# Exécuter tous les seeds dans l'ordre
npm run seed:all

# Ou exécuter individuellement
npm run seed:reference    # Données de référence
npm run seed:security     # Groupes et permissions
npm run seed:admin        # Utilisateurs et établissements

# Utiliser la commande Prisma officielle
npx prisma db seed
```

## 📊 Statistiques Après Seed

- **Départements** : 15
- **Districts** : ~60
- **Communes** : ~150
- **Arrondissements** : ~30 (Brazzaville + Pointe-Noire)
- **Objets métier** : 37
- **Groupes de sécurité** : 27 (12 ministère + 15 école)
- **Permissions** : ~200
- **Utilisateurs** : 17 (9 ministère + 8 école)
- **Établissements** : 3

## 🧪 Tests de Vérification

Après l'exécution des seeds, vérifiez :

```sql
-- Compter les entités créées
SELECT 'Départements' as type, COUNT(*) FROM departements
UNION ALL
SELECT 'Districts', COUNT(*) FROM districts
UNION ALL
SELECT 'Utilisateurs Ministère', COUNT(*) FROM users_ministry
UNION ALL
SELECT 'Utilisateurs École', COUNT(*) FROM users_school
UNION ALL
SELECT 'Établissements', COUNT(*) FROM etablissements
UNION ALL
SELECT 'Groupes Sécurité', 
  (SELECT COUNT(*) FROM security_groups_ministry) + 
  (SELECT COUNT(*) FROM security_groups_school);

-- Vérifier la hiérarchie
SELECT 
  s.nom as structure,
  s.type_structure,
  p.nom as parent,
  a.nom as administration
FROM structures_administratives s
LEFT JOIN structures_administratives p ON s.parent_id = p.id
LEFT JOIN administrations a ON s.administration_id = a.id
ORDER BY a.nom, s.type_structure;

-- Vérifier les permissions
SELECT 
  sg.nom as groupe,
  bo.nom as objet,
  gp.peut_lire,
  gp.peut_ecrire,
  gp.peut_creer,
  gp.peut_supprimer,
  gp.peut_approuver
FROM group_permissions_ministry gp
JOIN security_groups_ministry sg ON gp.group_id = sg.id
JOIN business_objects bo ON gp.object_id = bo.id
WHERE sg.nom = 'Cabinet Ministériel'
ORDER BY bo.module, bo.nom;
```

## 🔧 Personnalisation

Pour adapter les seeds à vos besoins :

1. **Ajouter des départements/districts** : Modifier `01-reference-data.seed.ts`
2. **Créer de nouveaux groupes** : Modifier `02-security-groups.seed.ts`
3. **Ajouter des utilisateurs** : Modifier `03-admin-user.seed.ts`
4. **Changer les permissions** : Ajuster les tableaux de permissions dans `02-security-groups.seed.ts`

## ⚠️ Notes Importantes

1. **Mots de passe** : Tous les utilisateurs ont le même mot de passe par défaut. Changez-le en production !
2. **Emails** : Les domaines `.gouv.cg` et `.education.cg` sont fictifs
3. **Coordonnées GPS** : Les coordonnées des établissements sont approximatives
4. **Hiérarchie** : La structure administrative peut être étendue selon vos besoins
5. **Performance** : Les seeds créent beaucoup de données. En production, utilisez des imports en masse.

## 🐛 Dépannage

### Erreur "Foreign key constraint"
- Vérifiez l'ordre de suppression dans `00-reset.seed.ts`
- Assurez-vous d'exécuter les seeds dans l'ordre

### Erreur "Duplicate key"
- Exécutez d'abord `npm run seed:reset`
- Vérifiez les contraintes d'unicité (codes, emails)

### Performance lente
- Utilisez des transactions pour les insertions en masse
- Considérez l'utilisation de `createMany` au lieu de boucles

## 📝 Prochaines Étapes

1. **Tester la connexion** avec les différents utilisateurs
2. **Vérifier les permissions** en essayant différentes actions
3. **Implémenter les endpoints** d'authentification
4. **Créer les guards** NestJS pour la sécurité
5. **Développer l'interface** de gestion des utilisateurs