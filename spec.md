# PropAI CRM — Product Specification

> Spec-driven development reference: https://github.com/github/spec-kit

## 1. Overview

A property-management CRM that empowers a Property Manager to run day-to-day operations,
maintain tax-audit readiness, and optionally delegate tenant communications to a
**configurable WhatsApp AI agent** (enable/disable toggle).

Hosted on Vercel. Multi-module, database-backed, single-operator (property manager) view.

## 2. Actors

| Actor | Role |
|-------|------|
| Property Manager | Primary operator. Manages portfolio, bills, documents, tax data, and the AI agent. |
| Owner / Landlord | Beneficiary of rental income; receives tax statements and reports. |
| Tenant | Rents a unit; interacts with the AI agent via WhatsApp. |
| AI Agent (WhatsApp) | Automated assistant for rent reminders, maintenance triage, viewing scheduling. |

## 3. Functional Requirements

### 3.1 Dashboard
- KPI cards: total properties, occupancy rate, rent arrears, active maintenance.
- Recent AI agent actions feed.
- Portfolio financial snapshot (P&L summary, arrears list).

### 3.2 Properties & Leases
- Property database with search + type filter.
- Ownership (single or joint-venture with % shares), landlord, tenant, rent.
- Lease lifecycle (active / arrears / vacant), stamping status (LHDN).
- Add / edit property, tenant, and lease.

### 3.3 Bills & Utilities
- Recurring bill schedules per property (electricity, water, sewerage, JMB, quit rent, assessment).
- Mark paid with amount + receipt upload (audit trail).
- Unpaid/cleared summaries per property.

### 3.4 Tax & Audit
- Per-owner income tax statement (LHDN / Form BE Part C).
- Net taxable rental income = gross rent − verified expenses.
- Ownership-split distribution (JV).
- Chronological audit-trail log linking income/expenses to receipts.

### 3.5 Documents
- Secure filing system: lease agreements, receipts, insurance, warranties, titles.
- Upload, categorize, mark stamping/legalization status.

### 3.6 WhatsApp AI Agent (configurable)
- **Enable / Disable toggle** (persisted).
- Configurable: provider, system prompt, greeting, escalation rules, and behaviors
  (auto rent reminder, maintenance triage, viewing scheduling).
- In-app test conversation surface.
- Webhook stub for Meta WhatsApp Cloud API.
- When **disabled**, the agent refuses to act and all automations are suspended.

## 4. Non-Functional Requirements
- Deployable to Vercel (serverless) with Postgres.
- Local development with SQLite (zero-config).
- Responsive, accessible, intentional UI (Tailwind).
- Audit-log everything financial for tax-readiness.

## 5. Data Model (Prisma)
`User`, `Owner`, `Property`, `PropertyOwner`, `Tenant`, `Lease`, `Bill`, `BillPayment`,
`Expense`, `RentPayment`, `Document`, `AuditLog`, `AiAgentConfig`, `ChatMessage`.

## 6. Deliverables mapping
| Scope deliverable | Module |
|-------------------|--------|
| Monthly management report | Dashboard + Bills |
| Quarterly financial statement | Dashboard P&L + Tax |
| Annual tax portfolio | Tax & Audit + Documents |
