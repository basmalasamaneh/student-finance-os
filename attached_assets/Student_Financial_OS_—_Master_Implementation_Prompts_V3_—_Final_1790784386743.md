# STUDENT FINANCIAL OS
## Master Product Specification & 15 Sequential Replit Prompts — FINAL V3

---

# GLOBAL RULE — APPLIES TO ALL PROMPTS

This document is the single source of truth for the Student Financial OS project.

Build and extend the existing project incrementally.

Before every prompt:

- inspect the existing implementation
- understand the current architecture
- preserve all working functionality
- reuse existing components
- extend rather than unnecessarily replace
- do not restart the project
- do not remove existing features
- do not create duplicate systems
- do not break existing routes
- do not break authentication
- do not hardcode data that should be dynamic
- do not create disconnected mock screens

The project must use a real application data model and dynamic state/database-backed behavior wherever possible.

Demo data is allowed as initial seed data, but features must work dynamically after the user changes the data.

The financial system is simulated only.

Do not implement:

- real bank transfers
- real payment processing
- real wallet transfers
- KYC
- AML
- real card processing
- real money movement

Unavailable integrations must be clearly marked:

**Coming soon**

The architecture must be future-ready for real integrations.

---

# PRODUCT

Name:

**Student Financial OS**

Tagline:

**More than a wallet. Your financial life, organized.**

Core idea:

A student-first financial platform combining:

- simulated wallet
- accounts
- transactions
- budgeting
- financial planning
- income
- scholarships
- savings goals
- parent allowances
- family financial relationships
- money requests
- university finances
- housing
- transportation
- campus payments
- upcoming payments
- financial calendar
- forecasts
- financial insights
- AI assistant
- "Can I Afford This?"

The application should answer:

- How much money do I have?
- Where is it going?
- What money am I expecting?
- What do I need to pay soon?
- How much can I plan for?
- What am I saving toward?
- What have my parents sent?
- What requests are pending?
- How much am I spending at university?
- How much am I spending on transportation/housing?
- What happens if I make a purchase?

---

# CORE PRINCIPLES

Modern fintech + student productivity.

Young but not childish.

Professional but not corporate.

Helpful but not controlling.

Smart but not intimidating.

No shame-based financial language.

Avoid:

- "bad spending"
- "irresponsible"
- "you failed"

Prefer:

- "You are above your planned budget."
- "Your projected balance is lower than usual."
- "This purchase may affect your savings timeline."

---

# PALESTINE-FIRST

Primary currency:

**ILS / ₪**

Architecture should support future:

- USD
- JOD
- other currencies

Support Palestinian university context without hardcoding changing real-world information.

University data should be configurable.

Support:

- universities
- campuses
- cities
- faculties
- majors
- tuition planning
- registration fees
- housing
- transportation
- cafeterias
- bookstores
- printing
- internet
- academic supplies
- scholarships
- financial aid
- student loans
- campus services

Do not hardcode current fees or scholarship eligibility rules unless explicitly entered as demo/configurable data.

---

# PRIVACY

Do not require precise home addresses.

For student location use:

- city
- area
- neighborhood
- optional approximate location

Never require an exact street address for financial planning.

---

# USERS

Support:

- University Student
- School Student
- Parent/Guardian
- Admin

One parent may have multiple children.

One student may have multiple guardians.

Parent access is permission-based.

---

# DESIGN SYSTEM

Colors:

Deep Indigo #4338CA

Fresh Mint #34D399

Warm Amber #F59E0B

Soft Off-White #F8FAFC

White #FFFFFF

Dark Navy #172033

Slate #64748B

Soft Red #EF4444

Use red only for errors/critical warnings.

---

# RESPONSIVE

Mobile-first.

Support:

- mobile
- tablet
- desktop

Mobile:

- bottom navigation
- touch-friendly controls
- bottom sheets

Desktop:

- sidebar
- expanded layouts

No horizontal overflow.

---

# LOCALIZATION

Support:

- English
- Arabic

English = LTR

Arabic = RTL

Use proper i18n.

All user-facing strings must be translatable.

RTL must affect:

- layout
- navigation
- forms
- cards
- tables
- icons
- arrows
- spacing
- dialogs

Persist language.

---

# THEMES

