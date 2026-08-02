# Requirements Document

## Introduction

Transform the existing single-store dairy PWA (Aarohi Enterprises) into a multi-vendor small store inventory and sales management platform. The platform targets small shop owners in India — kirana stores, dairy shops, vegetable vendors, and small general stores — enabling them to manage daily inventory, track wholesale and retail sales, handle customer credit, and generate business reports. The system must prioritize offline-first operation, multi-device sync, and multi-language support to serve vendors in semi-urban and rural India.

## Glossary

- **Platform**: The multi-vendor store management system as a whole
- **Vendor**: A registered shop owner who uses the platform to manage their store
- **Store**: A single business entity created by a Vendor, containing its own product catalog, customers, and transaction data
- **Product_Catalog**: The configurable list of products a Store sells, organized by categories
- **Category**: A grouping of products within a Store (e.g., Milk, Snacks, Vegetables)
- **Inventory_Record**: A daily record tracking received, sold, available, and damaged quantities per product
- **Wholesale_Customer**: A regular buyer who purchases in bulk, often on credit
- **Retail_Sale**: A walk-in customer transaction recorded as aggregate quantities
- **Credit_Ledger**: A per-customer record of outstanding credit, payments, and settlement history
- **Sync_Engine**: The component responsible for synchronizing local offline data with the cloud when connectivity is available
- **Offline_Store**: The local on-device data storage that enables full operation without internet connectivity
- **Session**: An authenticated period during which a Vendor or authorized family member can access store data

## Requirements

### Requirement 1: Vendor Onboarding

**User Story:** As a small shop owner, I want to sign up and create my store profile quickly, so that I can start tracking my business without complex setup.

#### Acceptance Criteria

1. WHEN a new user opens the platform, THE Platform SHALL display a sign-up flow requiring phone number, store name, and a PIN for authentication
2. WHEN a Vendor completes sign-up, THE Platform SHALL create a default Store with the provided store name and the Vendor as owner
3. WHEN a Vendor signs up, THE Platform SHALL offer a selection of store type templates (dairy, kirana, vegetable, general) pre-loaded with common categories and products for that type
4. IF sign-up fails due to network unavailability, THEN THE Platform SHALL allow the Vendor to complete local-only setup and defer account creation until connectivity is restored

### Requirement 2: Store Configuration

**User Story:** As a vendor, I want to configure my store's product catalog with custom categories, products, and pricing, so that the system matches my actual inventory.

#### Acceptance Criteria

1. WHEN a Vendor accesses store settings, THE Platform SHALL allow adding, editing, and removing categories
2. WHEN a Vendor adds a product, THE Platform SHALL require a product name, category, and selling price, and optionally accept a purchase price, barcode, and unit of measurement
3. WHEN a Vendor edits a product price, THE Platform SHALL apply the new price to future transactions while preserving historical transaction amounts
4. WHEN a Vendor selects a store template during setup, THE Product_Catalog SHALL be pre-populated with common products for that store type
5. WHEN a Vendor adds a customer to the store, THE Platform SHALL record the customer name, optional phone number, and optional credit limit

### Requirement 3: Daily Inventory Operations

**User Story:** As a vendor, I want to record daily received stock, track sales, and note damaged goods, so that I always know my available inventory.

#### Acceptance Criteria

1. WHEN a new day begins, THE Platform SHALL carry forward the previous day's available quantity as the current day's opening stock for each product
2. WHEN a Vendor records received stock for a product, THE Platform SHALL add the received quantity to the opening stock to calculate available inventory
3. WHEN a sale is recorded (wholesale or retail), THE Platform SHALL deduct the sold quantity from the available inventory for that product
4. WHEN a Vendor marks a product quantity as damaged, THE Platform SHALL deduct the damaged quantity from available inventory and record the loss amount
5. THE Platform SHALL compute available inventory as: opening stock + received - sold - damaged
6. WHEN a Vendor scans a product barcode, THE Platform SHALL identify the product and present quantity entry for received, sold, or damaged operations

### Requirement 4: Wholesale Customer Management

**User Story:** As a vendor, I want to manage my regular wholesale customers and record per-product quantities they purchase, so that I can track individual customer transactions.

#### Acceptance Criteria

1. WHEN a Vendor adds a Wholesale_Customer to a day's record, THE Platform SHALL display all products with quantity inputs for that customer
2. WHEN a Vendor records product quantities for a Wholesale_Customer, THE Platform SHALL calculate the subtotal for that customer based on product prices and quantities
3. WHEN wholesale quantities change, THE Platform SHALL update the daily inventory sold totals to reflect total wholesale plus retail sales
4. THE Platform SHALL allow the Vendor to maintain a list of regular customers that can be quickly added to any day's wholesale record

### Requirement 5: Retail Sales Tracking

**User Story:** As a vendor, I want to record aggregate retail sales per product, so that I can track walk-in customer revenue without individual customer details.

#### Acceptance Criteria

