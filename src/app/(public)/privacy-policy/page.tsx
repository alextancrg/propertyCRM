import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — GoAssetHub",
  description:
    "The Privacy Policy for GoAssetHub: how we collect, process, store, disclose, and transfer personal data across our property management platform.",
};

type Section = {
  id: string;
  title: string;
  body: React.ReactNode;
};

const SECTIONS: Section[] = [
  {
    id: "introduction",
    title: "1. Introduction & Overview",
    body: (
      <>
        <p>
          This Privacy Policy (“Policy”) governs the collection, processing, storage, disclosure,
          and transfer of personal data by GoAssetHub (“Company,” “we,” “us,” or “our”) through our
          property management platform, software-as-a-service application, APIs, and associated web
          services (collectively, the “Platform”).
        </p>
        <p>
          By accessing, registering for, or using the Platform, you (“User,” “Property Manager,”
          “Property Owner,” or “Data Subject”) acknowledge that you have read, understood, and
          agreed to the terms outlined in this Policy.
        </p>
      </>
    ),
  },
  {
    id: "legal-roles",
    title: "2. Legal Roles: Data Controller vs. Data Processor",
    body: (
      <>
        <p>To ensure proper legal compliance and risk allocation:</p>
        <p>
          <strong>GoAssetHub as Data Controller:</strong> We act as a Data Controller for personal
          data directly collected from registered Users (e.g., property managers, property owners,
          and account administrators) for account setup, billing, authentication, and service
          delivery.
        </p>
        <p>
          <strong>GoAssetHub as Data Processor:</strong> We act strictly as a Data Processor for
          personal data (including tenant details, lease agreements, unit maintenance requests, and
          payment logs) uploaded, entered, or managed by Property Managers and Owners (“Customer
          Data”). Property Managers and Owners warrant that they are the primary Data Controllers of
          their respective tenant data and have secured all required statutory consents.
        </p>
      </>
    ),
  },
  {
    id: "data-collected",
    title: "3. Personal Data Collected",
    body: (
      <>
        <p>We collect and process the following categories of data:</p>
        <p className="mt-4 font-semibold">
          A. Direct Account & Identity Data <span className="font-normal text-slate-500">(Controller Context)</span>
        </p>
        <ul className="mt-2 space-y-1.5">
          <li>
            <strong>Identity & Contact Details:</strong> Full legal name, identity card / passport
            numbers (where legally required), email address, phone numbers, and physical business
            address.
          </li>
          <li>
            <strong>Billing Information:</strong> Corporate billing details, banking records,
            credit/debit card details, and tax identification numbers.
          </li>
          <li>
            <strong>Technical & Usage Logs:</strong> IP addresses, device identifiers, browser
            types, session timestamps, and audit log histories.
          </li>
        </ul>
        <p className="mt-5 font-semibold">
          B. Property & Tenant Data <span className="font-normal text-slate-500">(Processor Context)</span>
        </p>
        <ul className="mt-2 space-y-1.5">
          <li>
            <strong>Property Records:</strong> Unit physical addresses, land title details,
            maintenance histories, and asset valuations.
          </li>
          <li>
            <strong>Tenant & Occupant Information:</strong> Names, contact information, identity
            documents, lease agreements, rental balances, utility records, and maintenance requests
            submitted by or on behalf of property owners/managers.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "purpose",
    title: "4. Purpose of Data Processing",
    body: (
      <>
        <p>Personal data is processed strictly for lawful operational and contractual purposes, including:</p>
        <ul className="mt-2 space-y-1.5">
          <li>Provisioning, operating, and maintaining the Platform features.</li>
          <li>Account verification, user authentication, and multi-factor security checks.</li>
          <li>Processing platform subscriptions, automated billing, and invoicing.</li>
          <li>
            Facilitating property management communications, work-order dispatching, and lease
            tracking.
          </li>
          <li>
            Legal compliance, regulatory audit reporting, and enforceability of our Terms of
            Service.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "third-party",
    title: "5. Third-Party Disclosures & Sub-Processors",
    body: (
      <>
        <p>
          We do not sell, rent, or trade personal data to third parties. Data may be shared strictly
          under contract with authorized sub-processors or third parties under the following
          conditions:
        </p>
        <ul className="mt-2 space-y-1.5">
          <li>
            <strong>Infrastructure Providers:</strong> Cloud hosting (e.g., AWS, GCP, Azure),
            database providers, and server infrastructure networks.
          </li>
          <li>
            <strong>Financial Services:</strong> Payment gateway providers for processing
            subscription payments or automated rent disbursements.
          </li>
          <li>
            <strong>Legal & Regulatory Obligations:</strong> Statutory bodies, law enforcement
            agencies, or courts of competent jurisdiction where mandated by statutory legal process
            or court order.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "international-transfers",
    title: "6. International Data Transfers",
    body: (
      <p>
        Where personal data is transferred across international borders, GoAssetHub ensures that
        appropriate data transfer agreements, standard contractual clauses, or comparable
        cross-border safeguards are enforced in compliance with applicable local data protection
        laws.
      </p>
    ),
  },
  {
    id: "security",
    title: "7. Data Security Safeguards",
    body: (
      <>
        <p>
          We implement robust technical and organizational measures to safeguard personal data,
          including:
        </p>
        <ul className="mt-2 space-y-1.5">
          <li>
            End-to-end encryption in transit (TLS 1.3) and at rest (AES-256) for stored data assets.
          </li>
          <li>
            Role-Based Access Controls (RBAC) restricting system access to authorized personnel
            only.
          </li>
          <li>
            Continuous security audit logging, threat monitoring, and automated vulnerability
            scanning.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "retention",
    title: "8. Data Retention Policy",
    body: (
      <p>
        Personal data is retained only for as long as necessary to fulfill the operational purposes
        set forth herein, or as required by statutory accounting, tax, or legal retention
        requirements. Upon termination of a customer account or written request, Customer Data will
        be permanently purged or anonymized within ninety (90) days, subject to legal hold
        obligations.
      </p>
    ),
  },
  {
    id: "data-subject-rights",
    title: "9. Rights of Data Subjects",
    body: (
      <>
        <p>Subject to local privacy statutory provisions, Data Subjects maintain the following rights:</p>
        <ul className="mt-2 space-y-1.5">
          <li>
            <strong>Access & Rectification:</strong> The right to request access to and correction
            of inaccurate or incomplete personal data.
          </li>
          <li>
            <strong>Consent Withdrawal:</strong> The right to withdraw processing consent (subject
            to contractual conditions).
          </li>
          <li>
            <strong>Data Erasure & Portability:</strong> The right to request deletion or standard
            structural export of personal data.
          </li>
        </ul>
        <p className="mt-3">
          To exercise these rights, Data Subjects must contact our Data Protection Officer (DPO) at{" "}
          <a href="mailto:privacy@goassethub.com" className="font-semibold text-primary underline decoration-accent decoration-2 underline-offset-2 hover:text-primary-700">
            privacy@goassethub.com
          </a>
          .
        </p>
      </>
    ),
  },
  {
    id: "legal-disclaimers",
    title: "10. Legal Disclaimers & Liability Shield (Defensive Clauses)",
    body: (
      <>
        <p className="font-semibold">10.1 Indemnification by Property Managers & Owners</p>
        <p>
          Property Managers and Property Owners using GoAssetHub acknowledge and warrant that they
          have obtained all legally required explicit consents, notices, and authorizations from
          tenants, occupants, vendors, and contractors before uploading their personal data into the
          Platform.
        </p>
        <p>
          The User agrees to defend, indemnify, and hold harmless GoAssetHub, its parent company,
          directors, officers, employees, and agents from any claims, fines, regulatory penalties,
          liabilities, losses, or legal costs arising out of or related to:
        </p>
        <ul className="mt-2 space-y-1.5">
          <li>Unauthorized entry of tenant or third-party data into the Platform by the User.</li>
          <li>
            Failure by the User to maintain statutory privacy compliance under applicable regional
            laws (e.g., PDPA, GDPR).
          </li>
          <li>
            Any dispute arising directly between a Property Manager/Owner and a Tenant regarding
            data rights or tenancy agreements.
          </li>
        </ul>

        <p className="mt-5 font-semibold">10.2 Limitation of Liability</p>
        <p>
          To the maximum extent permitted by law, GoAssetHub shall not be liable for any indirect,
          incidental, consequential, special, or punitive damages (including loss of data, profit,
          goodwill, or operational business interruption) arising out of or connection with the
          platform or data processing activities. GoAssetHub’s total aggregate liability under any
          legal cause of action shall not exceed the total subscription fees actually paid by the
          user to GoAssetHub in the twelve (12) months preceding the claim event.
        </p>

        <p className="mt-5 font-semibold">10.3 Third-Party Links & Integrations</p>
        <p>
          The Platform may contain links or API integrations to third-party services (e.g.,
          accounting software, payment gateways, messaging platforms). GoAssetHub accepts no
          responsibility or legal liability for the data practices, privacy policies, or security
          controls of third-party platforms.
        </p>

        <p className="mt-5 font-semibold">10.4 Amendments & Policy Revisions</p>
        <p>
          We reserve the right to modify or update this Privacy Policy at any time. Continued usage
          of the Platform following published notice of revisions constitutes immediate acceptance
          of the revised terms.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "11. Contact Information & Data Protection Officer (DPO)",
    body: (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <p className="mb-3">For privacy inquiries, statutory data requests, or formal legal notices regarding data protection, contact:</p>
        <p className="font-semibold text-slate-900">Data Protection Officer (DPO)</p>
        <p>GoAssetHub Legal & Compliance Team</p>
        <p className="mt-2">
          Email:{" "}
          <a href="mailto:GoAssetHub@gmail.com" className="font-semibold text-primary underline decoration-accent decoration-2 underline-offset-2 hover:text-primary-700">
            GoAssetHub@gmail.com
          </a>
        </p>
      </div>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Branded header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/login" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary-800 to-primary text-lg text-white">
              <i className="fa-solid fa-building-user" />
            </span>
            <span className="leading-tight">
              <span className="block text-base font-bold tracking-tight text-slate-900">GoAssetHub</span>
              <span className="block text-[11px] text-slate-500">Property Management Platform</span>
            </span>
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <i className="fa-solid fa-right-to-bracket text-xs" />
            Sign in to App
          </Link>
        </div>
      </header>

      {/* Document header */}
      <section className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto w-full max-w-6xl px-6 pb-10 pt-12">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-700">
            <i className="fa-solid fa-shield-halved" />
            Legal · GoAssetHub
          </p>
          <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            This Policy explains how GoAssetHub collects, processes, stores, discloses, and
            transfers personal data through our property management platform, software-as-a-service
            application, APIs, and associated web services.
          </p>
          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm text-slate-500">
            <span>
              <strong className="font-semibold text-slate-700">Effective Date:</strong> August 26, 2026
            </span>
            <span>
              <strong className="font-semibold text-slate-700">Last Updated:</strong> August 26, 2026
            </span>
          </div>
        </div>
      </section>

      {/* Body: TOC + document */}
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-12 lg:grid-cols-[260px_1fr]">
        {/* Table of contents */}
        <nav aria-label="Table of contents" className="hidden lg:block">
          <div className="sticky top-24 space-y-1">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              On this page
            </p>
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block rounded-lg px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-primary"
              >
                {s.title}
              </a>
            ))}
          </div>
        </nav>

        {/* Document */}
        <article className="min-w-0 max-w-3xl">
          {SECTIONS.map((s, i) => (
            <section
              key={s.id}
              id={s.id}
              className={
                i > 0
                  ? "mt-10 border-t border-slate-100 pt-10 scroll-mt-24"
                  : "scroll-mt-24"
              }
            >
              <h2 className="mb-4 flex items-center gap-3 text-xl font-bold tracking-tight text-slate-900">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-50 text-sm font-bold text-primary-700">
                  {s.title.split(".")[0]}
                </span>
                {s.title.replace(/^\d+\.\s*/, "")}
              </h2>
              <div className="space-y-3 text-[15px] leading-relaxed text-slate-700">
                {s.body}
              </div>
            </section>
          ))}
        </article>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-4 px-6 py-8 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-800 text-sm text-white">
              <i className="fa-solid fa-building-user" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-bold text-slate-900">GoAssetHub</p>
              <p className="text-xs text-slate-500">© 2026 GoAssetHub. All rights reserved.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <Link href="/login" className="font-semibold text-slate-600 transition hover:text-primary">
              Sign in
            </Link>
            <a href="mailto:privacy@goassethub.com" className="font-semibold text-slate-600 transition hover:text-primary">
              privacy@goassethub.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