Support:

- Light
- Dark
- System

Persist preference.

Dark mode must be intentionally designed.

---

# DEMO DATA

Student:

Basmala

University Student

Balance:

₪742.50

Monthly income:

₪600

Upcoming university payment:

₪150

Laptop goal:

₪1,240 / ₪3,000

Parent:

Parent Demo

Recurring allowance:

₪600/month

Pending request:

₪50

Admin:

Admin Demo

Demo data must be seedable and editable.

---

# PROMPT 1 — FOUNDATION, ARCHITECTURE & DESIGN SYSTEM

Inspect the current project before changing anything.

Preserve existing functionality.

Establish a scalable architecture for:

- routes
- components
- feature modules
- business logic
- database/data access
- validation
- types
- localization
- themes
- utilities

Centralize financial calculations.

Use safe money representation such as integer minor units or a safe decimal approach.

Create/reuse reusable:

- buttons
- inputs
- selects
- cards
- dialogs
- bottom sheets
- tables
- charts
- progress bars
- transaction rows
- money displays
- badges
- tabs
- loading states
- empty states
- error states
- success states

Create the application shell.

Student navigation:

- Home
- Money
- Transactions
- Plan
- Goals

University students should also have access to:

- Campus
- Upcoming

Parent:

- Home
- Children
- Allowance
- Requests
- Goals

Admin:

- Dashboard
- Users
- Students
- Parents
- Transactions
- Institutions
- Categories
- Settings

Set up:

- English/Arabic
- RTL/LTR
- Light/Dark/System
- responsive layouts
- accessibility
- keyboard navigation
- focus states

Do not implement all future features yet.

Run and verify the current application after changes.

---

# PROMPT 2 — AUTHENTICATION, ONBOARDING & PROFILE

Preserve current authentication.

Support:

- Student
- Parent
- Admin

## Student

Collect:

- name
- email
- student type

Student type:

- School Student
- University Student

## School

Collect:

- school
- city/area
- grade/level
- allowance frequency
- typical allowance

## University

Collect:

- university
- campus
- city
- faculty
- major
- academic year/level
- study status

Do not assume one specific university.

---

## RESIDENCE

Options:

- With family
- University housing
- Shared accommodation
- Private accommodation
- Other

Store:

- city/area
- monthly rent if applicable
- student's share
- utilities
- internet
- optional deposit

Do not require exact address.

---

## COMMUTE

Collect:

- home city/area
- university
- campus
- transportation method
- trips/week
- average cost/trip
- round-trip status

Methods:

- walking
- private car
- family ride
- taxi
- service/shared taxi
- bus
- other

Calculate estimated monthly transportation.

Allow manual editing.

---

## INCOME

Support multiple sources:

- Parent allowance
- Family support
- Scholarship
- Financial aid
- Student loan
- Salary
- Part-time
- Full-time
- Freelance
- Internship
- Business/project
- Gift
- Other

Each:

- amount
- frequency
- expected date
- stable/variable
- description
- active/inactive

---

## SCHOLARSHIPS / AID

Support:

- name
- provider
- type
- amount/percentage
- tuition coverage
- payment schedule
- start/end
- renewal date
- remaining coverage
- notes

---

## ONBOARDING SUMMARY

Before completion show:

- education
- institution
- residence
- commute
- income
- scholarship/aid

Allow editing.

Persist all data.

---

# PROMPT 3 — STUDENT HOME DASHBOARD

Build a dynamic dashboard.

Order:

1. Greeting
2. Available balance
3. Total accounts
4. Monthly income
5. Monthly spending
6. Upcoming payments
7. Savings goals
8. Campus activity
9. Financial insight
10. Recent transactions

Show:

- Student Wallet
- Bank Account
- Cash
- Other

Example:

₪742.50 total

For university students additionally show:

- upcoming university payment
- transportation estimate
- housing
- expected income
- scholarship/aid
- recent campus spending

For school students:

- weekly allowance
- spending
- savings
- next allowance

Campus activity can show recent:

- cafeteria purchase
- bookstore purchase
- printing
- university payment

All values must come from application data.

---

# PROMPT 4 — MONEY, ACCOUNTS, WALLET & CAMPUS PAYMENTS

Implement the simulated financial account system.

