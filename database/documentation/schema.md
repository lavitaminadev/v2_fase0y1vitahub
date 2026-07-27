# VITAHUB Database Schema Documentation

## Table: `organizations`

**Purpose:** Top-level multi-tenant entities. Every other entity belongs to exactly one organization.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| name | varchar(255) | NO | — | Organization display name |
| code | varchar(50) | NO | — | Unique short code |
| logoUrl | varchar(255) | YES | — | URL to organization logo |
| currency | char(3) | NO | 'CLP' | Default currency |
| isActive | boolean | NO | true | Whether the org is active |
| created_at | timestamp | NO | CURRENT_TIMESTAMP | Row creation timestamp |
| updated_at | timestamp | NO | CURRENT_TIMESTAMP | Row last update timestamp |

**Indexes:**
- `PK_organizations` on `id`
- `UQ_organizations_code` on `code` (unique)

**Foreign Keys:** None (root table)

---

## Table: `users`

**Purpose:** System users (designers, community managers, admins, account managers, etc.).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| organization_id | uuid | NO | — | FK to organizations |
| name | varchar(255) | NO | — | Full name |
| email | varchar(255) | NO | — | Unique email (login) |
| password | varchar(255) | NO | — | Hashed password (select:false) |
| phone | varchar(20) | YES | — | Phone number |
| role | varchar(50) | NO | 'designer' | User role (designer, cm, admin, account_manager) |
| avatarUrl | varchar(255) | YES | — | Avatar image URL |
| isActive | boolean | NO | true | Whether user is active |
| refreshToken | text | YES | — | JWT refresh token (select:false) |
| created_at | timestamp | NO | CURRENT_TIMESTAMP | |
| updated_at | timestamp | NO | CURRENT_TIMESTAMP | |

**Indexes:**
- `PK_users` on `id`
- `UQ_users_email` on `email` (unique)
- `IDX_users_organization_id` on `organization_id`

**Foreign Keys:**
- `organization_id` → `organizations(id)`

---

## Table: `clients`

**Purpose:** Client companies or brands managed by the agency.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| organization_id | uuid | NO | — | FK to organizations |
| lead_id | uuid | YES | — | FK to leads (source lead if converted) |
| community_manager_id | uuid | YES | — | Assigned community manager user ID |
| name | varchar(255) | NO | — | Client display name |
| legalName | varchar(255) | YES | — | Legal business name |
| industry | varchar(255) | YES | — | Industry sector |
| status | varchar(50) | NO | 'onboarding' | Client status (onboarding, active, paused, closed) |
| retainerAmount | decimal(18,2) | YES | — | Monthly retainer amount |
| currency | char(3) | NO | 'CLP' | Currency for financials |
| startedAt | date | YES | — | Contract start date |
| renewalAt | date | YES | — | Next renewal date |
| whatsappGroup | varchar(255) | YES | — | WhatsApp group link |
| driveFolderId | varchar(255) | YES | — | Google Drive folder ID |
| defaultUdBudget | decimal(8,2) | NO | 20 | Default monthly UD budget |
| created_at | timestamp | NO | CURRENT_TIMESTAMP | |
| updated_at | timestamp | NO | CURRENT_TIMESTAMP | |

**Indexes:**
- `PK_clients` on `id`
- `IDX_clients_organization_id` on `organization_id`
- `IDX_clients_lead_id` on `lead_id`

**Foreign Keys:**
- `organization_id` → `organizations(id)`
- `lead_id` → `leads(id)`

---

## Table: `leads`

**Purpose:** Sales leads in the CRM pipeline.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| organization_id | uuid | NO | — | FK to organizations |
| name | varchar(255) | NO | — | Contact name |
| email | varchar(255) | YES | — | Contact email |
| phone | varchar(20) | YES | — | Contact phone |
| company | varchar(255) | YES | — | Company name |
| source | varchar(255) | YES | — | Lead source (referral, web, etc.) |
| status | varchar(50) | NO | 'new' | Pipeline status (new, contacted, qualified, converted, lost) |
| assignedTo | uuid | YES | — | Assigned sales user ID |
| notes | text | YES | — | Internal notes |
| convertedAt | timestamp | YES | — | When converted to client |
| convertedToClientId | uuid | YES | — | FK to resulting client |
| created_at | timestamp | NO | CURRENT_TIMESTAMP | |
| updated_at | timestamp | NO | CURRENT_TIMESTAMP | |

