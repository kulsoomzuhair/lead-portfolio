# B2B Customer Self-Service Portal & SAP B1 Sync Mock
## Running Locally & Demo Video Guide

This project is a mockup integration demonstrating how custom ASP.NET Core middleware acts as an API gateway to connect a B2B ordering portal to the **SAP Business One Service Layer**. 

It uses an **Agent-Based Architecture** (AuthAgent, CatalogAgent, OrderAgent, BillingAgent) and SQLite database via Entity Framework Core.

---

## 🚀 How to Run Locally

### 1. Prerequisites
Make sure you have the [.NET SDK 9.0](https://dotnet.microsoft.com/download) installed on your system.

### 2. Launch the Application
Open a terminal in this directory and run:
```bash
dotnet run
```

### 3. Open in Browser
Once running, open your web browser and navigate to:
👉 **[http://localhost:5000](http://localhost:5000)**

---

## 🔑 Test Credentials (Pre-seeded in SQLite)

To demonstrate client-specific contract pricing and different credit limits, use these accounts:

| CardCode | Account Name | Password | Pricing Contract | Credit Limit |
|---|---|---|---|---|
| **`C20000`** | Fatima Logistics | `fatima123` | Price List 1 (10% Discount) | $5,000.00 |
| **`C30000`** | KF Solutions | `kf123` | Price List 2 (25% Discount) | $10,000.00 |

---

## 🎥 Step-by-Step Demo Video Outline (For Recording)

When recording your video to show clients, follow this narrative structure:

1.  **Introduce the Dashboard (Login):**
    *   Start by showing the login screen.
    *   Explain: *"This portal allows B2B wholesale partners to authenticate directly against the SAP Business One database."*
    *   Log in using CardCode `C20000`.
2.  **Demonstrate Contract Pricing (Catalog tab):**
    *   Go to the **Wholesale Catalog** tab.
    *   Show that the prices displayed are pre-discounted based on their SAP Price List contract: *"Notice how the SAP B1 WooCommerce Adapter is listed at $405.00 instead of the $450.00 retail base price (10% off contract)."*
    *   Log out and log back in as `C30000`. Show the catalog again: *"Now, since KF Solutions has a 25% discount price list, they see the same item at $337.50."*
3.  **Place a Bulk Order (Checkout flow):**
    *   Order 3 units of the *Shopify API Middleware*.
    *   Explain: *"When I click 'Order Item', the OrderAgent validates my credit limit, queues the transaction locally to prevent data loss, and makes a POST call to the SAP B1 Service Layer."*
    *   Click checkout and show the **Success Popup** displaying the **SAP Document Entry ID** generated in real time.
4.  **Pay an A/R Invoice (Billing flow):**
    *   Go to the **Open Invoices** tab. Show the list of open invoices loaded directly from the SAP ledger table.
    *   Click **Pay Invoice** next to `INV-1001` ($1,200).
    *   Show the Stripe Checkout simulation modal, enter payment credentials, and authorize.
    *   Explain: *"Upon approval, the BillingAgent captures the Stripe payment token and posts an Incoming Payment directly to SAP, clearing the outstanding A/R ledger invoice instantly."*
    *   Show the status update to green **Paid** and the SAP Doc ID.
5.  **Review the Sync Logs (Monitor tab):**
    *   Navigate to the **Sync Monitor** tab.
    *   Show the real-time logs: *"Here, we can audit exactly what the System Agents did. You can see the AuthAgent logins, CatalogAgent pricing calculations, OrderAgent credit checks, and BillingAgent ledger payments."*