Accounts:

- Student Wallet
- Bank Account
- Cash
- Other

Actions:

- Add Money
- Send Money
- Request Money
- Receive Money
- Internal Transfer
- Simulated Payment
- Deposit
- Withdrawal

All are simulated.

---

# CAMPUS PAYMENTS — IMPORTANT

Implement **Campus Payments** as a first-class feature.

This is simulated in the prototype, but must be architected as if it could later connect to real university/campus payment systems.

Create:

**Campus**

→ **University**

→ **Campus**

→ **Campus Services**

Examples:

- Cafeteria
- Bookstore
- Printing Center
- Campus Transportation
- University Fees
- Other Campus Services

---

# CAMPUS SERVICE MODEL

Each service can have:

- ID
- university
- campus
- name
- Arabic name
- category
- description
- location description
- active/inactive
- payment availability
- integration status

Integration status:

- Simulated
- Coming soon
- Connected

For the prototype, use:

**Simulated**

---

# CAMPUS MERCHANTS

Allow configurable simulated campus merchants.

Examples:

### Main Cafeteria

Products:

- Sandwich — ₪12
- Coffee — ₪5
- Water — ₪2

### University Bookstore

Products:

- Notebook
- Book
- Pen
- Academic supplies

### Printing Center

Services:

- Black/white printing
- Color printing
- Binding

Prices should be configurable demo values, not hardcoded as real university prices.

---

# SIMULATED CAMPUS PAYMENT

Flow:

1. Student opens Campus.
2. Selects university/campus.
3. Selects service.
4. Selects product/service.
5. Reviews cart.
6. Selects Student Wallet or eligible account.
7. Checks balance.
8. Confirms payment.
9. Deducts simulated balance.
10. Creates transaction.
11. Assigns correct category.
12. Updates budget.
13. Updates dashboard.
14. Updates forecast.
15. Updates AI data.
16. Shows receipt/confirmation.

Example:

Cafeteria purchase:

₪17

Before:

₪742.50

After:

₪725.50

Transaction:

Cafeteria

Food

-₪17

Student Wallet

---

# CAMPUS PAYMENT RECEIPT

Show:

- merchant/service
- items
- amount
- date/time
- payment account
- transaction ID
- status

Status:

**Simulated Payment**

Make clear this is not real money movement.

---

# FUTURE INTEGRATIONS

Show:

Real University Payment

Coming soon

Digital Wallet

Coming soon

QR Payment

Coming soon

Bank Payment

Coming soon

Do not pretend these work.

---

# INTERNAL TRANSFERS

Implement safely:

1. Select account
2. Recipient
3. Amount
4. Validate recipient
5. Validate balance
6. Confirm
7. Deduct
8. Credit recipient
9. Create records
10. Confirmation

Do not allow unauthorized balance modification.

---

# PROMPT 5 — TRANSACTIONS & HISTORY

Implement dynamic transactions.

Types:

- Income
- Expense
- Transfer
- Allowance
- Refund
- Savings
- Withdrawal
- Deposit
- Payment
- Campus Payment

Fields:

- ID
- user
- amount
- type
- category
- date/time
- description
- source
- destination
- account
- status
- note
- related goal
- related budget
- parent transfer
- campus service
- university
- campus
- recurring expense

---

# CATEGORIES

University:

- Tuition
- Registration
- University Fees
- Transportation
- Food
- Cafeteria
- Accommodation
- Rent
- Utilities
- Books
- Printing
- Internet
- Academic Supplies
- Subscriptions
- Shopping
- Entertainment
- Health
- Social
- Personal
- Savings
- Other

School:

- Food
- Transportation
- School Supplies
- School Activities
- Books
- Personal
- Savings
- Other

Campus:

- Cafeteria
- Bookstore
- Printing
- Campus Transportation
- University Fees
- Other Campus

---

# FILTERS

Support:

- search
- category
- type
- date
- amount
- account
- parent transfer
- campus
- university
- goal

Every transaction has a details view.

---

# PROMPT 6 — BUDGET & FINANCIAL PLAN

Build a complete financial planning system.

Combine:

- income
- fixed expenses
- variable expenses
- university
- housing
- transportation
- campus spending
- savings
- upcoming payments

---

# INCOME