**Indexes:**
- `PK_leads` on `id`
- `IDX_leads_organization_id` on `organization_id`
- `IDX_leads_status` on `status`

**Foreign Keys:**
- `organization_id` → `organizations(id)`

---

## Table: `pieces`

**Purpose:** Production pieces (design assets, content pieces, etc.) requested by clients.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| organization_id | uuid | NO | — | FK to organizations |
| client_id | uuid | NO | — | FK to clients |
| assignedTo | uuid | YES | — | Assigned designer user ID |
| type | varchar(50) | NO | — | Piece type (post, story, reel, banner, etc.) |
| title | varchar(255) | NO | — | Piece title/description |
| status | varchar(50) | NO | 'backlog' | Workflow status (backlog, assigned, in_progress, review, delivered, approved) |
| difficultyLevel | tinyint | NO | 1 | Difficulty level (1-5) |
| udAmount | decimal(8,2) | NO | 0 | UD cost for this piece |
| deadlineAt | timestamp | YES | — | Deadline timestamp |
| deliveredAt | timestamp | YES | — | Delivery timestamp |
| correctionCount | int | NO | 0 | Internal correction count |
| clientCorrectionCount | int | NO | 0 | Client correction count |
| driveLink | varchar(255) | YES | — | Google Drive link |
| staleAlertedAt | timestamp | YES | — | Last stale alert timestamp |
| description | text | YES | — | Additional description |
| created_at | timestamp | NO | CURRENT_TIMESTAMP | |
| updated_at | timestamp | NO | CURRENT_TIMESTAMP | |

**Indexes:**
- `PK_pieces` on `id`
- `IDX_pieces_organization_id` on `organization_id`
- `IDX_pieces_client_id` on `client_id`
- `IDX_pieces_status` on `status`
- `IDX_pieces_assigned_to` on `assignedTo`

**Foreign Keys:**
- `organization_id` → `organizations(id)`
- `client_id` → `clients(id)`

---

## Table: `piece_versions`

**Purpose:** Version history for each production piece (file submissions).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| piece_id | uuid | NO | — | FK to pieces (CASCADE) |
| versionNumber | int | NO | — | Sequential version number |
| fileName | varchar(255) | NO | — | File name |
| driveFileId | varchar(255) | YES | — | Google Drive file ID |
| stateLabel | varchar(50) | YES | — | State label (preview, correction, final) |
| isFinal | boolean | NO | false | Whether this is the final version |
| namingValid | boolean | YES | — | Whether file naming is valid |
| namingErrors | json | YES | — | Array of naming validation errors |
| createdBy | uuid | YES | — | User who uploaded the version |
| created_at | timestamp | NO | CURRENT_TIMESTAMP | |
| updated_at | timestamp | NO | CURRENT_TIMESTAMP | |

**Indexes:**
- `PK_piece_versions` on `id`
- `IDX_piece_versions_piece_id` on `piece_id`

**Foreign Keys:**
- `piece_id` → `pieces(id)` ON DELETE CASCADE

---

## Table: `corrections`

**Purpose:** Correction/change requests made to production pieces.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| piece_id | uuid | NO | — | FK to pieces (CASCADE) |
| pieceVersionId | uuid | YES | — | FK to the version being corrected |
| origin | varchar(50) | NO | — | Correction origin (internal, client) |
| description | text | NO | — | Correction description |
| requestedBy | uuid | YES | — | User who requested the correction |
| resolvedBy | uuid | YES | — | User who resolved the correction |
| resolvedAt | timestamp | YES | — | Resolution timestamp |
| created_at | timestamp | NO | CURRENT_TIMESTAMP | |
| updated_at | timestamp | NO | CURRENT_TIMESTAMP | |

**Indexes:**
- `PK_corrections` on `id`
- `IDX_corrections_piece_id` on `piece_id`

**Foreign Keys:**
- `piece_id` → `pieces(id)` ON DELETE CASCADE
- `pieceVersionId` → `piece_versions(id)` ON DELETE SET NULL

---

## Table: `content_grids`