1. WHEN a Vendor enters retail quantities for products, THE Platform SHALL calculate the retail revenue per product and total retail revenue for the day
2. WHEN retail quantities are updated, THE Platform SHALL include retail quantities in the overall daily inventory sold calculation
3. THE Platform SHALL keep wholesale and retail sales as separate line items while combining them for total inventory deduction

### Requirement 6: Offline-First Operation

**User Story:** As a vendor in a rural area with unreliable internet, I want the app to work fully offline, so that I never lose a sale or data entry due to connectivity issues.

#### Acceptance Criteria

1. THE Offline_Store SHALL store all store data (products, inventory, customers, transactions, credit records) locally on the device
2. WHEN the device has no internet connectivity, THE Platform SHALL allow all operations (inventory entry, sales recording, customer management, report viewing) without degradation
3. WHEN internet connectivity is restored, THE Sync_Engine SHALL automatically synchronize local changes to the cloud
4. IF conflicting edits are detected during sync (same record modified on two devices), THEN THE Sync_Engine SHALL resolve conflicts using a last-write-wins strategy with timestamps and notify the Vendor of the resolution
5. WHEN a Vendor installs the app on a new device and authenticates, THE Sync_Engine SHALL download the full store dataset to the local device

### Requirement 7: Multi-Device Access

**User Story:** As a vendor, I want to access my store data from multiple devices (my phone and my family member's phone), so that more than one person can manage the shop.

#### Acceptance Criteria

1. WHEN a Vendor authenticates on a second device, THE Platform SHALL grant access to the same store data after synchronization
2. WHEN data is modified on one device and synced, THE Platform SHALL make the updated data available on all other authenticated devices upon their next sync
3. WHEN a Vendor shares store access, THE Platform SHALL allow the Vendor to grant access to another phone number for the same store with a configurable role (owner or assistant)
4. WHILE an assistant role is active, THE Platform SHALL allow inventory entry and sales recording but restrict store configuration changes to the owner role

### Requirement 8: Credit Ledger Management

**User Story:** As a vendor, I want to track credit given to customers and record payments when they settle, so that I always know who owes me money and how much.

#### Acceptance Criteria

1. WHEN a Wholesale_Customer purchases goods, THE Platform SHALL allow the Vendor to mark the transaction as credit (unpaid) or paid
2. WHEN a transaction is marked as credit, THE Credit_Ledger SHALL add the transaction amount to that customer's outstanding balance
3. WHEN a Vendor records a payment from a customer, THE Credit_Ledger SHALL deduct the payment amount from the customer's outstanding balance
4. THE Credit_Ledger SHALL maintain a full history of credit transactions and payments per customer with dates and amounts
5. IF a customer's outstanding balance exceeds the configured credit limit, THEN THE Platform SHALL display a warning to the Vendor before allowing further credit

### Requirement 9: Reports and Analytics

**User Story:** As a vendor, I want to see daily, weekly, and monthly summaries of my sales and inventory, so that I can understand my business performance and make better decisions.

#### Acceptance Criteria

1. WHEN a Vendor requests a daily report, THE Platform SHALL display total revenue (wholesale + retail), total damaged loss, product-wise sold quantities, and top customers for that day
2. WHEN a Vendor requests a weekly or monthly report, THE Platform SHALL aggregate sales, purchases, and profit data across the selected period
3. WHEN a Vendor views profit tracking, THE Platform SHALL compute profit as total revenue minus total purchase cost (where purchase price is configured) for the selected period
4. THE Platform SHALL display a customer-wise credit summary showing outstanding balances, total credit given, and total payments received
5. WHEN a Vendor views reports, THE Platform SHALL generate all report data from locally stored data without requiring internet connectivity

### Requirement 10: Multi-Language Support

**User Story:** As a vendor in India, I want to use the app in my preferred language (Telugu, Hindi, or English), so that I can comfortably operate the system without language barriers.

#### Acceptance Criteria

1. WHEN a Vendor selects a language preference during setup or in settings, THE Platform SHALL display all system labels, buttons, and messages in the selected language
2. THE Platform SHALL support Telugu, Hindi, and English as display languages
3. WHEN the language is changed, THE Platform SHALL immediately re-render all interface elements in the new language without requiring a restart
4. WHILE displaying translated content, THE Platform SHALL preserve user-entered data (product names, customer names) in their original language as entered by the Vendor

### Requirement 11: Scalability and Performance

**User Story:** As the platform grows from a single user to thousands of vendors, I want the system to remain fast and responsive, so that each vendor has a smooth experience regardless of total platform size.

#### Acceptance Criteria

1. THE Platform SHALL isolate each Store's data such that one Store's data volume has no impact on another Store's performance
2. WHEN a Vendor interacts with the app, THE Platform SHALL respond to user actions within 200 milliseconds for local operations (inventory entry, navigation, report generation from local data)
3. THE Platform SHALL use a cloud backend architecture that supports horizontal scaling to handle growth from one to thousands of concurrent vendors
4. WHEN syncing data, THE Sync_Engine SHALL transfer only incremental changes (not full datasets) to minimize bandwidth usage for vendors with limited data plans