Aggregate:

- allowance
- family support
- scholarship
- aid
- loan
- salary
- part-time
- freelance
- internship
- business
- gifts
- other

Normalize frequencies for planning.

Do not treat irregular income as guaranteed.

---

# BUDGETS

Weekly/monthly.

Examples:

Food:

₪180 / ₪200

Transportation:

₪70 / ₪100

Shopping:

₪80 / ₪100

Subscriptions:

₪25 / ₪40

Campus spending should update the relevant budget automatically.

---

# UNIVERSITY PLAN

Support:

- tuition
- registration
- university fees
- transportation
- food
- cafeteria
- housing
- utilities
- internet
- books
- printing
- academic supplies
- subscriptions
- personal
- savings

---

# HOUSING

Support:

- family
- university housing
- shared
- private

Track applicable:

- rent
- utilities
- internet
- student's share

---

# TRANSPORTATION

Use commute profile.

Show:

- method
- home area
- university
- campus
- trips/week
- cost/trip
- estimated monthly cost

Allow manual override.

---

# RECURRING EXPENSES

Fields:

- amount
- category
- frequency
- next date
- description
- active

---

# FINANCIAL PLAN

Calculate:

Expected income

-

planned expenses

-

planned savings

=

projected remaining

Clearly label estimates.

---

# PROMPT 7 — SAVINGS GOALS

Unlimited goals.

Fields:

- name
- target
- current
- currency
- target date
- estimated completion
- status
- category
- priority
- notes

Actions:

- create
- edit
- contribute
- history
- pause
- resume
- complete
- archive

Calculate:

- percentage
- remaining
- required contribution
- estimated completion

Sources:

- student account
- parent funding

Update:

- balance
- transaction
- goal
- budget
- forecast
- dashboard

---

# PROMPT 8 — PARENT DASHBOARD & ALLOWANCES

Parent dashboard:

- children
- allowances
- requests
- goals
- permitted summaries
- relevant activity

---

# ALLOWANCE

One-time:

- amount
- date
- note

Recurring:

- amount
- frequency
- next payment
- start/end
- status

Actions:

- edit
- pause
- resume
- cancel

Allowance affects:

- parent balance
- student balance
- transaction history
- student income
- financial plan
- forecast
- dashboard

---

# GOAL FUNDING

Parent can fund shared goals.

Do not double-count.

---

# PRIVACY

Parent sees only permitted information.

Permissions:

- monthly summary
- balance
- goals
- allowance
- requests
- transactions
- upcoming payments
- campus spending if explicitly permitted

---

# PROMPT 9 — FAMILY LINK & MONEY REQUESTS

Student:

- invite parent
- remove
- change permissions

Parent:

- accept
- decline

Statuses:

- Pending
- Accepted
- Declined
- Removed

Support multiple guardians/children.

---

# MONEY REQUEST

Fields:

- amount
- reason
- note
- date
- parent
- status

Parent:

- approve
- decline
- ask details

Approval creates simulated transfer.

Decline creates no transfer.

Notifications:

- request
- approval
- decline
- allowance
- goal funding
- permission changes

---

# PROMPT 10 — SCHOOL MODE, UNIVERSITY MODE & CAMPUS

Create distinct experiences.

---

# SCHOOL MODE

Focus:

- weekly allowance
- spending
- saving
- requests
- parent
- school expenses
- financial education

Topics:

- saving
- budgeting
- needs vs wants
- recurring expenses
- goals
- income
- planning

Do not show complex university functionality unnecessarily.

---

# UNIVERSITY MODE

Support:

- institution
- campus
- city
- faculty
- major
- academic year
- tuition
- registration
- university fees
- housing
- transportation
- cafeteria
- bookstore
- printing
- internet
- academic supplies
- scholarships
- aid
- loans
- campus services

---

# UNIVERSITY DATABASE

Configurable institution fields:

- name
- Arabic name
- city
- campuses
- services
- housing availability
- transportation context
- cafeteria
- bookstore
- printing
- tuition configuration
- scholarship configuration

Do not hardcode changing real-world information.

---

# CAMPUS

Each campus:

- name
- Arabic name
- city
- location description
- services
- transportation context
- housing context

Student selects:

University → Campus

---

# CAMPUS SERVICES