**Purpose:** Weekly content planning grids for clients.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| organization_id | uuid | NO | — | FK to organizations |
| client_id | uuid | NO | — | FK to clients (CASCADE) |
| title | varchar(255) | NO | — | Grid title |
| weekStart | date | NO | — | Start of the week |
| weekEnd | date | NO | — | End of the week |
| status | varchar(50) | NO | 'draft' | Grid status (draft, published) |
| notes | text | YES | — | Additional notes |
| created_at | timestamp | NO | CURRENT_TIMESTAMP | |
| updated_at | timestamp | NO | CURRENT_TIMESTAMP | |

**Indexes:**
- `PK_content_grids` on `id`
- `IDX_content_grids_organization_id` on `organization_id`
- `IDX_content_grids_client_id` on `client_id`

**Foreign Keys:**
- `organization_id` → `organizations(id)`
- `client_id` → `clients(id)` ON DELETE CASCADE

---

## Table: `content_items`

**Purpose:** Individual content items within a content grid.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| contentGridId | uuid | NO | — | FK to content_grids (CASCADE) |
| type | varchar(50) | NO | — | Content type (post, story, reel, carousel) |
| caption | varchar(255) | NO | — | Content caption/text |
| status | varchar(50) | NO | 'planned' | Item status (planned, assigned, produced, published) |
| scheduledAt | date | YES | — | Scheduled publish date |
| pieceId | uuid | YES | — | Related production piece ID |
| notes | text | YES | — | Additional notes |
| created_at | timestamp | NO | CURRENT_TIMESTAMP | |
| updated_at | timestamp | NO | CURRENT_TIMESTAMP | |

**Indexes:**
- `PK_content_items` on `id`
- `IDX_content_items_content_grid_id` on `contentGridId`

**Foreign Keys:**
- `contentGridId` → `content_grids(id)` ON DELETE CASCADE

---

## Table: `ud_budgets`

**Purpose:** Monthly UD (Design Unit) budgets per client.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| client_id | uuid | NO | — | FK to clients (CASCADE) |
| year | smallint | NO | — | Budget year |
| month | tinyint | NO | — | Budget month (1-12) |
| contracted | decimal(8,2) | NO | — | Contracted UD amount |
| reserved | decimal(8,2) | NO | 0 | Reserved UD amount |
| consumed | decimal(8,2) | NO | 0 | Consumed UD amount |
| status | varchar(20) | NO | 'open' | Budget status (open, closed) |
| created_at | timestamp | NO | CURRENT_TIMESTAMP | |
| updated_at | timestamp | NO | CURRENT_TIMESTAMP | |

**Indexes:**
- `PK_ud_budgets` on `id`
- `IDX_ud_budgets_client_id` on `client_id`
- `IDX_ud_budgets_year_month` on `year, month`

**Foreign Keys:**
- `client_id` → `clients(id)` ON DELETE CASCADE

---

## Table: `ud_movements`

**Purpose:** Individual UD transactions (reservations, consumptions, adjustments).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| udBudgetId | uuid | NO | — | FK to ud_budgets (CASCADE) |
| pieceId | uuid | YES | — | FK to pieces |
| type | varchar(50) | NO | — | Movement type (reserve, consume, adjust, release) |
| amount | decimal(8,2) | NO | — | UD amount |
| reason | varchar(255) | YES | — | Reason for movement |
| actorId | uuid | YES | — | User who performed the movement |
| created_at | timestamp | NO | CURRENT_TIMESTAMP | |
| updated_at | timestamp | NO | CURRENT_TIMESTAMP | |

**Indexes:**
- `PK_ud_movements` on `id`
- `IDX_ud_movements_ud_budget_id` on `udBudgetId`
- `IDX_ud_movements_piece_id` on `pieceId`

**Foreign Keys:**
- `udBudgetId` → `ud_budgets(id)` ON DELETE CASCADE
- `pieceId` → `pieces(id)` ON DELETE SET NULL

---

## Table: `xp_periods`

**Purpose:** Weekly XP (experience points) periods for gamification.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| organization_id | uuid | NO | — | Organization context |
| user_id | uuid | NO | — | FK to users (CASCADE) |
| weekStart | date | NO | — | Period start (Monday) |
| weekEnd | date | NO | — | Period end (Sunday) |
| totalXp | int | NO | 0 | Accumulated XP in period |
| tier | varchar(20) | YES | — | Tier achieved |
| status | varchar(20) | NO | 'open' | Period status (open, closed) |
| closedAt | timestamp | YES | — | When period was closed |
| created_at | timestamp | NO | CURRENT_TIMESTAMP | |
| updated_at | timestamp | NO | CURRENT_TIMESTAMP | |

