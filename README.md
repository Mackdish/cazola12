# Remix of Remix of Remix of AdConnect Foundation

You are acting as a principal software architect and senior full-stack engineer.

We are building a production-grade digital advertising network platform using:

Lovable

React

TypeScript

Tailwind CSS

Supabase

Supabase Auth

Supabase PostgreSQL

Supabase Storage

Supabase Edge Functions

The platform will connect:

Advertisers — businesses that pay to display advertisements.

Publishers — website owners who display advertisements and earn revenue.

Administrators — platform operators who control the network.

This is PHASE 1 ONLY.

Do not implement campaigns, ad serving, billing, analytics, or publisher monetization yet.

PRIMARY OBJECTIVE

Establish a clean, secure, scalable foundation that all future phases can build upon.

Before making changes, inspect the entire existing Lovable project.

Do not destroy existing functionality.

If this is a new project, establish the architecture from scratch.

1. APPLICATION ARCHITECTURE

Create a professional SaaS application shell with:

responsive sidebar

top navigation

authenticated layout

public layout

dashboard layout

role-aware navigation

notifications area

profile menu

logout

mobile navigation

Create separate dashboard areas:

/admin
/advertiser
/publisher

Do not expose unauthorized navigation items.

2. AUTHENTICATION

Implement Supabase Auth.

Support:

email/password registration

email/password login

logout

password reset

session persistence

protected routes

authenticated user loading

authentication error states

loading states

Do not store passwords manually.

Use Supabase Auth as the identity provider.

3. DATABASE FOUNDATION

Create migrations for:

profiles

Fields:

id

full_name

avatar_url

phone

status

created_at

updated_at

The ID must reference the authenticated Supabase user.

organizations

Fields:

id

name

slug

type

status

created_at

updated_at

Organization types:

advertiser

publisher

platform

organization_members

Fields:

id

organization_id

user_id

role

status

created_at

updated_at

Roles:

owner

admin

manager

analyst

member

platform_roles

If a separate platform-level role system is necessary, implement it securely.

Platform roles:

super_admin

admin

analyst

Do not rely only on frontend role checks.

4. PROFILE CREATION

Create the appropriate database trigger/function so that when a user registers through Supabase Auth, their profile is created safely.

Do not create duplicate profiles.

Handle failed profile creation gracefully.

5. RLS

Implement Row Level Security from the beginning.

Every user-facing table must have appropriate RLS.

Rules:

Users can access their own profile.

Organization members can access their organization's permitted data.

Users cannot access another organization's private data.

Advertiser users must eventually be isolated from publisher organizations.

Publisher users must eventually be isolated from advertiser organizations.

Admin access must be controlled through secure server-side authorization.

Never implement security only in React.

6. DATABASE SECURITY

Do not expose:

Supabase service-role key

private credentials

privileged functions

secret environment variables

to the browser.

Use SECURITY DEFINER functions only when necessary and secure them carefully.

Avoid overly permissive policies such as:

USING (true)

unless there is a specific public-read requirement.

7. TYPESCRIPT

Generate or update the Supabase TypeScript database types.

Use strongly typed database access.

Avoid any unless absolutely unavoidable.

Create reusable authentication and authorization utilities.

8. DESIGN SYSTEM

Create a premium ad-tech SaaS visual language.

Do not create a generic AI-generated dashboard.

Use:

strong typography

consistent spacing

restrained visual hierarchy

professional cards

clean tables

status badges

responsive layouts

accessible controls

clear empty states

loading skeletons

error states

Create reusable components for:

Button

Card

Modal

DataTable

Badge

Input

Select

Tabs

Dropdown

Toast

EmptyState

LoadingState

ErrorState

9. DASHBOARD PLACEHOLDERS

Create dashboard shells only.

Admin:

Overview

Users

Advertisers

Publishers

Campaigns

Websites

Ad Zones

Transactions

Analytics

Payouts

Settings

Advertiser:

Overview

Campaigns

Advertisements

Creatives

Wallet

Transactions

Analytics

Settings

Publisher:

Overview

Websites

Ad Zones

Earnings

Payouts

Analytics

Settings

These should be navigation shells only.

Do not implement the actual business functionality yet.

10. ERROR HANDLING

Implement:

auth errors

expired sessions

unauthorized access

database errors

network errors

form validation errors

Do not expose raw database errors to users.

11. ACCEPTANCE TESTS

Verify:

User can register.

User can log in.

User can log out.

Password reset works.

Session persists after refresh.

Profile is automatically created.

Unauthorized users cannot access protected routes.

Advertiser users cannot access publisher data.

Publisher users cannot access advertiser data.

Admin routes are protected.

RLS policies work independently of frontend restrictions.

TypeScript builds successfully.

No major console errors.

No broken routes.

No duplicate database migrations.

No secrets are exposed client-side.

IMPORTANT

Do not move to Phase 2.

After completing this phase:

inspect the implementation

test the database

test authentication

test RLS

fix any errors

verify the production build

Then provide a concise implementation report containing:

Files created/modified.

Database tables created.

RLS policies created.

Authentication functionality completed.

Tests performed.

Errors found and fixed.

Anything genuinely incomplete.

Stop after Phase 1.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://vertise-flow.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/43d18fdb-af75-4ed8-8ec5-9091f6161cef).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