University/campus may provide:

- Cafeteria
- Bookstore
- Printing
- Campus transportation
- University fees
- Other services

Each can have simulated payment functionality.

---

# CAMPUS SPENDING SUMMARY

Show:

- spending this month
- cafeteria
- bookstore
- printing
- transportation
- university payments

Allow filtering by campus/service.

---

# PROMPT 11 — UPCOMING PAYMENTS, CALENDAR & FORECAST

Track:

- tuition
- university installments
- registration
- university fees
- rent
- utilities
- subscriptions
- recurring expenses
- planned purchases
- savings
- campus commitments

Fields:

- name
- amount
- due date
- category
- status
- recurrence
- notes

---

# CALENDAR

Show:

- expenses
- expected income
- allowance
- salary
- scholarship
- freelance
- savings
- university payments
- rent
- subscriptions

---

# FORECAST

Current balance

+

expected income

-

upcoming expenses

-

recurring expenses

-

planned savings

=

projected balance

Include:

- housing
- transportation
- campus spending where applicable

Label:

**Estimated / Projected**

---

# PROMPT 12 — AI FINANCIAL ASSISTANT & INSIGHTS

Create a data-connected financial assistant.

It must use actual application data.

Questions:

- How much did I spend on food?
- How much at the cafeteria?
- How much at the bookstore?
- How much on transportation?
- What are my biggest categories?
- What payments are coming?
- What income is expected?
- How much have I saved?
- How much do I need monthly for my goal?
- What is my projected balance?

Capabilities:

- summarize
- calculate
- compare
- explain
- estimate
- organize
- identify patterns

Do not invent data.

Do not provide:

- investment recommendations
- guaranteed outcomes
- high-risk financial advice
- financial product recommendations

---

# PROMPT 13 — CAN I AFFORD THIS?

User enters:

- item
- price

System considers:

- current balances
- upcoming payments
- recurring expenses
- expected income
- budgets
- savings goals
- housing
- transportation
- university expenses
- campus commitments
- planned savings

Output a neutral projection.

Example:

"You currently have ₪742 available.

After planned expenses, approximately ₪420 would remain.

This purchase would reduce the projected remaining balance to approximately ₪320.

Based on your current saving plan, this purchase may affect your laptop goal timeline."

Do not make the decision for the user.

Allow scenario comparison.

---

# PROMPT 14 — NOTIFICATIONS, SETTINGS & PRIVACY

Notifications:

- allowance
- requests
- upcoming payments
- savings milestone
- budget
- parent activity
- scholarship reminder
- expected income
- system

Profile:

- name
- email
- student type
- university/school
- campus
- faculty
- major
- academic year
- currency
- language
- theme

Privacy:

- parent sharing
- balance
- transactions
- goals
- summary
- upcoming payments
- campus spending

Family settings.

Integration settings:

- Bank — Coming soon
- Digital Wallet — Coming soon
- University — Coming soon
- Campus Services — Coming soon
- Transportation — Coming soon

Data controls:

- export
- clear demo data where appropriate
- logout

---

# PROMPT 15 — ADMIN, SECURITY, QA & FINAL POLISH

Admin:

- users
- students
- parents
- transactions
- categories
- universities
- campuses
- campus services
- basic statistics
- settings

Admin must use protected access.

Do not expose unnecessary private financial data.

---

# UNIVERSITY ADMIN

Configure:

- universities
- campuses
- Arabic/English names
- cities
- services
- campus merchants
- simulated products/services
- categories
- optional tuition configuration
- housing
- transportation context

---

# CAMPUS ADMIN

Admin can configure simulated campus services:

Example:

Cafeteria

Bookstore

Printing Center

Campus Transportation

University Fees

For each:

- name
- category
- products/services
- demo prices
- active/inactive

Clearly mark demo prices as simulated/configurable.

---

# SECURITY

Verify:

- student isolation
- parent-child authorization
- permission-based visibility
- admin authorization
- server-side authorization
- balance protection
- transaction validation
- amount validation
- route protection
- no private data in URLs

---

# FINANCIAL CONSISTENCY

Test:

- add money
- send
- receive
- allowance
- transfer
- campus payment
- refund
- savings contribution
- parent goal funding

Avoid double-counting.