**Indexes:**
- `PK_xp_periods` on `id`
- `IDX_xp_periods_user_id` on `user_id`
- `IDX_xp_periods_week` on `weekStart, weekEnd`

**Foreign Keys:**
- `user_id` → `users(id)` ON DELETE CASCADE

---

## Table: `xp_events`

**Purpose:** Individual XP events within a period (deliveries, penalties, bonuses).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| xpPeriodId | uuid | NO | — | FK to xp_periods |
| userId | uuid | YES | — | User (redundant with period, for direct queries) |
| pieceId | uuid | YES | — | FK to pieces |
| eventType | varchar(50) | NO | — | Event type (delivery, penalty, bonus, correction) |
| points | int | NO | — | XP points awarded/penalized |
| description | varchar(255) | YES | — | Event description |
| metadata | json | YES | — | Additional metadata |
| created_at | timestamp | NO | CURRENT_TIMESTAMP | |
| updated_at | timestamp | NO | CURRENT_TIMESTAMP | |

**Indexes:**
- `PK_xp_events` on `id`
- `IDX_xp_events_xp_period_id` on `xpPeriodId`
- `IDX_xp_events_user_id` on `userId`

**Foreign Keys:**
- `xpPeriodId` → `xp_periods(id)` ON DELETE CASCADE
- `pieceId` → `pieces(id)` ON DELETE SET NULL

---

## Table: `meetings`

**Purpose:** Scheduled meetings (internal, client, etc.).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| organization_id | uuid | NO | — | FK to organizations (CASCADE) |
| title | varchar(255) | NO | — | Meeting title |
| type | varchar(50) | NO | — | Meeting type (internal, client, weekly) |
| status | varchar(50) | NO | 'scheduled' | Meeting status (scheduled, completed, cancelled) |
| scheduledAt | timestamp | NO | — | Scheduled start time |
| durationMinutes | int | NO | 60 | Duration in minutes |
| location | varchar(255) | YES | — | Physical location |
| meetingLink | varchar(255) | YES | — | Video call link |
| createdBy | uuid | NO | — | User who created the meeting |
| minutes | text | YES | — | Meeting minutes/notes |
| created_at | timestamp | NO | CURRENT_TIMESTAMP | |
| updated_at | timestamp | NO | CURRENT_TIMESTAMP | |

**Indexes:**
- `PK_meetings` on `id`
- `IDX_meetings_organization_id` on `organization_id`

**Foreign Keys:**
- `organization_id` → `organizations(id)` ON DELETE CASCADE

---

## Table: `meeting_attendees`

**Purpose:** Many-to-many relationship between meetings and users.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| meeting_id | uuid | NO | — | FK to meetings (CASCADE) |
| user_id | uuid | NO | — | FK to users (CASCADE) |
| created_at | timestamp | NO | CURRENT_TIMESTAMP | |

**Indexes:**
- `PK_meeting_attendees` on `id`
- `IDX_meeting_attendees_meeting_id` on `meeting_id`
- `IDX_meeting_attendees_user_id` on `user_id`

**Foreign Keys:**
- `meeting_id` → `meetings(id)` ON DELETE CASCADE
- `user_id` → `users(id)` ON DELETE CASCADE

---

## Table: `action_items`

**Purpose:** Action items/tasks derived from meetings.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| meeting_id | uuid | NO | — | FK to meetings (CASCADE) |
| description | text | NO | — | Action item description |
| assignedTo | uuid | YES | — | FK to users (assignee) |
| dueAt | timestamp | YES | — | Due date |
| completedAt | timestamp | YES | — | Completion timestamp |
| status | varchar(50) | NO | 'pending' | Status (pending, in_progress, completed) |
| created_at | timestamp | NO | CURRENT_TIMESTAMP | |
| updated_at | timestamp | NO | CURRENT_TIMESTAMP | |

**Indexes:**
- `PK_action_items` on `id`
- `IDX_action_items_meeting_id` on `meeting_id`
- `IDX_action_items_assigned_to` on `assignedTo`

**Foreign Keys:**
- `meeting_id` → `meetings(id)` ON DELETE CASCADE
- `assignedTo` → `users(id)` ON DELETE SET NULL

---

## Table: `services`

**Purpose:** Catalog of services offered by the agency.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| organization_id | uuid | NO | — | FK to organizations (CASCADE) |
| name | varchar(255) | NO | — | Service name |
| description | text | YES | — | Service description |
| category | varchar(50) | NO | — | Service category (design, content, video, etc.) |
| unitPrice | decimal(18,2) | YES | — | Price per unit |
| currency | char(3) | NO | 'CLP' | Currency |
| udPerUnit | decimal(8,2) | NO | 0 | UD cost per unit |
| status | varchar(50) | NO | 'active' | Service status (active, inactive) |
| created_at | timestamp | NO | CURRENT_TIMESTAMP | |
| updated_at | timestamp | NO | CURRENT_TIMESTAMP | |

**Indexes:**
- `PK_services` on `id`
- `IDX_services_organization_id` on `organization_id`
- `IDX_services_category` on `category`

**Foreign Keys:**
- `organization_id` → `organizations(id)` ON DELETE CASCADE

---

## Table: `quotes`

**Purpose:** Sales quotes/estimates for clients.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| organization_id | uuid | NO | — | FK to organizations (CASCADE) |
| client_id | uuid | NO | — | FK to clients (CASCADE) |
| number | varchar(50) | NO | — | Unique quote number |
| title | varchar(255) | NO | — | Quote title |
| amount | decimal(18,2) | NO | — | Total amount |
| currency | char(3) | NO | 'CLP' | Currency |
| status | varchar(50) | NO | 'draft' | Quote status (draft, sent, accepted, rejected, expired) |
| validUntil | date | YES | — | Quote validity date |
| acceptedAt | timestamp | YES | — | Acceptance timestamp |
| createdBy | uuid | NO | — | User who created the quote |
| items | json | YES | — | Quote items (denormalized) |
| notes | text | YES | — | Internal notes |
| created_at | timestamp | NO | CURRENT_TIMESTAMP | |
| updated_at | timestamp | NO | CURRENT_TIMESTAMP | |

**Indexes:**
- `PK_quotes` on `id`
- `UQ_quotes_number` on `number` (unique)
- `IDX_quotes_organization_id` on `organization_id`
- `IDX_quotes_client_id` on `client_id`

**Foreign Keys:**
- `organization_id` → `organizations(id)` ON DELETE CASCADE
- `client_id` → `clients(id)` ON DELETE CASCADE

---

## Table: `quote_items`

**Purpose:** Individual line items within a quote.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| quote_id | uuid | NO | — | FK to quotes (CASCADE) |
| service_id | uuid | YES | — | FK to services |
| description | varchar(255) | YES | — | Item description |
| quantity | int | NO | 1 | Quantity |
| unitPrice | decimal(18,2) | NO | — | Unit price |
| total | decimal(18,2) | NO | — | Line total (quantity * unitPrice) |
| created_at | timestamp | NO | CURRENT_TIMESTAMP | |

**Indexes:**
- `PK_quote_items` on `id`
- `IDX_quote_items_quote_id` on `quote_id`

**Foreign Keys:**
- `quote_id` → `quotes(id)` ON DELETE CASCADE
- `service_id` → `services(id)` ON DELETE SET NULL

---

## Table: `invoices`

**Purpose:** Billing invoices issued to clients.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| organization_id | uuid | NO | — | FK to organizations (CASCADE) |
| client_id | uuid | NO | — | FK to clients (CASCADE) |
| number | varchar(50) | NO | — | Unique invoice number |
| issuedAt | date | NO | — | Issue date |
| dueAt | date | NO | — | Payment due date |
| paidAt | timestamp | YES | — | Payment timestamp |
| subtotal | decimal(18,2) | NO | — | Subtotal amount |
| tax | decimal(18,2) | NO | 0 | Tax amount |
| total | decimal(18,2) | NO | — | Total amount |
| currency | char(3) | NO | 'CLP' | Currency |
| status | varchar(20) | NO | 'pending' | Invoice status (pending, paid, overdue, cancelled) |
| notes | text | YES | — | Additional notes |
| created_at | timestamp | NO | CURRENT_TIMESTAMP | |
| updated_at | timestamp | NO | CURRENT_TIMESTAMP | |