Every financial action must update the related systems correctly.

---

# COMPLETE EMPTY STATES

Implement for:

- no transactions
- no goals
- no payments
- no income
- no scholarship
- no parent
- no commute
- no university
- no campus
- no campus services
- no budgets
- no notifications

Each empty state explains the next useful action.

---

# COMPLETE RESPONSIVE QA

Test:

- mobile
- tablet
- desktop

No:

- overflow
- clipping
- overlapping
- broken cards
- inaccessible dialogs
- unreadable tables
- broken charts

---

# COMPLETE LANGUAGE QA

Test:

English + Light

English + Dark

Arabic + Light

Arabic + Dark

Check:

- RTL
- LTR
- currency
- dates
- numbers
- navigation
- forms
- dialogs
- cards
- tables
- transaction lists
- charts
- arrows

---

# COMPLETE FEATURE QA

Test:

## Wallet

- add money
- send
- receive
- transfer
- simulated payment

## Campus

- select university
- select campus
- select service
- select item
- checkout
- payment
- receipt
- transaction creation

## Transactions

- income
- expense
- campus payment
- allowance
- refund
- savings
- transfer

## Budget

- create
- update
- campus spending impact
- transportation
- housing
- university expenses

## Income

- salary
- part-time
- freelance
- scholarship
- allowance
- financial aid
- irregular income

## Housing

- family
- university housing
- shared
- private

## Transportation

- city/area
- university
- campus
- method
- trips/week
- cost/trip
- monthly estimate

## Goals

- create
- contribute
- parent funding
- progress

## Family

- invite
- accept
- permissions
- request
- allowance

## Upcoming

- tuition
- rent
- subscriptions
- recurring
- planned purchases

## Forecast

- income
- expenses
- savings
- projected balance

## AI

- summary
- categories
- campus spending
- transportation
- upcoming payments
- savings
- affordability

---

# END-TO-END DEMO

Run this complete scenario:

1. Parent Demo sends Basmala ₪150.
2. Student balance increases.
3. Notification appears.
4. Student opens campus.
5. Selects university.
6. Selects campus.
7. Opens cafeteria.
8. Selects sandwich + coffee.
9. Pays ₪17 using Student Wallet.
10. Balance decreases.
11. Campus transaction appears.
12. Food/Cafeteria budget updates.
13. Monthly spending updates.
14. Student contributes ₪20 to Laptop goal.
15. Goal updates.
16. Student checks "Can I Afford This?" for ₪100.
17. System considers:
    - current balance
    - university payment
    - housing
    - transportation
    - recurring expenses
    - expected income
    - savings plan
18. System produces neutral projection.
19. Student opens Upcoming.
20. University payment is shown.
21. Parent opens dashboard.
22. Parent sees only permitted information.
23. Parent cannot see private transactions without permission.
24. Admin can manage the configured university/campus/service data.

---

# DATA RELATIONSHIP REQUIREMENT

Features must NOT be isolated.

Parent allowance affects:

- balance
- transaction
- income
- plan
- forecast
- dashboard
- AI

Campus purchase affects:

- balance
- transaction
- category
- budget
- monthly spending
- forecast
- dashboard
- AI

Transportation profile affects:

- monthly estimate
- financial plan
- forecast
- affordability
- AI

Housing affects:

- recurring expenses
- financial plan
- forecast
- affordability
- AI

Scholarship affects:

- expected income
- university plan
- forecast
- dashboard
- AI

Savings affects:

- balance
- transaction
- goal
- plan
- forecast
- AI

University/campus configuration affects:

- campus discovery
- services
- simulated payments
- transaction categorization
- spending analytics

---

# FINAL QUALITY RULE

Do not consider a feature complete because a page exists.

A feature is complete only when:

- UI exists
- data exists
- CRUD/action works
- state updates
- database/data model updates
- calculations work
- permissions work
- loading works
- empty state works
- error state works
- success state works
- mobile works
- desktop works
- Arabic works
- English works
- Light works
- Dark works
- connected features update

The final product should feel like one coherent Student Financial OS.

Do not leave important functionality as disconnected mock screens.

Demo data may seed the system, but all major user actions must operate dynamically on the application's data.

All real-world financial integrations remain simulated/Coming soon.