**Indexes:**
- `PK_invoices` on `id`
- `UQ_invoices_number` on `number` (unique)
- `IDX_invoices_organization_id` on `organization_id`
- `IDX_invoices_client_id` on `client_id`

**Foreign Keys:**
- `organization_id` → `organizations(id)` ON DELETE CASCADE
- `client_id` → `clients(id)` ON DELETE CASCADE

---

## Table: `payments`

**Purpose:** Payment records applied to invoices.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| invoice_id | uuid | NO | — | FK to invoices (CASCADE) |
| amount | decimal(18,2) | NO | — | Payment amount |
| method | varchar(50) | NO | — | Payment method (transfer, credit_card, cash) |
| reference | varchar(255) | YES | — | External reference/transaction ID |
| paidAt | timestamp | NO | — | Payment timestamp |
| created_at | timestamp | NO | CURRENT_TIMESTAMP | |

**Indexes:**
- `PK_payments` on `id`
- `IDX_payments_invoice_id` on `invoice_id`

**Foreign Keys:**
- `invoice_id` → `invoices(id)` ON DELETE CASCADE

---

## Table: `integrations`

**Purpose:** Third-party integrations configuration (Meta, Google, etc.).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| organization_id | uuid | NO | — | FK to organizations (CASCADE) |
| provider | varchar(50) | NO | — | Provider name (meta, google, etc.) |
| name | varchar(255) | NO | — | Integration display name |
| status | varchar(50) | NO | 'pending' | Integration status (pending, active, error) |
| config | json | YES | — | Integration configuration |
| errorMessage | text | YES | — | Last error message |
| lastSyncAt | timestamp | YES | — | Last synchronization timestamp |
| created_at | timestamp | NO | CURRENT_TIMESTAMP | |
| updated_at | timestamp | NO | CURRENT_TIMESTAMP | |

**Indexes:**
- `PK_integrations` on `id`
- `IDX_integrations_organization_id` on `organization_id`
- `IDX_integrations_provider` on `provider`

**Foreign Keys:**
- `organization_id` → `organizations(id)` ON DELETE CASCADE

---

## Table: `integration_accounts`

**Purpose:** Connected accounts within an integration (e.g., multiple Facebook pages).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| integration_id | uuid | NO | — | FK to integrations (CASCADE) |
| accountType | varchar(50) | NO | — | Account type (page, ad_account, drive) |
| externalId | varchar(255) | NO | — | External platform account ID |
| externalName | varchar(255) | NO | — | External platform display name |
| accessToken | text | YES | — | OAuth access token |
| refreshToken | text | YES | — | OAuth refresh token |
| tokenExpiresAt | timestamp | YES | — | Token expiry timestamp |
| metadata | json | YES | — | Additional account metadata |
| created_at | timestamp | NO | CURRENT_TIMESTAMP | |
| updated_at | timestamp | NO | CURRENT_TIMESTAMP | |

**Indexes:**
- `PK_integration_accounts` on `id`
- `IDX_integration_accounts_integration_id` on `integration_id`

**Foreign Keys:**
- `integration_id` → `integrations(id)` ON DELETE CASCADE

---

## Table: `sync_runs`

**Purpose:** Log of data synchronization runs for integration accounts.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| integration_account_id | uuid | NO | — | FK to integration_accounts (CASCADE) |
| status | varchar(50) | NO | 'pending' | Run status (pending, running, completed, failed) |
| startedAt | timestamp | NO | — | Run start timestamp |
| completedAt | timestamp | YES | — | Run completion timestamp |
| error | text | YES | — | Error message if failed |
| created_at | timestamp | NO | CURRENT_TIMESTAMP | |

**Indexes:**
- `PK_sync_runs` on `id`
- `IDX_sync_runs_integration_account_id` on `integration_account_id`

**Foreign Keys:**
- `integration_account_id` → `integration_accounts(id)` ON DELETE CASCADE

---

## Table: `approval_requests`

**Purpose:** Approval workflows for various entity types (pieces, quotes, etc.).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| organization_id | uuid | NO | — | FK to organizations (CASCADE) |
| title | varchar(255) | NO | — | Request title |
| description | text | YES | — | Request description |
| entityType | varchar(100) | NO | — | Entity type being approved |
| entityId | uuid | NO | — | Entity ID being approved |
| requestedBy | uuid | NO | — | User who created the request |
| assignedTo | uuid | YES | — | Approver user ID |
| status | varchar(50) | NO | 'pending' | Request status (pending, approved, rejected) |
| decisionAt | timestamp | YES | — | Decision timestamp |
| decisionNotes | text | YES | — | Decision notes |
| dueAt | timestamp | YES | — | Response deadline |
| created_at | timestamp | NO | CURRENT_TIMESTAMP | |
| updated_at | timestamp | NO | CURRENT_TIMESTAMP | |

**Indexes:**
- `PK_approval_requests` on `id`
- `IDX_approval_requests_organization_id` on `organization_id`
- `IDX_approval_requests_entity` on `entityType, entityId`

**Foreign Keys:**
- `organization_id` → `organizations(id)` ON DELETE CASCADE

---

## Table: `approval_decisions`

**Purpose:** Individual decisions made on approval requests (supports multi-step approval).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| approval_request_id | uuid | NO | — | FK to approval_requests (CASCADE) |
| decision | varchar(50) | NO | — | Decision (approved, rejected) |
| comment | text | YES | — | Decision comment |
| decidedBy | uuid | NO | — | User who made the decision |
| created_at | timestamp | NO | CURRENT_TIMESTAMP | |

**Indexes:**
- `PK_approval_decisions` on `id`
- `IDX_approval_decisions_request_id` on `approval_request_id`

**Foreign Keys:**
- `approval_request_id` → `approval_requests(id)` ON DELETE CASCADE

---

## Table: `briefs`

**Purpose:** Creative briefs for projects and campaigns.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| organization_id | uuid | NO | — | FK to organizations (CASCADE) |
| client_id | uuid | YES | — | FK to clients |
| title | varchar(255) | NO | — | Brief title |
| description | text | YES | — | Brief description |
| requirements | json | YES | — | Structured requirements |
| status | varchar(20) | NO | 'draft' | Brief status (draft, submitted, approved) |
| dueDate | date | YES | — | Due date |
| created_at | timestamp | NO | CURRENT_TIMESTAMP | |
| updated_at | timestamp | NO | CURRENT_TIMESTAMP | |

**Indexes:**
- `PK_briefs` on `id`
- `IDX_briefs_organization_id` on `organization_id`

**Foreign Keys:**
- `organization_id` → `organizations(id)` ON DELETE CASCADE

---

## Table: `contracts`

**Purpose:** Service contracts with clients.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| organization_id | uuid | NO | — | FK to organizations (CASCADE) |
| client_id | uuid | YES | — | FK to clients |
| name | varchar(255) | NO | — | Contract name |
| serviceType | varchar(255) | YES | — | Type of service |
| startDate | date | NO | — | Contract start date |
| endDate | date | YES | — | Contract end date |
| monthlyUd | decimal(8,2) | NO | 0 | Monthly UD allocation |
| status | varchar(20) | NO | 'active' | Contract status (active, expired, terminated) |
| terms | text | YES | — | Contract terms and conditions |
| created_at | timestamp | NO | CURRENT_TIMESTAMP | |
| updated_at | timestamp | NO | CURRENT_TIMESTAMP | |

**Indexes:**
- `PK_contracts` on `id`
- `IDX_contracts_organization_id` on `organization_id`

**Foreign Keys:**
- `organization_id` → `organizations(id)` ON DELETE CASCADE

---

## Table: `onboarding`

**Purpose:** Client onboarding workflow steps.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| client_id | uuid | NO | — | FK to clients (CASCADE) |
| organization_id | uuid | NO | — | FK to organizations (CASCADE) |
| step | varchar(255) | NO | — | Onboarding step name |
| status | varchar(20) | NO | 'pending' | Step status (pending, completed, skipped) |
| assignedTo | uuid | YES | — | Responsible user |
| completedAt | timestamp | YES | — | Completion timestamp |
| notes | text | YES | — | Additional notes |
| created_at | timestamp | NO | CURRENT_TIMESTAMP | |
| updated_at | timestamp | NO | CURRENT_TIMESTAMP | |

**Indexes:**
- `PK_onboarding` on `id`
- `IDX_onboarding_client_id` on `client_id`

**Foreign Keys:**
- `client_id` → `clients(id)` ON DELETE CASCADE
- `organization_id` → `organizations(id)` ON DELETE CASCADE

---

## Table: `notifications`

**Purpose:** In-app notifications for users.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| user_id | uuid | NO | — | Recipient user ID |
| type | varchar(50) | NO | — | Notification type (piece_assigned, correction, xp, etc.) |
| title | varchar(255) | NO | — | Notification title |
| message | text | NO | — | Notification body |
| data | json | YES | — | Additional payload data |
| read | boolean | NO | false | Read status |
| created_at | timestamp | NO | CURRENT_TIMESTAMP | |

**Indexes:**
- `PK_notifications` on `id`
- `IDX_notifications_user_id` on `user_id`
- `IDX_notifications_read` on `read`

**Foreign Keys:** None (denormalized for performance)

---

## Table: `refresh_tokens`

**Purpose:** JWT refresh token storage for authentication.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| user_id | uuid | NO | — | FK to users (CASCADE) |
| token | text | NO | — | Hashed refresh token |
| expiresAt | timestamp | NO | — | Token expiry |
| created_at | timestamp | NO | CURRENT_TIMESTAMP | |

**Indexes:**
- `PK_refresh_tokens` on `id`
- `IDX_refresh_tokens_user_id` on `user_id`
- `IDX_refresh_tokens_token` on `token`

**Foreign Keys:**
- `user_id` → `users(id)` ON DELETE CASCADE

---

## Table: `parameter_definitions`

**Purpose:** System parameter/configuration definitions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| key | varchar(100) | NO | — | Unique parameter key |
| description | text | YES | — | Parameter description |
| defaultValue | json | YES | — | Default value |
| created_at | timestamp | NO | CURRENT_TIMESTAMP | |
| updated_at | timestamp | NO | CURRENT_TIMESTAMP | |

**Indexes:**
- `PK_parameter_definitions` on `id`
- `UQ_parameter_definitions_key` on `key` (unique)

**Foreign Keys:** None (root table)

---

## Table: `parameter_values`

**Purpose:** Scoped parameter values (organization-level or entity-level overrides).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| definition_id | uuid | NO | — | FK to parameter_definitions (CASCADE) |
| scopeType | varchar(50) | NO | — | Scope type (organization, client, user) |
| scope_id | uuid | NO | — | Scope entity ID |
| valueJson | json | NO | — | Parameter value |
| version | int | NO | 1 | Value version for auditing |
| validFrom | datetime | NO | CURRENT_TIMESTAMP | Validity start |
| validTo | datetime | YES | — | Validity end |
| created_at | timestamp | NO | CURRENT_TIMESTAMP | |
| updated_at | timestamp | NO | CURRENT_TIMESTAMP | |

**Indexes:**
- `PK_parameter_values` on `id`
- `IDX_parameter_values_definition_id` on `definition_id`
- `IDX_parameter_values_scope` on `scopeType, scope_id`

**Foreign Keys:**
- `definition_id` → `parameter_definitions(id)` ON DELETE CASCADE

---

## Table: `audit_logs`

**Purpose:** Immutable audit trail for all entity changes.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| organization_id | uuid | NO | — | Organization context |
| actor_id | uuid | YES | — | User who performed the action |
| entityType | varchar(100) | NO | — | Entity type name |
| entity_id | uuid | NO | — | Entity ID |
| action | varchar(50) | NO | — | Action performed (create, update, delete) |
| before | json | YES | — | State before the action |
| after | json | YES | — | State after the action |
| reason | text | YES | — | Reason for the action |
| ipAddress | varchar(45) | YES | — | Actor IP address |
| occurred_at | timestamp | NO | CURRENT_TIMESTAMP | When the action occurred |

**Indexes:**
- `PK_audit_logs` on `id`
- `IDX_audit_logs_organization_id` on `organization_id`
- `IDX_audit_logs_entity` on `entityType, entity_id`
- `IDX_audit_logs_action` on `action`

**Foreign Keys:** None (append-only log)

---

## Additional Tables (not in ER diagram but exist in codebase)

### `uploads`
**Purpose:** File upload tracking.
**Columns:** id, organization_id, fileName, originalName, mimeType, size, path, driveFileId, uploadedBy, created_at

### `documents`
**Purpose:** Document management for clients.
**Columns:** id, organization_id, clientId, name, type, fileUrl, driveFileId, version, status, uploadedBy, tags, created_at, updated_at
